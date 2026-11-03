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
| Recording (uploads of recordings and transcripts) | Off | Needs a notice of at least 20 characters and a legal basis |
| Retention | 90 days | 1-3650 days |
| Claude call summaries | Off | — |
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

## Recording, transcripts and consent

**EstateOS never records or transcribes calls itself.** Agents may add a recording or transcript that the company's approved phone or transcription service produced, and only when all of these hold (checked on the server, and again by the database):

1. **Company switch.** An owner or administrator enabled recording in Calling settings, with the notice read to callers (at least 20 characters) and the legal basis. Off by default.
2. **Answered call.** The call was answered, and the member is its agent or an owner or administrator.
3. **Consent evidence.** The call has current evidence (`CallConsentEvidence`) that the customer was told about the recording (*notice given*) or agreed (*consent given*). It records:
   - the method (said on the call, recorded announcement, in writing) and an optional note;
   - who captured it and when;
   - **copies of the company's notice text and legal basis at that moment**, so later settings changes do not rewrite the evidence.

   *Declined* is recorded too, and allows no recording.
4. **The file checks out.**
   - Recordings must be WAV (PCM) or MP3, recognised by their contents, up to 30 MB and 4 hours, and no longer than the call plus 2 minutes.
   - Transcripts must be WebVTT, SRT or plain text up to 1 MB and 5,000 lines. They are parsed into timestamped segments with speakers, and markup is removed.

How they are kept:
- **Private storage.** Files go to private storage under `organizations/{company}/communications/calls/{call}/…`, on paths EstateOS builds. The database rows pointing at them are created only by the server, which re-checks the member, the consent and the switch, so no member can make a record point at another file. Storage rules deny all browser access.
- **No public URLs.** Recordings stream from `/api/communications/recordings/{id}/content` and transcripts from `/api/communications/transcripts/{id}/content`, only to members who may read the call (`private, no-store`, sandboxed). **Every opening is audited** (`CALL_MEDIA_ACCESSED`). A guessed ID from another company or outside the member's access returns not-found.
- **Labelling.** Transcripts are labelled as possibly containing errors, with the language **detected** as English, Arabic or mixed (an estimate shown as such).
- **Deletion.**
  - Owners and administrators can delete a recording or transcript.
  - **Withdrawing the consent** (by the call's agent or an owner or administrator, with what the customer said) deletes every recording and transcript that relied on it, and their files, in the same step. The evidence itself is kept, marked withdrawn.

### Retention

Each recording and transcript is deleted automatically after the company's retention period (default 90 days, set in Calling settings) from when it was added. The automation worker tick does this in small batches, as an expiry followed by file removal, and also removes any file whose deletion was interrupted. Rows are kept as deletion evidence (when, why, by whom); files are not.

### Provider recordings and transcripts

EstateOS's own call flows never ask a provider to record. Provider recording and transcript events (Twilio recording callbacks, Retell transcripts) are kept as received events marked *not eligible*; nothing is downloaded. Automatic ingestion needs the provider set-up, notice playback and legal review first.

### Claude analysis

Off by default, behind its own company switch. Only redacted transcript or note lines are sent to Anthropic; summaries derived from a transcript are erased with it. See [AI_CALL_INTELLIGENCE.md](AI_CALL_INTELLIGENCE.md).

## Audit evidence

The audit log records:
- every logged call (type, status, source);
- consent evidence recorded and withdrawn; recordings and transcripts added, deleted and **opened**;
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
