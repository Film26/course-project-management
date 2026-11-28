# Lab 7 — Manual test on the deployed release (jaruwan18)

Deployed URL https://cpms-t4xsm3f7aa-as.a.run.app · release `v2.1-lab7` (`f0142cd`) · Cloud Run `cpms-00008-vtz`.
Tester: jaruwan18. Date: **28 Nov 2026, 18:20–18:41 (Asia/Bangkok)**. Browser: Google Chrome (MT-2, MT-6; also the Claude desktop built-in browser for other steps).
Accounts: synthetic seed accounts (`student3`, `student5`, `student6`, `instructor1` @cpms.test); no password is recorded.
Original notes of the tester (Thai, join code redacted): [`jaruwan18-results-original.md`](jaruwan18-results-original.md).

| ID | Step | Expected | Result | Evidence |
|---|---|---|---|---|
| MT-1 | Team Beta (`student3`): submit "Team Beta - Lab 7 Manual Test" | SUBMITTED, *Withdraw submission* shown | **PASS** (18:22) | `L7-M1-submitted.png` |
| MT-2 | *Withdraw submission* → OK | DRAFT; can submit again | **PASS** (18:25); confirmation text correct | tester notes (no screenshot) |
| MT-3 | edit the title, submit again | SUBMITTED with the new title | **Incomplete** (18:30): withdraw / submit again worked, but the title was not changed, so the new-title display was not checked. Not a defect. Covered by E2E TEST-02-24 (instructor sees the new title, L7-2, L7-3) | tester notes |
| MT-4 | Team Gamma (`student5` + `student6`, created for this test): instructor rejects with an empty reason | refused, reason required | **PASS**: "A reason is required", status stays SUBMITTED | `L7-M4-reject-needs-reason.png` |
| MT-5 | reject with a reason | REJECTED, reason shown | **PASS**: REJECTED, "Decided 28 Nov 2026 18:40 by Instructor One", reason shown | `L7-M5-rejected.png` |
| MT-6 | instructor approves | APPROVED | **PASS** (18:30), Team Beta proposal of MT-1…3 (order differs from the plan) | tester notes (no screenshot) |

**Summary:** 5 PASS, 1 incomplete (MT-3), 0 FAIL. No defect found.

**Limitations of this evidence**
- Screenshots exist for MT-1, MT-4, MT-5 only; MT-2, MT-3, MT-6 rely on the tester's written notes. The screenshots do not show the computer clock; times are the tester's notes, and MT-5 shows the decision time on the page.
- `L7-M5-rejected.png` is a **composite**: the page header was joined to the proposal card by the tester (stated by the tester). No content was changed.
- The Claude desktop built-in browser dismisses `window.confirm()` (returns Cancel), so the withdraw step had to be done in Chrome. This is a limitation of the test tool, not of CPMS.
- Test data left on production: Team Beta proposal APPROVED; Team Gamma (`student5`, `student6`) with a REJECTED proposal (synthetic data).
