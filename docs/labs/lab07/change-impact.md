# Lab 7 — Change Impact Analysis: withdraw a submitted proposal (Issue #74)

| Item | Value |
|---|---|
| Team | 67070507202 น.ส.ทรรศน์วรรณ นามกา (Film26) · 67070507216 น.ส.จารุวรรณ อินคา (jaruwan18) |
| Change request | Issue #74 — BR-03: add `SUBMITTED → DRAFT` (withdraw) by a team member before the deadline |
| Approval | **Approved verbally by the course instructor, อาจารย์สุเทพ** (stated that TA approval is not needed). Recorded by Film26 on 27 Nov 2026 in Issue #74, before the RED commit; no written message exists, and the exact date of the instructor's statement is as reported by Film26 |
| Accepted Sprint 1 baseline | `v1.0-sprint1` → `18a3cd9` (old rule implemented here; UAT round 1 accepted on `c83a17a`) |
| Actual pre-change implementation | `main` @ `ae801be` (`d2-candidate`), deployed `cpms-00007-zhs`; branch base `24a95a4` = same tree as `ae801be` |
| Author / reviewer | Film26 / **jaruwan18 — reviews this document and the contract revision before any code is written** |

## 1. Old and new rule

| | Old (Sprint 1, BR-03) | New (F-02 contract v1.6) |
|---|---|---|
| `SUBMITTED → DRAFT` | not allowed → 409 `INVALID_TRANSITION` | allowed for a **member of the team** while `SUBMITTED` and `now ≤ proposalDeadline` |
| Boundary | — | exactly at the deadline → allowed; deadline + 1 ms → 409 `DEADLINE_PASSED` |
| After a decision | final | still final: `APPROVED` / `REJECTED` → 409 `INVALID_TRANSITION` |
| Who | — | STUDENT team member only; instructor, other instructor, other team → 403 |
| Data effect | — | `status = DRAFT`, `submittedAt = null`; title, description, `decidedAt/decidedBy/rejectReason` stay null; no new row |

## 2. Impact table

| Requirement | Feature | Document / section affected | AC | STS | Code module | Change |
|---|---|---|---|---|---|---|
| BR-03 | F-02 | SRS §5 BR-03 (v0.4) | AC-02-07 (revised), AC-02-15, AC-02-16 | TEST-02-01 (revised: 4 allowed pairs), TEST-02-21, TEST-02-22 | `server/src/proposals/rules.js` (`TRANSITIONS`) | add `SUBMITTED → DRAFT` |
| BR-02 (deadline) | F-02 | F-02 contract P2 / new P9 | AC-02-15, AC-02-16 | TEST-02-02 (unchanged, reused); TEST-02-22 (a) service boundary `now = D` / `D + 1 ms`, (b) API ±1 minute | `rules.js` `isBeforeDeadline` (reused); `withdrawProposal(id, user, now)` takes `now` like `submitProposal` | none in the rule; called by withdraw. The exact boundary is tested at the service level because the route uses the server clock |
| BR-05 (ownership) | F-02 | F-02 contract P6, SRS BR-05 ("withdraw" added), System SDS §5 (new row) | AC-02-17 | TEST-02-23 | `proposals/service.js` (`loadForMember`), `routes/proposals.js` (new route, `requireRole('STUDENT')`) | new endpoint `POST /api/proposals/:id/withdraw` |
| FR-05 / FR-06 | F-02 | F-02 contract §5 UI | AC-02-18 (UI) | TEST-02-24 (E2E) | `client/src/pages/TeamProposalPage.jsx`; the call uses the generic `api()` helper in `client/src/api.js` (no per-endpoint functions there, so `api.js` itself does not change) | "Withdraw submission" button on a `SUBMITTED` proposal |
| FR-08 (instructor decides) | F-02 | F-02 contract §5 review page row (v1.7) | AC-02-19 | TEST-02-25 (API + E2E) | `client/src/pages/ProposalReviewPage.jsx` (`decide`: on 409 `INVALID_TRANSITION` show the message and reload the list) | a list left open can show a proposal that was withdrawn meanwhile; Approve/Reject then gets 409, the page explains it and refreshes; no audit entry for the refused decision |
| NFR-06 (no partial data) | SR-02 | F-02 contract P3 | AC-02-16, AC-02-17 | TEST-02-22, 02-23, 02-25 check the DB (and, for 02-25, the audit table) after every refusal | `service.js`: conditional update `WHERE status = 'SUBMITTED'` | race with approve/reject: whichever runs first wins; the other gets 409 |
| FR-22 (audit) | F-09 | — | AC-02-19 | TEST-02-25 (no audit row for a refused decision) | — | **N/A for the withdraw itself:** FR-22 records decisions, grade releases and membership changes; a withdraw is none of these (Issue #74 scope). **Known limitation:** after a withdrawal `submittedAt` is null and nothing shows that the team had submitted; recorded as technical debt for Lab 7 Part D |
| BR-07 / BR-08 | F-03 | — | — | TEST-03-13/13b (regression) | — | **N/A:** a withdrawn proposal is `DRAFT`; submit checks BR-07 again; BR-08 locks only at `APPROVED` |
| F-08 / F-05 / F-06 | S2/S3 | — | — | regression suite | — | **N/A:** they read `APPROVED` proposals only (BR-10); `DRAFT/SUBMITTED` are not used |
| Data / migration | — | — | — | — | — | **N/A:** no schema change (`status` enum already has `DRAFT`; `submittedAt` is nullable). Historical data: no existing row changes |
| UI validation | — | — | — | — | — | button shown only for `SUBMITTED`; the API decides (403/409) |

## 3. Behaviour that must stay unchanged and how it is protected

| Unchanged behaviour | Regression tests (existing) |
|---|---|
| Create / edit / submit / approve / reject and their errors (AC-02-01 … 02-14) | TEST-02-03 … 02-19 (`proposal.unit`, `proposal.api`), TEST-02-20/20b (E2E) |
| One active proposal per team (BR-01) — a withdrawn proposal is still the active one | TEST-02-06, 02-08 |
| Submit deadline (BR-02) and boundary | TEST-02-02, 02-12 |
| Reject reason (BR-04, #36) | TEST-02-04, 02-15, 02-15b |
| Ownership and 401 (BR-05, NFR-02/03) | TEST-02-16 … 02-18 |
| BR-07 at submit and approve, BR-08 lock | TEST-03-13, 03-13b/c, 03-12 |
| Audit entry on decisions (F-09) | TEST-09-03 … 09-07 |

Review of this document: PR #77, jaruwan18, 27 Nov 2026 — *Request changes* (boundary test, instructor page, traceability, approval record); fixed in the next commit (contract v1.7).

The only existing expected result that changes is **TEST-02-01**: `canTransition('SUBMITTED', 'DRAFT')` becomes `true`. This is the approved requirement change (contract v1.6); the other 15 pairs keep their expected results.

## 4. Plan (order recorded in Git)
1. Issue #74 (change request) → this document + contract/SRS/SDS revisions (**docs only**) → **review by jaruwan18 before code**
2. RED commit: TEST-02-01 (revised) + TEST-02-21 … 02-25 run against the pre-change code (`ae801be` tree) — must fail because withdraw does not exist
3. GREEN commit: `rules.js`, `service.js`, `routes/proposals.js`, UI button
4. PR into `sprint-3` (review jaruwan18) → `staging` → `main`, deploy, post-deploy checks of the changed behaviour and of a preserved Sprint 1 path
