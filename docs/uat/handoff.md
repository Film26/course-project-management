# Sprint 1 UAT Handoff — CPMS (Product Team → UAT Team)

CPE334 Lab 6, Part A. This page gives you everything needed to run [`sprint-1-uat-cases.md`](sprint-1-uat-cases.md)
without a verbal briefing. If something here is unclear or wrong, report it as a finding (§6).

## 1. Teams

| Role | Team | Students (name / ID) |
|---|---|---|
| Product Team | CPMS (Film26 / jaruwan18) | น.ส.ทรรศน์วรรณ นามกา 67070507202 · 67070507216 (jaruwan18; full name _pending_) |
| UAT Team | E-Commerce Product Team / TokTickIt | Jiraphat Jarernpipattada (GitHub jiraphat-j) · Thanaporn Bun (name as written in the UAT Team's report on #36) |

**Other accounts in the record.** `Nontok9164` is not one of the two Product Team students and not a member of the UAT Team. It approved release PR #38 and posted re-test notes on #33 and #36; these are therefore **not** the UAT Team's independent actions, and the UAT Team's own confirmation of the corrected release is pending (`findings-and-acceptance.md` §3).

## 2. Release under test

| Item | Value |
|---|---|
| Repository | https://github.com/Film26/course-project-management |
| Sprint 1 baseline release | tag `v1.0-sprint1` → commit `18a3cd9` (12 Nov 2026) |
| Deployed commit (tested version) | `main` @ `c83a17a631664c47df646782d23fa51bce8c8bd6`. Check it yourself: `<URL>/api/version` |
| Cloud Run revision | `cpms-00003-h49` (Deploy demo run 43922898309; confirmed by the UAT Team in #33). Command: `gcloud run services describe cpms --region asia-southeast1 --format='value(status.latestReadyRevisionName)'` |
| Deployed URL `<URL>` | https://cpms-t4xsm3f7aa-as.a.run.app |
| Health check | `<URL>/api/ready` must return `{"status":"ready","db":"connected"}` before you start |

`c83a17a` is newer than `v1.0-sprint1`. The difference is Lab 5 work only: Docker image, CI, the deploy pipeline,
`/api/ready` and `/api/version`. No Sprint 1 user-facing behaviour was changed, so the Sprint 1 contract below
applies unchanged.

Before deploying anything that could affect testing, the Product Team will tell the UAT Team the new commit.
Record `/api/version` at the start of every test session.

## 3. Accepted-for-test scope (Sprint 1 only)

| In scope | Contract |
|---|---|
| F-01 Authentication & role-based access: login, logout, current user, course list, instructor roster | [`F-01-auth.md`](../sprints/sprint-1/F-01-auth.md) AC-01-01 … AC-01-11 |
| F-02 Project proposal workflow: create/edit draft, submit, instructor list/approve/reject, team view and history | [`F-02-proposal.md`](../sprints/sprint-1/F-02-proposal.md) AC-02-01 … AC-02-14 |

**Out of scope** (Sprint 2/3, not part of this acceptance): team formation and membership changes (F-03),
milestones and submissions (F-05), dashboard (F-08), audit log (F-09), and any feature not in the two contracts
above. Report such ideas as *enhancements*, not defects.

## 4. Accounts (labels only; credentials are given privately)

| Label | Role | Display name | Team in CPE334 |
|---|---|---|---|
| `INSTRUCTOR-1` | INSTRUCTOR | Instructor One | teaches CPE334 |
| `STUDENT-A1` | STUDENT | Student One | Team Alpha |
| `STUDENT-A2` | STUDENT | Student Two | Team Alpha |
| `STUDENT-B1` | STUDENT | Student Three | Team Beta |

The emails and the shared password are sent through the private course handoff channel (_channel name pending_),
**not** in this file or the PDF. All accounts and data are synthetic.

## 5. Data setup, reset and cleanup

- **Seed data:** course `CPE334 Software Engineering`, proposal deadline 31 Dec 2026 23:59 (Asia/Bangkok);
  Team Alpha = Student One + Student Two; Team Beta = Student Three.
- **Starting state required by the cases:** Team Alpha and Team Beta have **no** proposals. The Product Team
  resets the data before the first session and whenever the UAT Team asks for it.
- **Reset procedure (Product Team only):** connect to the Cloud SQL database `cpms` and run

  ```sql
  DELETE FROM "Proposal";   -- removes every proposal; users, course and teams stay
  ```

  Then confirm with `INSTRUCTOR-1` → Review proposals → filter **All** → "No proposals."
- **Cleanup after UAT:** UAT data is labelled `UAT-…`. Keep it until grading is over, because it is evidence.
- **Case order:** UAT-07 → UAT-06 → UAT-02 → UAT-01 → UAT-03 → UAT-04 → UAT-05 (see the cases file).

## 6. How to report a finding

Open a GitHub Issue in the repository with the template **UAT defect report**, or send the same fields through the
agreed channel and we will copy it into an Issue. Include the case ID, tested version, steps, expected result,
actual result, severity and evidence. We will reply with the triage decision in the Issue.

| Severity | Meaning (user impact) | Blocks Sprint 1 acceptance? |
|---|---|---|
| Critical | Data leak, security or authorization bypass, data loss, or the main journey is impossible | Yes. Must be fixed and re-tested |
| Major | A Sprint 1 acceptance criterion fails and there is no reasonable workaround | Yes. Must be fixed and re-tested |
| Minor | Cosmetic or wording issue, or a workaround exists; no AC is broken in substance | No. Fixed, or accepted by the UAT Team as a known limitation |

## 7. Not executable on the deployed release

These ACs are covered by automated tests in `server/tests/` (run with `npm test`) and are **not** part of the
manual UAT:

- deadline boundary (AC-02-05 exactly at the deadline, AC-02-06): the deadline is 31 Dec 2026;
- a different instructor (AC-01-08, part of AC-02-11): only one instructor account exists;
- an expired session (AC-01-05) and hash storage (AC-01-09).

## 8. Schedule (dates taken from GitHub)

| Session | Date / time | Who |
|---|---|---|
| Initial UAT (round 1, `c83a17a`) | 20 Nov 2026 (decision posted 07:23 UTC on #33) | UAT Team (jiraphat-j) |
| Round 2 on the exercise build `8e89112`, defect #36 reported | 20 Nov 2026, 16:22 (UTC+7) | UAT Team |
| Defect correction (#37 → release #38, `463411f`) | 20–23 Nov 2026 | Product Team (Film26, review jaruwan18) |
| Re-test and acceptance decision of `463411f` | _pending: UAT Team_ | UAT Team |
