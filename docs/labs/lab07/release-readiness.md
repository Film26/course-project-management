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
| `staging` | PR #78 → `_after merge_` | code review by jaruwan18 on #78 (approved 26 Nov 18:15 UTC) |
| Accepted `main` release | PR `#__` → `_____`, tag `v2.1-lab7` | *to fill after merge* |
| Deployed revision | `cpms-000__-___` | *to fill after deploy* |

Merge-commit differences: `staging`/`main` receive merge commits only; the tree of the `main` release equals `c6c4b62` plus those merges. Unrelated later-sprint changes in the window: none — `staging...sprint-3` contained only the 19 Lab 7 files (checked in the #78 review).

## 2. Release readiness checklist (maintained Sprint 1 scope)

| Check | Result | Evidence |
|---|---|---|
| Submitted / deployed version | `main` `_____` / `cpms-000__` | Part B release record |
| Approved change works (withdraw) | Auto: TEST-02-21 … 02-25 pass (CI run 45873332862 for API/DB; E2E local). Post-deploy: *to fill* | `GREEN-withdraw.txt`, L7-1 … L7-4 |
| Previously accepted Sprint 1 behaviour unchanged | Auto: TEST-01-*, TEST-02-01 … 02-20b all pass (only TEST-02-01 changed one expected pair, as approved). Post-deploy Sprint 1 path: *to fill* | same; post-deploy check |
| Automated tests | Server 242 passed / 0 failed / 0 skipped (CI, `c6c4b62`). E2E 11 / 0 / 0 (**local only**, not in CI) | M3 |
| Selected user tests (manual) | *jaruwan18, on the deployed URL, after deploy:* withdraw → DRAFT → resubmit; submit → reject with reason / approve | *to fill* (manual) |
| Defects by severity / status | **Major 1** (#36): resolved and deployed 23 Nov. **Open defects: none known** (basis: open Issues at the snapshot, UAT report, #77/#78 reviews). Review findings R-04 … R-07 (Sprint 2/3 code) resolved in D2 | M4; `docs/uat/findings-and-acceptance.md` |
| Technical debt | 6 items, §3 | |
| Configuration / secrets | DB URL and session secret in GCP Secret Manager; GitHub → GCP via Workload Identity Federation (no key file); no secrets in Git; synthetic seed accounts only | `docs/labs/lab05/deployment.md` |
| Documentation / run instructions | README (local run, tests, E2E DB); `deployment.md`; F-02 contract v1.7, SRS v0.4, SDS v0.4, traceability v0.9 updated for the change | repo |
| Deployment / smoke | CI Docker smoke test passed on `c6c4b62`. Deploy + post-deploy check: *to fill* | Part B |
| No schema / data migration | Confirmed: no migration, seed unchanged | #78 review |

**Decision: _READY / NOT READY — to state after the post-deploy check_.** Proposed: **READY** for the maintained Sprint 1 scope if the post-deploy and manual checks pass, with the outstanding items below (none blocks the Sprint 1 behaviour).

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
| Release PRs, deploy, post-deploy check | author / merger | approver |
| Manual test on the deployed URL | — | *to fill* |
| Metrics (Part C) | data and source tables | interpretation *(to confirm)* |
| Readiness, debt (Part D) | draft | retrospective, check |

Pair work: *to fill*. Nontok9164 also helped (contract approval on #77, earlier release approvals).

## 6. AI-use declaration

Claude Code (Anthropic) was used by Film26 to draft the impact analysis, contract revisions, tests, code, metric scripts and this report, and to run tests and Git/GitHub commands. The team reviewed the output: jaruwan18 reviewed the contract (#77) and the code (#78). All values come from the repository, CI and GitHub records cited above; AI output was not used as evidence by itself.

## 7. Known limitations

- E2E results are from local runs (not CI).
- The instructor's approval of #74 was verbal; the record is the Issue comment written by Film26 on 27 Nov 2026 (exact date of the statement as reported by Film26).
- #77 was merged before its code review; the code review is the #78 review (26 Nov 18:15 UTC).
- Metric values are a snapshot; Issues for delivered Sprint 2 features were still open at the snapshot (M1 understates completed work).
