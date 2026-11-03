# Call privacy and compliance (Phase 6F)

How EstateOS applies calling, opt-out, recording and retention rules. **This is not legal advice.** Before production use, the agency's compliance owner and a UAE legal adviser must review the points under [Needs legal review](#needs-legal-review).

## UAE rules this design is based on

Cabinet Resolution No. 56 of 2024 on regulating telemarketing took effect on 27 August 2024; Resolution No. 57 of 2024 sets the penalties. The official text on uaelegislation.gov.ae could not be retrieved automatically on 2026-11-03, so this summary relies on law-firm and industry summaries (Clyde & Co, Mondaq), which differ in places:

- Companies need prior TDRA approval to telemarket. It applies to licensed companies, including free-zone companies.
- Marketing calls must use local numbers registered to the company's commercial licence; individuals may not telemarket from personal numbers.
- Marketing calls are allowed only between 09:00 and 18:00.
- Numbers on the Do Not Call Registry (DNCR) must not receive marketing calls. Fines for calling them start at AED 50,000.
- After a consumer rejects a product or service, the company must not call again about it.
- At most one call a day, and two a week when unanswered (the wording of how these combine varies between summaries).
- Companies must keep records of marketing calls. Some summaries also say marketing calls must be recorded, with the consumer told at the start; others do not mention it.
- VoIP must run through TDRA-licensed infrastructure. A working Twilio, SIP or Retell connection does not by itself make calling lawful in the UAE.

## What EstateOS enforces

The rules are checked on the server (`src/modules/communications/compliance.ts`), with the company's own call history for the number (calls by every agent count). The database also refuses settings outside the legal bounds.

| Rule | Live call through a provider (6F.2) | Manual log of a call that happened |
| --- | --- | --- |
| Number not on the do-not-call list (all calls) | Refused | Saved with a warning |
| Number not opted out of marketing (marketing calls) | Refused | Saved with a warning |
| Inside company calling hours (default 08:00-21:00, company policy) | Refused | Saved with a warning |
| Marketing: TDRA approval reference recorded | Refused | Saved with a warning |
| Marketing: inside 09:00-18:00 (the company may narrow it) | Refused | Saved with a warning |
| Marketing: at most one a day; at most two unanswered in 7 days | Refused | Saved with a warning |
| Per-number daily limit, all calls (default 3) | Refused | Saved with a warning |
| Number is valid E.164, in an allowed calling code (default +971), not premium-rate | Refused | Saved with a warning |
| Incoming calls | Not checked (the customer called) | Not checked |

Why manual logs are not blocked: the call already took place, and refusing to record it would only hide it. The warnings are shown to the agent when they log the call, and on the call's page.

Live calls also need a verified provider, an active line confirmed as registered to the company, and an owner's or administrator's confirmation of the provider and UAE operating arrangements. That confirmation is a versioned statement; EstateOS does not verify the arrangements itself ([live calling](TELEPHONY_PROVIDERS.md#live-calling)).

Local days and times use the company timezone (default Asia/Dubai). An opt-out applies from the moment it was recorded; it does not flag calls made before it.

## Settings

`/api/communications/settings` (the settings page arrives in 6F.2). Every member can read the rules; only OWNERs and ADMINs change them. Every change is audited and uses compare-and-set.

| Setting | Default | Bounds enforced by the database |
| --- | --- | --- |
| Timezone | Asia/Dubai | Valid IANA name (checked on the server) |
| Calling hours | 08:00-21:00 | Start before end |
| Calls per number per day | 3 | 1-10 |
| Marketing calls enabled | Off | Needs a TDRA approval reference |
| Marketing hours | 09:00-18:00 | Within 09:00-18:00 |
| Marketing calls per day | 1 | 0-1 |
| Unanswered marketing calls per week | 2 | 0-2 |
| Allowed calling codes | 971 | Up to 10 codes |
| Recording | Off | Needs a notice of at least 20 characters and a legal basis |
| Retention | 90 days | 1-3650 days |
| Claude analysis | Off | — |
| Live calling confirmation | None | Given or withdrawn only by its own operations (owners and administrators, audited), never by saving settings |

## Do-not-call list

`CommunicationSuppression` rows hold a number, a scope (`ALL` or `MARKETING`), a reason and a source.

| How it is added | Scope | Source |
| --- | --- | --- |
| Call outcome *asked not to be called* | ALL (reason OPT_OUT) | CALL_OUTCOME |
| Call outcome *wrong number* | ALL | CALL_OUTCOME |
| Call outcome *rejected the offer* | MARKETING | CALL_OUTCOME |
| Owner or administrator, reason DNCR listed | As chosen | DNCR_CHECK |
| Owner or administrator, other reasons | As chosen | ADMINISTRATOR |

Outcome suppressions are written in the same database transaction as the call or the outcome change, so one cannot exist without the other. Rows are never deleted. Withdrawing one (owners and administrators, with a reason) keeps it as evidence. Agents see the *Do not call* and *No marketing calls* badges on the numbers but cannot change the list.

**EstateOS does not query the TDRA DNCR.** No integration exists. Agencies must check the registry through their approved process and record listed numbers here.

## Recording, transcripts and Claude analysis

Not available in 6F.1: no call is recorded, transcribed or sent to Claude. The panel says "Calls are not recorded". 6F.3 and 6F.4 add consent evidence and separate gates for each.

## Audit evidence

The audit log records:
- every logged call (type, status, source);
- every outcome change (old and new);
- every suppression added or withdrawn (with the call that caused it);
- every settings change (with the switches that widen what EstateOS may do).

The lead timeline records calls without their notes.

## Needs legal review

1. The official text of Cabinet Resolutions 56 and 57 of 2024, and the TDRA's current guidance, against the rules and defaults above. In particular: how the daily and weekly limits combine, and whether marketing calls must be recorded.
2. Which calls count as *marketing*: EstateOS lets agents classify a call as service, follow-up on the customer's own enquiry, or marketing, and applies the telemarketing rules to marketing calls only.
3. Whether follow-up calls on a customer's own website or portal enquiry need the DNCR check.
4. The company calling-hours default (08:00-21:00) for non-marketing calls, which is company policy, not a legal limit.
5. Retention periods for call records, notes and do-not-call evidence under the UAE Personal Data Protection Law (Federal Decree-Law 45 of 2021), and free-zone regimes (DIFC, ADGM) where the agency operates there.
6. The lawful basis and notice text for recording and for sending notes or transcripts to Claude (6F.3 and 6F.4).
7. Whether and how the agency checks numbers against the DNCR before marketing calls.
