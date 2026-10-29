# AI lead qualification (Phase 6C)

EstateOS gives each open lead a transparent, rule-based score from 0 to 100, or "Insufficient data". **The score is calculated by EstateOS rules, not by Claude.** Claude may explain the score in plain words (see [AI sales intelligence](AI_SALES_INTELLIGENCE.md)). It never sets, changes or invents a score.

Code: `src/modules/ai/sales/scoring.ts` (pure and deterministic), `inputs.ts` (CRM rows to inputs), unit tests in `tests/ai-sales.test.ts`.

## What is scored

Rule version **`lq-1`**. Each factor has a maximum number of points.

- A factor that cannot be evaluated is left out of the total. It is marked **Missing** when the data is not recorded, or **Not available** when the member's role cannot see it. It is never counted as zero.
- Score = round(100 × points earned ÷ maximum points of the evaluated factors).

| Factor | Max | Rule |
| --- | --- | --- |
| Requirement completeness | 25 | Location 6, property type 5, bedrooms 4, budget (minimum or maximum) 10 |
| Budget and inventory fit | 20 | Uses the existing Phase 5D matching engine: available properties with an active listing that meet the requirements and budget. 3+ matches = 20, 1–2 = 14, none = 0. Missing when no budget is recorded; not available without inventory scope |
| Customer-stated timeline | 15 | Immediately 15, within 3 months 12, within 6 months 8.3, within 12 months 4.5, later 1.5, undecided 0. Missing when not recorded |
| Customer-stated readiness | 10 | Ready to proceed 10, exploring 5, not ready 0. Missing when not recorded |
| Recent interaction | 15 | Days since the last recorded interaction: ≤3 = 15, ≤7 = 10.5, ≤14 = 6, ≤30 = 3, older or none = 0 |
| Viewings | 15 | Upcoming confirmed, or a completed viewing with a positive outcome = 15; upcoming awaiting confirmation = 10.5; completed neutral = 7.5; only negative or no-show = 1.5; none = 0. Not available without inventory scope |
| Engagement history | 10 | Pipeline stage (60%: new 0, contacted 0.3, qualified or viewing 0.6, negotiation 1) and shortlist (40%: a property marked interested 1, only saved 0.5) |

**Interactions** are lead activities that record staff work with the customer:
- notes;
- status changes;
- completed follow-ups;
- shortlist changes;
- viewing scheduling and updates;
- qualification updates.

Lead creation, assignment and AI events do not count.

### When a score is shown

- **Shown** only when at least 60 points could be evaluated **and** at least 2 of the 4 requirement fields are recorded. Otherwise the result is **Insufficient data**, with the missing items listed.
- **Not scored:** closed leads (won, lost, converted) and archived leads.

### Priority labels

| Score | Label |
| --- | --- |
| 70 or more | High priority |
| 45–69 | Medium priority |
| Below 45 | Low priority |

A priority is a suggestion about **follow-up urgency**, nothing more.

## What is never used

The scoring input is an allowlist (`ScoringInput`). It has no field for any of the following, so they cannot affect a score:
- name or contact details;
- nationality or preferred language;
- religion, gender, age, ethnicity, disability, or family or marital status;
- lead source;
- free-text notes.

A unit test adds such fields to the CRM record and checks that the inputs and the score are unchanged.

**The score must never be used to refuse, limit or delay service, viewings, financing or housing for anyone.** It is advisory. It does not change the lead's own priority field, assignment or any other record.

## Customer-stated timeline and readiness

The lead record has no fields for timeline or readiness. Staff record what the customer told them in **Customer-stated qualification** on the lead page. The data is stored in `LeadQualificationDetails`:
- one row per lead;
- every change is a compare-and-set on `revision`;
- every change adds a lead activity and an audit entry.

The rules are the same as for notes and follow-ups: owners and administrators, or the member the lead is assigned to.

## Evaluation, history and audit

- **Evaluate score** (lead page) stores one row in `LeadQualificationAssessment`. It uses no AI allowance.
  - **What a row records:** score, priority, whether data was sufficient, rule version, a hash of the scoring settings, who evaluated it and when.
  - **The `result` JSON:** every evaluated input, every factor with its points and evidence, the missing information, the follow-up suggestions and the matched property references. Any stored score can therefore be recomputed and audited.
- **History:** rows are append-only, and the lead page lists them.
- **Freshness:** the page also shows what the rules would give now, so an out-of-date assessment is visible.
- **Analyze with Claude** reuses the latest stored assessment when the rules give the same result. Otherwise it stores a new one before calling Claude. A review of an unchanged assessment therefore stays current.
- **No automatic changes:** assessments never change the lead record.

## Manual review and override

On the latest assessment, **Review priority** records a reviewed priority (high, medium or low) with a reason of 10–500 characters, stored in `LeadPriorityReview`.

- **Who can review:** owners and administrators, or the assigned member, the same rule as lead edits.
- **Checks:** the database confirms that the stated suggestion matches the stored assessment of that lead.
- **What is recorded:** the suggested and reviewed priority, the reason and the reviewer. Every review is audited.
- **What does not change:** the calculated score and the lead record.
- **Scope:** a review applies only to the assessment it reviewed. After a later assessment, the new suggestion stands until someone reviews it.

## Configuration

`AI_LEAD_SCORING` (optional JSON) overrides weights, thresholds and the sufficiency rules, for example:

```
AI_LEAD_SCORING={"weights":{"viewings":20},"thresholds":{"high":75,"medium":50}}
```

The rules for the setting:
- **Allowed keys:** `weights.<factor>` (0–100), `thresholds.high` and `thresholds.medium` (1–100, medium below high), `minimumEvaluatedWeight` (0–100) and `minimumRequirementFields` (0–4).
- **Invalid settings:** any invalid value stops scoring with a clear error, so a typo cannot silently change scores. The problem is written to the server log.
- **Audit trail:** the settings hash stored with each assessment shows which configuration produced it.

Rule changes need a new `SCORING_RULE_VERSION`. Older assessments keep their stored version and factors.

## Limitations

- These are heuristic weights, not a statistical model. EstateOS does not yet have the historical outcome data needed to validate any conversion probability, so none is calculated or shown.
- Inventory fit uses the first 100 candidate properties (reported as partial when there are more).
- Interactions are only what staff record in EstateOS; calls or messages outside the CRM are invisible.
- Managers have no inventory scope, so for them inventory fit and viewings are not available.
