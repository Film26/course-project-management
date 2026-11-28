# Lab 7 Part D — Release readiness and retrospective

**Scope of this decision:** the maintained **Sprint 1 functionality** (F-01 authentication/roles, F-02 proposal workflow) in the current deployed release, **including the approved Lab 7 change** (withdraw, Issue #74) and the previously accepted Sprint 1 behaviour. Sprint 2/3 features (F-03 … F-09) are deployed in the same application but are **not** Sprint 1 maintenance evidence and are not assessed here.

## 1. Version table

| Item | Ref | Note |
|---|---|---|
| Accepted Sprint 1 baseline | `v1.0-sprint1` → `18a3cd9` | UAT round 1 accepted on `c83a17a`; #36 fix `463411f` (`cpms-00005-zns`) |
| Actual pre-change implementation | `main` @ `ae801be` (`d2-candidate`), `cpms-00007-zhs` | `sprint-3` synced to it by #75 (`24a95a4`, same tree) |
| Contract + impact (before code) | `eb81ffe` (v1.6) → `3182796` (v1.7, review fixes) | PR #77 review: jaruwan18 *Request changes* 26 Nov 17:15 UTC; approval recorded in #74 17:51 UTC |
| Test change (RED) | `3a6d3e1` | 7 unit/API + 2 E2E fail on the old code |
| Fix (GREEN) | `603b894`; evidence `e1cda39` | 242/242, E2E 11/11 |
| Merged to `sprint-3` | `c6c4b62` (PR #77) | |
| `staging` | PR #78 → `d804f3a` (27 Nov 06:15 UTC) | code review by jaruwan18 on #78 (approved 26 Nov 18:15 UTC) |
| Accepted `main` release | PR #79 → **`f0142cd`**, tag **`v2.1-lab7`** | approved by jaruwan18 27 Nov 12:44 UTC; merged 27 Nov 18:10 UTC (merge commit) |
| Deployed revision | **`cpms-00008-vtz`** (100 % traffic) | Deploy demo run 46047397951, success 18:13 UTC; `/api/version` → `f0142cd` |

Merge-commit differences: `staging`/`main` receive merge commits only; the tree of the `main` release equals `c6c4b62` plus those merges. Unrelated later-sprint changes in the window: none — `staging...sprint-3` contained only the 19 Lab 7 files (checked in the #78 review).

## 2. Release readiness checklist (maintained Sprint 1 scope)

| Check | Result | Evidence |
|---|---|---|
| Submitted / deployed version | `main` `f0142cd` (`v2.1-lab7`) / `cpms-00008-vtz` | Part B release record; `evidence/post-deploy-v2.1-lab7.txt` |
| Approved change works (withdraw) | Auto: TEST-02-21 … 02-25 pass (CI run 45873332862 for API/DB; E2E local). Post-deploy: `POST /api/proposals/:id/withdraw` deployed (401 without session, not 404) | `GREEN-withdraw.txt`, L7-1 … L7-4, `post-deploy-v2.1-lab7.txt` |
| Previously accepted Sprint 1 behaviour unchanged | Auto: TEST-01-*, TEST-02-01 … 02-20b all pass (only TEST-02-01 changed one expected pair, as approved). Post-deploy: F-01 and F-02 submit / approve / reject routes answer 401 without session (NFR-02), version and readiness PASS | same; `post-deploy-v2.1-lab7.txt` (14/14 PASS) |
| Automated tests | Server 242 passed / 0 failed / 0 skipped (CI, `c6c4b62`). E2E 11 / 0 / 0 (**local only**, not in CI) | M3 |
| Selected user tests (manual) | jaruwan18 on the deployed URL, 28 Nov 18:20–18:41 (Bangkok): submit, **withdraw → DRAFT**, submit again, reject without reason refused, reject with reason, approve: **5 PASS, 1 incomplete (MT-3), 0 FAIL**. Completion run (Playwright by Claude Code for Film26, 28 Nov 18:58 Bangkok): MT-2, MT-3 (new title shown to student and instructor), MT-6 **PASS** with screenshots → **MT-1 … MT-6 all PASS** | `evidence/manual/manual-test-results.md`; L7-C1 … L7-C6; manual screenshots MT-1, MT-4, MT-5 |
| Defects by severity / status | **Major 1** (#36): resolved and deployed 23 Nov. **Open defects: none known** (basis: open Issues at the snapshot, UAT report, #77/#78 reviews). **Open item:** #36 residual data (proposal #3 keeps an empty reject reason from before the fix) is **waiting for UAT Team acceptance** as a known limitation, see outstanding items. Review findings R-04 … R-07 (Sprint 2/3 code) resolved in D2 | M4; `docs/uat/findings-and-acceptance.md` |
| Technical debt | 6 items, §3 | |
| Configuration / secrets | DB URL and session secret in GCP Secret Manager; GitHub → GCP via Workload Identity Federation (no key file); no secrets in Git; synthetic seed accounts only | `docs/labs/lab05/deployment.md` |
| Documentation / run instructions | README (local run, tests, E2E DB); `deployment.md`; F-02 contract v1.7, SRS v0.4, SDS v0.4, traceability v0.9 updated for the change | repo |
| Deployment / smoke | CI Docker smoke test passed on `c6c4b62` and on PR #79. Deploy success; post-deploy check 14/14 PASS (27 Nov 18:14 UTC) | Part B; `post-deploy-v2.1-lab7.txt` |
| No schema / data migration | Confirmed: no migration, seed unchanged | #78 review |

**Decision: READY** for the maintained Sprint 1 scope (release `v2.1-lab7`, `cpms-00008-vtz`). Basis: automated tests 242/242 and E2E 11/11; post-deploy check 14/14 PASS; selected user tests on the deployed URL MT-1 … MT-6 all PASS (manual by jaruwan18 + automated-browser completion run), covering the approved change (withdraw) and the preserved Sprint 1 path (submit, reject with reason required, approve). No open defect. Conditions that remain open and do not block the Sprint 1 behaviour: part of the manual evidence has no screenshot (covered by the completion run), #36 residual data waiting for UAT Team acceptance, E2E not in CI (outstanding items below).

| Outstanding item | Owner | Action / due |
|---|---|---|
| #36 residual data (proposal #3 empty reason) not yet accepted by the UAT Team | Film26 | ask UAT Team for acceptance or correct the row before Final Delivery |
| Issues for delivered work still open (#40–#43, #45, #74, Lab 5/6 #25, #29, #33) | Film26 | close with links to the merged PR / release, 30 Nov |
| E2E tests not in CI | Film26 | add a Playwright job to `ci.yml` before Final Delivery |

## 3. Technical debt

| Item | Impact | Priority | Disposition / action |
|---|---|---|---|
| Playwright E2E (11 tests) runs only locally, not in CI | a UI regression can merge unnoticed | High | add an E2E CI job (Postgres service + `cpms_e2e`) before Final Delivery — Film26 |
| No review gate on `sprint-*` branches (6/25 PRs merged without review, M2) | defects reach release PRs late (R-04 … R-06) | High | ruleset on `sprint-*`: 1 approval + required check — Film26 |
| Deadline check and `DEADLINE_PASSED` error duplicated in `submitProposal` and `withdrawProposal` | a future change to BR-02 must be made twice | Low | extract `assertBeforeDeadline(course, now)` in `service.js` — next F-02 change |
| A withdrawal leaves no trace (`submittedAt` → null, not audited; FR-22 scope) | instructor cannot see a team submitted then withdrew | Low | accepted for Lab 7 (contract v1.7 §9); propose FR-22 extension at Final Delivery |
| Withdraw button visibility uses the browser clock | button may show/hide wrongly near the deadline; API still decides (409) | Low | accepted; use server time from `GET my-team` if reported |
| BR-01 by row lock, not a DB constraint (G-01) | a future code path could bypass it | Low | existing; partial unique index planned (traceability G-01) |

## 4. Retrospective (one or two sentences each) — *jaruwan18 to write*

1. **What helped?** _…_
2. **What hurt?** _…_
3. **What will change for the final release (concrete next action)?** _…_

## 5. Contributions

| Work | Film26 (67070507202) | jaruwan18 (67070507216) |
|---|---|---|
| Change request #74, impact analysis, contract v1.6/v1.7 | author | reviewer (#77, requested 3 changes) |
| RED / GREEN code and evidence | author | code reviewer (#78) |
| Release PRs, deploy, post-deploy check | author / merger, tag, automated post-deploy check | approver (#78, #79) |
| Manual test on the deployed URL | — | tester (28 Nov, MT-1 … MT-6) |
| Metrics (Part C) | data and source tables | interpretation *(to confirm)* |
| Readiness, debt (Part D) | draft | retrospective, check |

Pair work: *to fill*. Nontok9164 also helped (contract approval on #77, earlier release approvals).

## 6. AI-use declaration

Claude Code (Anthropic) was used by Film26 to draft the impact analysis, contract revisions, tests, code, metric scripts and this report, and to run tests and Git/GitHub commands. The team reviewed the output: jaruwan18 reviewed the contract (#77) and the code (#78). All values come from the repository, CI and GitHub records cited above; AI output was not used as evidence by itself.

## 7. Known limitations

- E2E results are from local runs (not CI).
- Manual test (28 Nov): MT-3 was incomplete in the manual run and was completed by an automated browser run (Playwright, run by Claude Code for Film26), not by hand; manual screenshots exist only for MT-1, MT-4, MT-5, without the computer clock; `L7-M5-rejected.png` is a composite made by the tester (header joined to the card). Details in `evidence/manual/manual-test-results.md`.
- The instructor's approval of #74 was verbal; the record is the Issue comment written by Film26 on 27 Nov 2026 (exact date of the statement as reported by Film26).
- #77 was merged before its code review. Its reviews before merge were on the contract (jaruwan18 *changes requested* 17:15 UTC, still her latest review state at merge; Nontok9164 *approved* 17:51 UTC); the RED/GREEN commits came after them. M2 therefore counts #77 as reviewed (any review), while it had no code review; the code review is the #78 review (jaruwan18 approved 26 Nov 18:15 UTC).
- #36 residual data (proposal #3, empty reject reason from before the fix) is not yet accepted by the UAT Team; it is an open item, not a closed limitation.
- Metric values are a snapshot; Issues for delivered Sprint 2 features were still open at the snapshot (M1 understates completed work).
