# Deliverable 2 — Part A: Sprint 1 Continuity and Change / Defect Register

| Item | Value |
|---|---|
| Team | 67070507202 (Film26) · 67070507216 (jaruwan18) |
| Document owner | 67070507202 · reviewed by 67070507216 |
| Status date | 2026-11-25 — refresh §1 and every "pending" on the day the candidate is tagged |

### Version history

| Version | Date | Author | Change |
|---|---|---|---|
| 0.1 | 2026-11-25 | 67070507202 | First version. Drafted with an AI assistant (Claude Code); every commit, PR, run and revision was read from GitHub |
| 0.3 | 2026-11-25 | 67070507202 | #47/#56/#57 merge order and missing reviews on #56/#57 recorded; release PRs #59/#60 and sync PR #61 |
| 0.2 | 2026-11-25 | 67070507202 | PR #53 review by 67070507216: no reference to work that is not in the repository; F-03 / F-05 / F-07 now point to their PRs (#56, #57, #54); D-08 v1.1 approved; F-04 v1.2 review fixes (C-16); F-09 CI runs; allocation changes C-14 / C-17 with their timeline; #50 merge recorded as it happened |

## 1. Accepted Sprint 1 release and continuity

| Item | Value |
|---|---|
| Accepted Sprint 1 release | tag `v1.0-sprint1` → commit `18a3cd9` (release PR #15, 10 Nov 2026) |
| Sprint 1 UAT acceptance | Round 1 on `c83a17a` / `cpms-00003-h49`: UAT-01 … UAT-07 PASS, **Accepted** (UAT Team, [#33](https://github.com/Film26/course-project-management/issues/33#issuecomment-7033210710), 20 Nov 2026) |
| Current deployed release | `main` @ `463411f` (PR #38, fix for #36), revision `cpms-00005-zns` |
| Original critical journey | F-01 + F-02: student creates and submits a proposal → instructor rejects with a reason → student sees the reason, creates and submits a new one → instructor approves (TEST-02-20) |
| Continuity check on the candidate | Automated: TEST-01-13, TEST-01-13b, TEST-02-20, TEST-02-20b pass together with the Sprint 2/3 journeys on every feature branch (E2E 8/8 on `34ad6c6`). **On the tagged candidate:** _to fill_ (E2E output + the same journey by hand on the deployed URL with `/api/version`) |
| Sprint 1 behaviour changed on purpose | F-02 v1.3: submit needs ≥ 2 members (BR-07, planned as C-02 in Deliverable 1); `my-team` 403 when not enrolled. Seed adds student4 to Team Beta so the original journey still works (TEST-02-20 passes) |

## 2. Change and defect register

Status values: **Resolved** = fixed, released and re-tested · **Resolved, re-test pending** · **Open** · **Accepted limitation**.

| ID | Source | Affected requirement / feature | Finding | Decision | Status | Fix / change release | Re-test outcome |
|---|---|---|---|---|---|---|---|
| D-01 (#36) | Lab 6 UAT round 2, UAT Team (Jiraphat J. & Thanaporn B.), 20 Nov 2026, on `8e89112` / `cpms-00004-m7f` | AC-02-09, BR-04 (F-02) | Instructor could reject with an empty reason | Accepted defect, **Major** | **Resolved, re-test pending** | RED `545a7b8` (+ `5799fb7`, CI 44713303756 / 44713549135 failed), GREEN `c9c7282` (CI 44713734162 passed), PR #37 → release PR #38 → `463411f` / `cpms-00005-zns` (Deploy demo 45229209859, smoke test passed) | Re-test notes on 23 Nov came from `Nontok9164`, who is not on the UAT Team; the UAT Team's own confirmation on #33 is pending |
| D-02 | Follow-up of D-01 | BR-04 (data) | Proposal #3 keeps the empty reason stored by `8e89112` | Proposed **minor limitation** (data only) | **Open**: needs the UAT Team's acceptance or a data fix | — | — |
| L-01 | Lab 5 C-02, PR #27 | Merge gate | A failing test must block the merge into `main` | Expected behaviour | Verified: merge blocked, PR closed unmerged | ruleset `lab5-merge-gate` | — |
| L-02 | Lab 6 handoff | Deployment, `/api/ready` | `/api/ready` returned `db: unreachable` because Cloud SQL was stopped | Operational: start Cloud SQL before test sessions | Resolved before UAT round 1 | — | UAT round 1 PASS |
| L-03 | Lab 5 #25, #29 | Lab 5 evidence | Redeploy screenshot (#25); `deployment.md` was not merged (PR #31 closed) | Complete the evidence | `deployment.md`: PR #49 (approved); #25 screenshot **open** | PR #49 → `staging` | — |
| R-01 | PR #48 review (jaruwan18) | BR-09, F-04 seed | Re-running the seed on deploy could re-add a renamed/deleted milestone and exceed 100 %; impossible dates rolled over; a concurrent delete could return 500 | Accepted, fixed before merge | **Resolved** | RED `cf54a26` → GREEN `910ec18` (CI 45577625107), merged in #48 | TEST-04-13 / 04-01 failed at RED, pass at GREEN; TEST-04-14/14b could not reproduce the race (regression tests) |
| R-02 | F-03 work (own finding) | F-03 seed | Seeding memberships on every deploy would undo a student's own leave | Seed memberships only for students created in that run | **Resolved** on PR #56 | `10ce17a` | Checked on a fresh DB and on a copy of a Sprint 1 DB (F-03 evidence) |
| R-03 | PR #52 review (jaruwan18) | FR-22 paging | Sorting by `createdAt` while paging by `id` could skip or repeat entries | Order and page by `id` | **Resolved** on PR #52 | `fe304e6` | 92/92 locally |
| G-02 | Deliverable 1 gap | NFR-05 | No forced-500 test | Close in S2/S3 | **Implemented** | TEST-09-06 on PR #52 (CI 45561424547) | Passes |
| G-06 | Deliverable 1, NFR-07 | NFR-07 | README run took 21 min 36 s (target ≤ 15 min) | Rerun before the final release | **Open** | — | Planned in Part E §4 |
| L7-… | Lab 7 | _to fill_ | _Add Lab 7 findings, if any_ | | | | |

## 3. Approved baseline revisions (Sprint 2 and Sprint 3)

"Approved by" names the reviewer and the PR. Rows marked _merge pending_ are reviewed contracts whose code PR is still open.

| ID | Date | Document / version | Change | Reason | Approved by |
|---|---|---|---|---|---|
| C-07 | 2026-11-24 | F-04 v1.1 | NO_TEAM case → TEST-04-09b after F-03 | Needs `Enrollment` | jaruwan18, PR #48 (merged) |
| C-08 | 2026-11-24 | F-04 v1.0; SRS v0.3 FR-13 | Milestones have a max score (closes G-04) | BR-12 needs it | jaruwan18, PR #48; SRS in PR #47 |
| C-16 | 2026-11-25 | F-04 v1.2 | Real calendar dates only; seed adds milestones only to a course without any; edit/delete lock the row, P2025 → 404 | R-01 | jaruwan18, PR #48 (merged) |
| C-09 | 2026-11-25 | F-03 v1.1 | Join codes generated by the DB function `cpms_join_code()` | One generator for seed, tests and API | PR #56 — **merged 25 Nov 16:48 UTC without a review on the PR itself**; the code had already entered `sprint-2` 2 s earlier through #47 (stacked branch, reviewed and approved by jaruwan18) |
| C-10 | 2026-11-24 | F-03 v1.0; F-01 v1.2 | `Enrollment`; course list from enrollments; roster shows join codes and unassigned students; `my-team` 403 when not enrolled | A student without a team must see the course | PR #56 — **merged 25 Nov 16:48 UTC without a review on the PR itself**; the code had already entered `sprint-2` 2 s earlier through #47 (stacked branch, reviewed and approved by jaruwan18) |
| C-11 | 2026-11-25 | F-02 v1.3 | Submit needs ≥ `minTeamSize` members (409 `TEAM_TOO_SMALL`); seed adds student4 to Team Beta | BR-07 (C-02 of Deliverable 1) | PR #56 — **merged 25 Nov 16:48 UTC without a review on the PR itself**; the code had already entered `sprint-2` 2 s earlier through #47 (stacked branch, reviewed and approved by jaruwan18) |
| C-18 | 2026-11-25 | F-03 v1.2 | Seed memberships only for students created in that run | R-02 | PR #56 — **merged 25 Nov 16:48 UTC without a review on the PR itself**; the code had already entered `sprint-2` 2 s earlier through #47 (stacked branch, reviewed and approved by jaruwan18) |
| C-12 | 2026-11-25 | F-05 v1.0 (G-05) | After the due date a team with only late versions may submit another late one; none once an on-time version exists | Resolves G-05 | PR #57 — **merged 25 Nov 16:48 UTC without a review on the PR itself**; the code had already entered `sprint-2` 2 s earlier through #47 (stacked branch, reviewed and approved by jaruwan18) |
| D-08 | 2026-11-25 | F-06 v1.1; SRS §8 v0.3 | Only the current version is graded or released; release only after the due date; a released grade is final and the team cannot resubmit that milestone | Grades never change silently; FR-16 unchanged | **jaruwan18, PR #47 review (approved 25 Nov 08:46 UTC)** |
| C-13 | 2026-11-25 | F-02 v1.4 | Approve/reject and the audit entry run in one transaction | FR-22 | jaruwan18, PR #52 |
| C-15 | 2026-11-25 | CI workflow | CI also runs on PRs into `sprint-*` | Sprint integration checks | jaruwan18, PR #48 (merged) |
| C-19 | 2026-11-25 | F-08 v1.1 | Separate perf service/DB, fixed measurement conditions, NFR-10 for three endpoints, one grade shape | PR #50 review | PR #50 **merged after the v1.1 fixes; the reviewer's final approval of v1.1 is not recorded** (last review: changes requested on v1.0) |
| C-14 | 2026-11-25 | `plan.md` v0.3 | F-09 moves to 67070507202 | 67070507216 owned F-03/F-05 | jaruwan18, PR #51 (merged 25 Nov). **Timeline:** PR #52 (F-09 A1) was opened before this approval, on the same day |
| C-17 | 2026-11-25 | `plan.md` v0.4 | F-03, F-05 (S2) and F-07 (S3) move to 67070507202; 67070507216 reviews every PR | Four days left; F-03 → F-05 → F-06 built in sequence by one person | PR #58, review pending. **Timeline:** the F-03/F-05 code (PRs #56/#57) was committed before this approval, on the same day |

## 4. What to update before submission
- [ ] Every "pending" above → approval / merge date.
- [ ] §1 continuity row on the candidate commit.
- [ ] D-01 / D-02 after the UAT Team answers on #33.
- [ ] Lab 7 rows, if any.
