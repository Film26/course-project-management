# Deliverable 2 — Part A: Sprint 1 Continuity and Change / Defect Register

| Item | Value |
|---|---|
| Team | 67070507202 (Film26) · 67070507216 (jaruwan18) |
| Document owner | 67070507202 · reviewed by 67070507216 |
| Status date | 2026-11-25 (update on the day the Deliverable 2 candidate is tagged) |

### Version history

| Version | Date | Author | Change |
|---|---|---|---|
| 0.1 | 2026-11-25 | 67070507202 | First version: Sprint 1 baseline, findings register, baseline revisions. Drafted with an AI assistant (Claude Code); every commit, PR, run and revision was read from GitHub |

## 1. Accepted Sprint 1 release and continuity

| Item | Value |
|---|---|
| Accepted Sprint 1 release | tag `v1.0-sprint1` → commit `18a3cd9` (release PR #15, 10 Nov 2026) |
| Sprint 1 UAT acceptance | Round 1 on `c83a17a` / `cpms-00003-h49`: UAT-01 … UAT-07 PASS, **Accepted** (UAT Team, #33, 20 Nov 2026) |
| Current deployed release | `main` @ `463411f` (PR #38, fix for #36), revision `cpms-00005-zns` |
| Original critical journey | F-01 + F-02: student creates and submits a proposal → instructor rejects with a reason → student sees the reason, creates and submits a new one → instructor approves (TEST-02-20) |
| Continuity check on the candidate | _To fill on the candidate commit:_ TEST-01-13, TEST-02-20, TEST-02-20b in `npm run test:e2e`, and the same journey by hand on the deployed URL (screenshots + `/api/version`) |

## 2. Change and defect register

Status values: **Resolved** = fixed, released and re-tested · **Resolved, re-test pending** · **Open** · **Accepted limitation** (needs the reporter's acceptance).

| ID | Source | Affected requirement / feature | Finding | Decision | Status | Fix / change release | Re-test outcome |
|---|---|---|---|---|---|---|---|
| D-01 (#36) | Lab 6 UAT round 2, UAT Team (Jiraphat J. & Thanaporn B.), 20 Nov 2026, on `8e89112` / `cpms-00004-m7f` | AC-02-09, BR-04 (F-02) | Instructor could reject with an empty reason; stored `REJECTED` with reason `""` | Accepted defect, **Major** (Film26, triage on #36) | **Resolved, re-test pending** | RED `545a7b8` (+ `5799fb7`), GREEN `c9c7282`, PR #37 → release PR #38 → `463411f` / `cpms-00005-zns`, Deploy demo run 45229209859 | Re-test results were posted on 23 Nov from the **Nontok9164** account, not from the UAT Team. The UAT Team still has to confirm on #33 from their own account |
| D-02 | Follow-up of D-01 | BR-04 (data) | Proposal #3 in the deployed database keeps the empty reason stored by `8e89112`; the fix prevents new ones but does not change old data | Proposed **minor limitation** (data only, no effect on new decisions) | **Open**: waiting for the UAT Team to accept it as a limitation, or for a data fix | — | — |
| L-01 | Lab 5 C-02, PR #27 | Merge gate (NFR-08 delivery process) | A failing test must block the merge into `main` | Expected behaviour (evidence, not a defect) | Verified: check failed and merge was blocked; PR closed unmerged | ruleset `lab5-merge-gate` | — |
| L-02 | Lab 6 handoff (PR #32 description) | Deployment, `/api/ready` | `/api/ready` returned `db: unreachable` because Cloud SQL `cpms-pg` was stopped | Operational: start Cloud SQL before every test session | Resolved before UAT (round 1 ran on a ready database) | — | UAT round 1 PASS |
| L-03 | Lab 5 #25, #29 | Lab 5 evidence | Persistence after redeploy: screenshot still to attach (#25); `deployment.md` was not merged (PR #31 closed) | Complete the evidence | **Open**: #25 screenshot; `deployment.md` in PR #49 | PR #49 → `staging` | — |
| G-02 | Deliverable 1 coverage gap | NFR-05 | No test forced an unexpected error to show that a 500 hides internal details | Close in Sprint 2/3 | **Implemented, PR open**: TEST-09-06 forces a DB error and checks `500 INTERNAL_ERROR` without the internal message | PR #52 (F-09 A1) | Passing locally (`3bca213`); CI after merge |
| G-06 | Deliverable 1, NFR-07 README run | NFR-07 | README run took 21 min 36 s (target ≤ 15 min) | Fix README database setup and rerun in S2 | **Open** | — | Rerun planned before the final release |
| L7-… | Lab 7 | _fill in_ | _Add any Lab 7 finding here (ID, source, requirement, decision, status, release, re-test)._ | | | | |

## 3. Approved and proposed baseline revisions (Sprint 2 and Sprint 3)

Each revision is visible in the version history of the named document. "Approved by" names the reviewer of the PR that carries it.

| ID | Date | Document / version | Change | Reason | Approved by / status |
|---|---|---|---|---|---|
| C-07 | 2026-11-24 | F-04 contract v1.1 | The `NO_TEAM` case of TEST-04-09 becomes TEST-04-09b, run after F-03; migration name fixed | A student "in the course without a team" exists only once F-03 adds `Enrollment` | PR #48, review by jaruwan18 _pending_ |
| C-08 | 2026-11-24 | F-04 contract v1.0 (G-04) | Milestones have a **max score** (1–1000) besides the FR-13 fields | BR-12 needs the maximum score; closes G-04. SRS FR-13 wording to be updated | PR #48, review _pending_ |
| C-09 | 2026-11-25 | F-03 contract v1.1 | Join codes generated by the database function `cpms_join_code()` | One generator for seed, tests and API; no fixture needs a code | F-03 PR (jaruwan18), review by Film26 _pending_ |
| C-10 | 2026-11-24 | F-03 contract v1.0 / F-01 | New `Enrollment` table; `GET /api/courses` for students lists enrolled courses (was: courses where in a team); `my-team` returns 403 when not enrolled (was 404) | A student without a team must still see the course to create or join one | F-03 PR, review _pending_; F-01 contract needs a matching version |
| C-11 | 2026-11-24 | F-02 contract v1.3 (was planned as C-02 in Deliverable 1) | Submit also requires `memberCount ≥ minTeamSize` → 409 `TEAM_TOO_SMALL` (BR-07); seed adds student4 to Team Beta | BR-07 belongs to F-03 (Sprint 2) | F-03 PR, review _pending_ |
| C-12 | 2026-11-25 | F-05 contract v1.0 (G-05) | After the due date, a team whose versions are all late may submit another late version; once an on-time version exists, no resubmission after the due date | Resolves the BR-11 wording gap G-05 | F-05 PR, review _pending_ |
| C-13 | 2026-11-25 | F-02 contract v1.4 | Approve/reject and the F-09 audit entry run in one transaction | FR-22: a decision is never stored without its audit entry | PR #52, review by jaruwan18 _pending_ |
| C-14 | 2026-11-25 | `plan.md` v0.3 | F-09 Audit log moves from 67070507216 to 67070507202 | Balance: 67070507216 owns F-03 and F-05, which later work depends on | PR #51, approval by jaruwan18 _pending_ |
| D-08 | 2026-11-24 | F-06 contract v1.0, SRS §8 (proposed) | Only the current version is graded; a released grade is final and the team cannot resubmit that milestone | Students never see a grade change silently | PR #47, **needs jaruwan18's approval** before it enters the SRS |
| C-15 | 2026-11-25 | CI workflow (`ci-docker.yml`) | CI also runs on PRs into `sprint-*` | Deliverable 2 asks for sprint integration checks | PR #48, review _pending_ |

## 4. What to update before submission
- [ ] Every "_pending_" above → the PR number and the approval date once merged.
- [ ] §1 continuity row with the candidate commit, E2E output and screenshots.
- [ ] D-01 / D-02 after the UAT Team answers on #33.
- [ ] Lab 7 rows, if any.
