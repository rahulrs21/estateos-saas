import assert from "node:assert/strict";
import { test } from "node:test";
import { normalizeTemplate, renderTemplate, selectable, templateComponents, templateValueProblems, templateValues, type MetaTemplate } from "../src/modules/inbox/whatsapp-templates";
import { MEDIA_MAX_ATTEMPTS, mediaBackoffMs, mediaUrlAllowed } from "../src/modules/inbox/whatsapp-media";

test("WhatsApp media is fetched with the token only from Meta's https media hosts, with growing waits between tries", () => {
  for (const ok of ["https://lookaside.fbsbx.com/whatsapp_business/attachments/?mid=123&ext=1", "https://mmg.whatsapp.net/v/t62/abc", "https://scontent.xx.fbcdn.net/x.jpg"]) assert.ok(mediaUrlAllowed(ok), ok);
  for (const bad of ["http://lookaside.fbsbx.com/x", "https://lookaside.fbsbx.com.evil.test/x", "https://evilfbsbx.com/x", "https://user:pass@lookaside.fbsbx.com/x", "https://lookaside.fbsbx.com:8443/x",
    "https://169.254.169.254/latest/meta-data", "file:///etc/passwd", "javascript:alert(1)", "", null]) assert.equal(mediaUrlAllowed(bad), false, String(bad));
  assert.ok(mediaUrlAllowed("http://127.0.0.1:4100/media/1", "http://127.0.0.1:4100"), "the local test server, only when it is the configured one");
  assert.equal(mediaUrlAllowed("http://127.0.0.1:4100/media/1", null), false);
  assert.deepEqual([0, 1, 2, 3, 4, 9].map(mediaBackoffMs), [60_000, 240_000, 960_000, 3_840_000, 15_360_000, 21_600_000], "a minute, then four times longer, at most six hours");
  assert.equal(MEDIA_MAX_ATTEMPTS, 5);
});

/* Phase 7B.2: WhatsApp templates read from Meta, filled in, previewed and sent exactly as approved. */

const positional: MetaTemplate = {
  id: "1234567890", name: "viewing_followup", language: "en_US", status: "APPROVED", category: "UTILITY", parameter_format: "POSITIONAL",
  components: [
    {type: "HEADER", format: "TEXT", text: "Hello {{1}}", example: {header_text: ["Layla"]}},
    {type: "BODY", text: "Thank you for your interest in {{1}}. Would {{2}} suit you for a viewing?", example: {body_text: [["Villa 12", "Tuesday at 10"]]}},
    {type: "FOOTER", text: "Faza Home Real Estate"},
    {type: "BUTTONS", buttons: [{type: "QUICK_REPLY", text: "Yes"}, {type: "PHONE_NUMBER", text: "Call us", phone_number: "+971500000000"}]},
  ],
};
const named: MetaTemplate = {
  name: "new_enquiry", language: "ar", status: "APPROVED", category: "MARKETING", parameter_format: "NAMED",
  components: [{type: "BODY", text: "Hi {{first_name}}, {{agent_name}} from our team will call you about {{first_name}}'s enquiry.",
    example: {body_text_named_params: [{param_name: "first_name", example: "Omar"}, {param_name: "agent_name", example: "Sara"}]}}],
};

