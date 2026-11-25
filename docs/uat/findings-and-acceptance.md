# Sprint 1 UAT — Findings, Triage, Version Table and Acceptance

CPE334 Lab 6, Parts C and D. Record actual outcomes only: do not fabricate findings or sign-offs.

## 1. Received findings (on our product): triage table

Write "No findings received" if the UAT Team reported none.

| Issue | Case / AC | Reporter | Classification | Reason (Sprint 1 contract + evidence) | Severity | Owner | Fix PR | Status / disposition |
|---|---|---|---|---|---|---|---|---|
| #36 | UAT-06c (UAT-06 step 2) / AC-02-09, BR-04 | Jiraphat Jarernpipattada & Thanaporn Bun (UAT Team), round 2 report 20 Nov 2026 16:22 | **Accepted defect** | AC-02-09 / BR-04: a missing or blank reason must give 400 and leave the proposal `SUBMITTED`. Reproduced on `8e89112`: status became `REJECTED` with reason `""`. Origin: Lab 6 controlled defect exercise (PR #34, released in #35) | **Major** (AC fails, no workaround; blocks acceptance) | Film26 (fix), jaruwan18 (review) | #37 → release #38 | Fixed and deployed in `463411f` / `cpms-00005-zns`. Re-test by the UAT Team: see §3 |

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
| #36 | `fix/36-reject-reason-required` | "Issue #36 (UAT-06c): an empty or blank reject reason is refused" (unit) and TEST-02-15b (API); `545a7b8` (+ `5799fb7` syntax fix); CI runs [44713303756](https://github.com/Film26/course-project-management/actions/runs/44713303756) and [44713549135](https://github.com/Film26/course-project-management/actions/runs/44713549135) **failed** | `c9c7282`; CI run [44713734162](https://github.com/Film26/course-project-management/actions/runs/44713734162) **passed** with the full suite | #37 (jaruwan18, approved) | [44870473139](https://github.com/Film26/course-project-management/actions/runs/44870473139) (staging PR #38) passed | #38 (approved by Nontok9164), merge `463411f` | `463411f` / `cpms-00005-zns`, Deploy demo run [45229209859](https://github.com/Film26/course-project-management/actions/runs/45229209859) | Deploy smoke test passed in run 45229209859 | Re-test results posted on #36 and #33 on 23 Nov 2026 from the account **Nontok9164**, not from the UAT Team's accounts. **Pending:** the UAT Team (jiraphat-j) confirms the re-test from their own account |

## 4. Version table

| Stage | Commit / tag | Deployed revision | Note |
|---|---|---|---|
| Sprint 1 baseline | `v1.0-sprint1` → `18a3cd9` | — | Sprint 1 contract release |
| Tested in UAT round 1 | `c83a17a` (main) | `cpms-00003-h49` | Lab 5 pipeline changes only, on top of the baseline. UAT round 1: 7/7 PASS, Accepted (#33, 20 Nov 2026) |
| Defective commit(s) | `5151842` (PR #34) → release `8e89112` (PR #35) | `cpms-00004-m7f` | Lab 6 controlled defect exercise build; UAT round 2 found #36 |
| Test (RED) commit(s) | `545a7b8`, `5799fb7` | — | Regression tests for #36; CI failed as expected |
| Fix (GREEN) commit(s) | `c9c7282` (merged to staging as `72a5ef3`, PR #37) | — | CI passed with the full suite |
| Corrected main release | `463411f` (PR #38) | `cpms-00005-zns` | Current deployed release |
| Re-tested by the UAT Team | _pending: UAT Team confirmation on `463411f`_ | | See §3, last column |

## 5. Known minor limitations accepted by the UAT Team

| Issue | Limitation | Accepted by (name / team) | Date |
|---|---|---|---|
| #36 | Proposal #3 in the deployed database still has an empty reject reason, stored by the defective release `8e89112`. The fix stops new empty reasons but does not change old data (data only; no effect on new decisions) | **Proposed, not yet accepted by the UAT Team** | — |

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
