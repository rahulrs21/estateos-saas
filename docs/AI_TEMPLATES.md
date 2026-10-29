# AI content templates and branding

Company settings → **AI content** (`/settings/ai-content`) holds two things: the brand details the Content Studio may use, and company templates. Every member can read both. Only owners and administrators can change them, which is enforced in the API and again in the SQL Connect operations. Every change is audited.

## Brand profile (`AiBrandProfile`)

Company name, phone and email already live on `Organization` (Company settings). The brand profile does not copy them. It records only whether they are approved for generated content, plus details `Organization` lacks:

| Field | Use |
| --- | --- |
| Display name | Overrides the company name in content |
| Approved tagline | May be used as written |
| Brand tone | Style guidance (≤400 characters) |
| Preferred content language | Default suggestion for members |
| Use company phone / email | Approves the `Organization` phone or email for drafts |
| WhatsApp number, website | Approved contact details |
| Default call to action | Used when a draft needs one |
| Marketing disclaimer | Approved wording, if any |
| Logo reference | Stored for future branded exports; not sent to Claude |

What goes to Claude:

- Claude receives only the approved values (`presentBranding`).
- The fact check flags any phone number, email address or web address in a draft that is not one of them.
- Licence numbers, RERA references, permits and guarantees are never part of branding and are never invented.
- A listing's or project's own permit number is a CRM fact. It is still listed for review before publication.

Saving uses a compare-and-set on `revision`: a stale form returns 409.

## Templates (`AiContentTemplate`)

A template is company style guidance for one content type, optionally for one purpose. It has a suggested tone and language, and an active flag.

How templates are used:

- Members see active templates of their own company in the studio.
- Administrators also see inactive ones.
- Templates are inserted into the prompt as `<company_template>`, and the system prompt treats them as style guidance only. A template cannot add facts, contact details or links, or override the fact rules.
- Templates are private to their company. Every operation is scoped by organization and membership.
- Deleting a template does not change existing drafts. A draft whose template was deleted or deactivated regenerates without it.

Suggested starting points are offered on the settings page. They are not stored until an administrator saves them:

- Property description
- New project announcement
- Lead introduction
- WhatsApp follow-up
- Viewing confirmation
- Email marketing
- Social media post

## Advertising limits

`src/modules/ai/content/ad-limits.ts` holds the default text limits per platform. They are passed to Claude and checked on every save; long text is flagged, never truncated.

| Platform | Primary text | Headline | Description | Per variant |
| --- | --- | --- | --- | --- |
| Meta | 125 (recommended) | 40 (recommended) | 30 (recommended) | 1 headline, 1 description |
| Google Search (RSA) | not used | 30 (platform limit) | 90 (platform limit) | 5 headlines, 2 descriptions |
| TikTok | 100 (platform limit) | not used | not used | — |
| LinkedIn | 150 (recommended) | 70 (recommended) | 100 (recommended) | 1 headline, 1 description |

These are reference values. Platforms change limits and ad policies, and the values were not re-verified against live provider documentation in this phase. To override them, set `AI_AD_LIMITS` to a JSON object, for example:

```
AI_AD_LIMITS={"META":{"primaryText":150},"LINKEDIN":{"headline":60}}
```

Allowed fields are `primaryText`, `headline` and `description`, as whole numbers from 10 to 5000. Invalid JSON or an unknown platform makes the AI configuration invalid (reported in logs), so a typo cannot silently remove a limit.

Generated copy is never described as approved by Meta, Google, TikTok or LinkedIn. Campaigns are not created or published.
