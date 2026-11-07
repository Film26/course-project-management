# Three-Sprint Plan
## Course Project Management System (CPMS)

| Item | Value |
|---|---|
| Team | 67070507202 (Film26) · 67070507216 (jaruwan18) |
| Document owner | 67070507202 · reviewed by 67070507216 |
| Related | `docs/srs.md`, `docs/features.md`, `docs/traceability.md` |

### Version history

| Version | Date | Author | Change |
|---|---|---|---|
| 0.1 | 2026-11-07 | 67070507202 | Initial plan for Sprints 1–3 |

---

## 1. Overview

| Sprint | Goal | Features | Checkpoint |
|---|---|---|---|
| **1** | A small working domain slice with authentication, permissions and persistence | F-01, F-02 | Deliverable 1: **8 Nov 2026** |
| **2** | The core course workflow completed under engineering contracts, plus deployment | F-03, F-04, F-05, F-06 | Deliverable 2: **29 Nov 2026** (Lab 5 deployment in this period) |
| **3** | Remaining features, integration and product hardening | F-07, F-08, F-09 + hardening | Progress at 29 Nov, complete by **13 Dec 2026** |

Together the three sprints cover the full baseline in `docs/srs.md`: FR-01 to FR-22, BR-01 to BR-13 and NFR-01 to NFR-11 (see `docs/features.md` §3).

## 2. Feature dependencies

```
 F-01 Auth & roles ─┬─► F-02 Proposal ─┬─► F-03 Team formation ──► F-07 Peer evaluation (S3)
   (S1)             │     (S1)         │     (S2)                    ▲
                    │                  ├─► F-05 Submission ─► F-06 Grading ─┐
                    └─► F-04 Milestones ──┘   (S2)            (S2)       │
                          (S2) ────────────────────────────────────────┘
                                         F-02, F-05, F-06 ─► F-08 Dashboard (S3)
                                         F-02, F-03, F-06 ─► F-09 Audit log (S3)
```

All features depend on F-01, because every endpoint uses its session, role and ownership middleware.

## 3. Sprint 1: Authentication and proposal workflow (Done)

| Item | Content |
|---|---|
| **Goal** | Deliver one complete domain journey (UI → API → database) with real login, two roles, a meaningful state transition, business-rule validation and automated tests. |
| **Features** | F-01 Authentication & role-based access (owner 67070507202); F-02 Project proposal workflow (owner 67070507216) |
| **Requirements** | FR-01 to FR-09 · BR-01 to BR-05 · NFR-01 to NFR-06 and NFR-09 established; NFR-07 checked by the teammate following the README |
| **Dependencies** | Baseline scaffold (pair work): stack, Prisma schema + migration, seed, test setup. F-02 depends on F-01. |
| **Work items** | Issue #1 → PR #3 (F-01), Issue #2 → PR #6 (F-02), PR #4 (SRS + SDS), Part B/D docs PRs, release PR #5 `sprint-1 → main` |
| **Completion outcome** | Release tag `v1.0-sprint1` on `main`. An Instructor and Students log in. A Student submits the team proposal, and the Instructor approves it or rejects it with a reason; the result is saved and can be read back. Rule violations (second active proposal, after deadline, invalid transition) return 409. Other roles and teams get 401/403. All unit, API/DB and E2E tests pass. |

### Why Sprint 1 is F-01 + F-02
1. **It is the smallest slice that meets every Sprint 1 requirement.** F-01 gives real login/logout, current user and two meaningful roles. F-02 gives the domain transaction: a state machine with business rules (BR-01 to BR-05) that touches the UI, the API and the database.
2. **Everything else depends on these two.** Every later feature needs F-01's access control. F-05, F-03 and F-09 need F-02's proposal state (only approved teams submit, membership locks after approval).
3. **It shows both kinds of access check.** Role checks (a Student cannot approve) and ownership checks (another team's proposal or another instructor's course → 403) are both tested through the API.
4. **The scope is safe for two people in the time available.** Teams are seeded (assumption A-02), so team formation (F-03) waits until Sprint 2. That keeps Sprint 1 to two features, one per student, which can be reviewed in parallel.

### Deferred from Sprint 1 (on purpose)
| Item | Moved to | Reason |
|---|---|---|
| BR-07 minimum team size before submit | S2 with F-03 | Team size is meaningful only once students form their own teams |
| BR-08 membership lock after approval | S2 with F-03 | Needs team join/leave (F-03) |
| Database constraint for BR-01 | S3 hardening (if feasible) | A partial unique index is not expressible in the Prisma schema; the rule is enforced by a transaction with a team row lock (F-02 contract §4) |
| Docker image, CI/CD, GCP deployment | Lab 5 / S2 | Explicitly due in Lab 5 |

## 4. Sprint 2: Core course workflow (planned)

| Item | Content |
|---|---|
| **Goal** | Complete the course project lifecycle (form a team → propose → deliver milestones → get graded) and deploy the product. |
| **Features** | F-03 Team formation, F-04 Course milestones, F-05 Deliverable submission, F-06 Grading & feedback |
| **Requirements** | FR-10 to FR-18 · BR-06 to BR-12 · NFR-05 (forced 500 test), NFR-08 (Docker + Cloud Run), NFR-11 (coverage ≥ 80 % for rule modules) |
| **Dependencies** | F-03 needs F-02 (BR-07 changes F-02 submit, BR-08 reads proposal status). F-05 needs F-02 + F-04. F-06 needs F-05. Lab 5 (Dockerfile, Cloud SQL, Cloud Run, CI) runs alongside. |
| **Proposed allocation** | 67070507202: F-04, F-06 · 67070507216: F-03, F-05 · pair: Lab 5 deployment |
| **Completion outcome** | Deliverable 2 release. Students form teams and submit milestone URLs. Late submissions are flagged. The Instructor grades, and students see released grades only. The app runs on Cloud Run with Cloud SQL. Every new endpoint has 401/403 API tests. |
| **Risks** | Lab 5 deployment work competes for time with the feature work; mitigated by keeping submissions as URLs (D-06). |

## 5. Sprint 3: Remaining features and hardening (planned)

| Item | Content |
|---|---|
| **Goal** | Add the remaining features, integrate the whole product and harden it for the final demo. |
| **Features** | F-07 Peer evaluation, F-08 Course dashboard, F-09 Audit log |
| **Requirements** | FR-19 to FR-22 · BR-13 · NFR-10 (p95 < 500 ms with 50 teams), NFR-07 rechecked, NFR-11 rechecked |
| **Hardening** | Login rate limiting, cleanup of expired sessions, a DB-level guard for BR-01 if feasible, a full regression E2E across all roles, and accessibility checks on forms. |
| **Dependencies** | F-07 needs F-03 + F-04. F-08 needs F-02, F-05 and F-06. F-09 hooks into F-02, F-03 and F-06. |
| **Proposed allocation** | 67070507202: F-08, performance test · 67070507216: F-07, F-09 · pair: regression and final demo video |
| **Completion outcome** | Final release by 13 Dec: all FR/BR implemented and traced to passing tests, performance target measured and the final demonstration video recorded. |

## 6. Definition of Done for every sprint

A sprint is complete only when, for every feature in it:
1. a contract (design, AC, STS) was committed **before** implementation;
2. its tests run, and the red → green evidence for rule work is kept;
3. the PR into the sprint branch was reviewed by the other student with a specific comment;
4. all tests pass on the sprint branch, and the release PR into `main` is reviewed and tagged;
5. the README, the documents and the traceability are current, and incomplete work is disclosed.
