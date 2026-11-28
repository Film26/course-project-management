# Lab 7 Part C — Objective engineering metrics

Scope: repository `Film26/course-project-management` (CPMS, team TH-034) only. Window **20 Nov 2026 00:00 UTC → snapshot** (time printed in `metrics-sources.md`). All values come from the compact lists in [`metrics-sources.md`](metrics-sources.md), generated read-only by `metrics_snapshot.py`, or from the named test run. Final snapshot: **27 Nov 2026 18:15 UTC**, after the Lab 7 release (PR #79, deployed `cpms-00008-vtz`).

| ID | Metric | Definition | Scope / window | Value | Source / evidence |
|---|---|---|---|---|---|
| M1 | Completed Issues | Issues closed with reason *completed* in the window. Not planned / duplicate are counted separately | all Issues, window | **2** completed (#36 UAT defect, #46 F-09), 0 not planned | `metrics-sources.md` §M1 (E-C1) |
| M2 | Merged PRs and review coverage | PRs merged in the window, by target branch; *review coverage* = PRs with ≥ 1 review submitted **before** the merge ÷ merged PRs | all PRs, window | **27** merged (main 5, staging 5, sprint-2 6, sprint-3 11); review coverage **21 / 27 = 78 %** | `metrics-sources.md` §M2 (E-C2) |
| M3 | Automated test results | Server suite `npm test -w server` (Vitest unit + API/DB, 17 files) on the Lab 7 merge commit `c6c4b62`, CI run 45873332862 (PR #78) | one run | **242 passed, 0 failed, 0 skipped** (242). E2E (Playwright, `npx playwright test`, 11 tests) is **not in CI**; local run on `603b894`: 11 passed, 0 failed, 0 skipped | CI log excerpt (E-C3); `evidence/GREEN-withdraw.txt` (E-B4) |
| M4 | UAT defect status | UAT defects (Issues from the UAT Team) opened / resolved in the window. *Resolved* = fix merged to `main`, deployed and re-tested; status at the snapshot | UAT Issues, window | opened **1** (#36, Major), resolved **1** (fix #37 → release #38, `463411f`, `cpms-00005-zns`, 23 Nov); open **0**. One residual data item (old empty reason in proposal #3) proposed as a known limitation, **not yet accepted** by the UAT Team | `metrics-sources.md` §M1; `docs/uat/findings-and-acceptance.md` §2, §5 (E-C4) |
| M5 | CI run outcomes | GitHub Actions runs created in the window, all branches, by workflow and conclusion | all workflows, window | *CI & Docker Build*: **45 success, 4 failure, 2 cancelled** (51); *Deploy demo*: **5 success** (5, last = Lab 7 release `f0142cd`, run 46047397951). All 4 failures are intentional RED commits (`545a7b8`, `5799fb7` #36; `97069d9` F-09; `3a6d3e1` Lab 7); the 2 cancelled runs were superseded by a newer push | `metrics-sources.md` §M5 (E-C5) |

Derived percentage: M2 review coverage = 21 ÷ 27. *Note on #77:* it counts as reviewed under the M2 definition (reviews before merge: jaruwan18 *changes requested* 17:15 UTC and Nontok9164 *approved* 17:51 UTC, both on the contract), but the RED/GREEN code commits (17:51–17:53 UTC) were pushed after those reviews, so #77 had **no code review** before merge; the code review is #78. M2 counts any review, not code review, so it overstates code-review coverage by at least this PR. CI success rate (non-RED) = 45 ÷ (51 − 4 RED − 2 cancelled) = 45 ÷ 45.

## Interpretation (≤ 100 words) — written by Film26 (not confirmed by jaruwan18)

> M2 shows 6 of 27 merged PRs (22 %) had no review before merge (F-03, F-05, F-09 A2/A3), and #77 was merged before its code review. When review happened on release PR #59, it found three real defects (R-04 … R-06). M3 and M5 are healthy but E2E tests do not run in CI. **Action:** before Final Delivery, add a ruleset on `sprint-*` requiring one teammate approval and the `test-and-docker` check, and run Playwright in CI. **Owner:** Film26 (ruleset, CI job), jaruwan18 (reviews every feature PR). **Check:** M2 review coverage 100 % in the final window.

*(word count of the quoted text: 96)*
