# Sprint 1 UAT — Findings, Triage, Version Table and Acceptance

CPE334 Lab 6, Parts C and D. Record actual outcomes only: do not fabricate findings or sign-offs.

## 1. Received findings (on our product): triage table

Write "No findings received" if the UAT Team reported none.

| Issue | Case / AC | Reporter | Classification | Reason (Sprint 1 contract + evidence) | Severity | Owner | Fix PR | Status / disposition |
|---|---|---|---|---|---|---|---|---|
| | | | | | | | | |

Rules (Lab 6 §3.3): reproduce a report before dismissing it, and never relabel a failing requirement as an
enhancement. A duplicate links to the original Issue. Critical and major defects must be fixed and re-tested. A
minor defect is fixed, or the UAT Team explicitly accepts it as a known limitation.

## 2. Outgoing reports (on the partner's product)

| Our Issue ID (in their repo) | Case / AC | Reporter | Severity | Their classification | Outcome |
|---|---|---|---|---|---|
| | | | | | |

## 3. Defect correction chain (one row per accepted defect)

| Issue | Fix branch (from `staging`) | RED: test name, commit, failing output | GREEN: commit, passing output | PR to staging (reviewer) | CI run | Release PR → main | Deployed commit / revision | Smoke check | UAT re-test |
|---|---|---|---|---|---|---|---|---|---|
| | | | | | | | | | |

## 4. Version table

| Stage | Commit / tag | Deployed revision | Note |
|---|---|---|---|
| Sprint 1 baseline | `v1.0-sprint1` → `18a3cd9` | — | Sprint 1 contract release |
| Tested in UAT round 1 | `c83a17a` (main) | _fill in_ | Lab 5 pipeline changes only, on top of the baseline |
| Defective commit(s) | | | |
| Test (RED) commit(s) | | | |
| Fix (GREEN) commit(s) | | | |
| Corrected main release | | | |
| Re-tested by the UAT Team | | | |

## 5. Known minor limitations accepted by the UAT Team

| Issue | Limitation | Accepted by (name / team) | Date |
|---|---|---|---|
| | | | |

## 6. Sprint 1 UAT acceptance decision (completed by the UAT Team only)

| Field | Value |
|---|---|
| Product | CPMS — Sprint 1 scope (F-01, F-02) |
| Exact release tested | commit: ____ / revision: ____ / URL: https://cpms-t4xsm3f7aa-as.a.run.app |
| Cases executed | UAT-01 … UAT-07 (PASS __ / FAIL __ / BLOCKED __) |
| Open critical / major defects | |
| Decision | ☐ Accepted ☐ Accepted with documented minor limitations ☐ Not Accepted |
| Reasons / conditions | |
| UAT testers (name / team) | |
| Date | |
| Recorded where | (e.g. comment link on Issue #__ from the UAT Team's GitHub account) |