test("Meta's templates are reduced to what can be chosen: blanks in order, examples, and the kinds EstateOS cannot send marked", () => {
  const template = normalizeTemplate(positional)!;
  assert.deepEqual({name: template.name, language: template.language, header: template.header, footer: template.footer, format: template.format, supported: template.supported},
    {name: "viewing_followup", language: "en_US", header: "Hello {{1}}", footer: "Faza Home Real Estate", format: "POSITIONAL", supported: true});
  assert.deepEqual(template.variables.map(item => [item.id, item.example]), [["HEADER:1", "Layla"], ["BODY:1", "Villa 12"], ["BODY:2", "Tuesday at 10"]]);
  assert.ok(selectable(template));
  const namedTemplate = normalizeTemplate(named)!;
  assert.deepEqual(namedTemplate.variables.map(item => [item.id, item.example]), [["BODY:first_name", "Omar"], ["BODY:agent_name", "Sara"]], "a repeated blank is asked once");

  const media = normalizeTemplate({...positional, components: [{type: "HEADER", format: "IMAGE"}, {type: "BODY", text: "See the photos"}]})!;
  assert.equal(media.supported, false);
  assert.match(media.unsupportedReason!, /image header/);
  const dynamicLink = normalizeTemplate({...positional, components: [{type: "BODY", text: "Hi"}, {type: "BUTTONS", buttons: [{type: "URL", text: "Open", url: "https://example.test/{{1}}"}]}]})!;
  assert.match(dynamicLink.unsupportedReason!, /link button with a blank/);
  assert.equal(normalizeTemplate({...positional, components: [{type: "BODY", text: "Hi"}, {type: "CAROUSEL"}]})!.supported, false);
  assert.equal(selectable(normalizeTemplate({...positional, status: "PAUSED"})!), false, "only approved templates can be chosen");
  assert.equal(normalizeTemplate({...positional, name: "Bad Name"}), null);
  assert.equal(normalizeTemplate({...positional, language: "english"}), null);
});

test("filled blanks are checked under Meta's rules before anything is drafted", () => {
  const template = normalizeTemplate(positional)!;
  assert.deepEqual(Object.keys(templateValueProblems(template, {})).sort(), ["BODY:1", "BODY:2", "HEADER:1"], "every blank must be filled");
  const good = {"HEADER:1": "Layla", "BODY:1": "Villa 12", "BODY:2": "Tuesday at 10"};
  assert.deepEqual(templateValueProblems(template, good), {});
  assert.match(templateValueProblems(template, {...good, "BODY:1": "Line one\nline two"})["BODY:1"], /line breaks/);
  assert.match(templateValueProblems(template, {...good, "BODY:1": "too     many spaces"})["BODY:1"], /four spaces/);
  assert.match(templateValueProblems(template, {...good, "BODY:2": "{{3}}"})["BODY:2"], /braces/);
  assert.match(templateValueProblems(template, {...good, "HEADER:1": "x".repeat(60)}).HEADER, /header would be longer/);
  assert.match(templateValueProblems(template, {...good, "BODY:1": "x".repeat(1000)}).BODY, /longer than 1024/);
  assert.deepEqual(templateValues(template, {...good, "BODY:9": "not a blank", other: 5}), good, "only this template's blanks are kept");
});

test("the preview is exactly the text sent, and the components match Meta's send format", () => {
  const template = normalizeTemplate(positional)!;
  const values = {"HEADER:1": "Layla", "BODY:1": "Villa 12", "BODY:2": "Tuesday at 10"};
  assert.equal(renderTemplate(template, values).text, "Hello Layla\n\nThank you for your interest in Villa 12. Would Tuesday at 10 suit you for a viewing?\n\nFaza Home Real Estate\n\n[Yes] [Call us]");
  assert.match(renderTemplate(template, {}).body, /\{\{1\}\}/, "an empty blank shows its placeholder");
  assert.deepEqual(templateComponents(template, values), [
    {type: "header", parameters: [{type: "text", text: "Layla"}]},
    {type: "body", parameters: [{type: "text", text: "Villa 12"}, {type: "text", text: "Tuesday at 10"}]},
  ]);
  const namedTemplate = normalizeTemplate(named)!;
  assert.deepEqual(templateComponents(namedTemplate, {"BODY:first_name": "Omar", "BODY:agent_name": "Sara"}),
    [{type: "body", parameters: [{type: "text", parameter_name: "first_name", text: "Omar"}, {type: "text", parameter_name: "agent_name", text: "Sara"}]}], "named blanks are sent by name");
  assert.equal(renderTemplate(namedTemplate, {"BODY:first_name": "Omar", "BODY:agent_name": "Sara"}).text, "Hi Omar, Sara from our team will call you about Omar's enquiry.");
  assert.deepEqual(templateComponents(normalizeTemplate({name: "hello_world", language: "en_US", status: "APPROVED", components: [{type: "BODY", text: "Hello World"}]})!, {}), [], "no blanks, no components");
});
