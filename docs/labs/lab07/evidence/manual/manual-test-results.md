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

**Summary (jaruwan18, manual):** 5 PASS, 1 incomplete (MT-3), 0 FAIL. No defect found.

## Completion run — MT-2, MT-3, MT-6 with screenshots (automated browser, not manual)

Run by **Claude Code with Playwright (Chromium, headless) for Film26** on the deployed URL, **28 Nov 2026 11:58 UTC (18:58 Bangkok)**, release `f0142cd` / `cpms-00008-vtz`, because the manual run left MT-3 incomplete and MT-2 / MT-6 without screenshots. Script `docs/labs/lab07/manual-complete-prod.mjs` (password read from a temporary file outside the repository, deleted after the run); full timestamped log [`claude-playwright-MT2-MT3-MT6.txt`](claude-playwright-MT2-MT3-MT6.txt).

| ID | Step (Team Gamma, `student5`, then `instructor1`) | Expected | Actual | Evidence |
|---|---|---|---|---|
| MT-1 | new proposal "Team Gamma - Lab 7" → Submit (the earlier Team Gamma proposal is REJECTED, so a new one is allowed) | SUBMITTED, *Withdraw submission* shown | SUBMITTED 11:58:32 | `L7-C1-submitted.png` |
| MT-2 | *Withdraw submission* → confirm "Withdraw this submission? …" → OK | DRAFT, button gone, edit form shown | DRAFT 11:58:32, button count 0 | `L7-C2-withdrawn-draft.png` |
| MT-3 | title → "Team Gamma - Lab 7 v2" → Save draft → Submit | SUBMITTED with the new title; instructor sees only v2 | student: SUBMITTED, title "Team Gamma - Lab 7 v2"; instructor (filter Submitted): 1 row "Team Gamma - Lab 7 v2", SUBMITTED, "Submitted: 28 Nov 2026, 18:58" | `L7-C3-resubmitted-v2-student.png`, `L7-C3-resubmitted-v2-instructor.png` |
| MT-6 | instructor, filter Approved (view only) | "Team Beta - Lab 7 Manual Test" APPROVED | APPROVED, "Decided: 28 Nov 2026, 18:30 by Instructor One" | `L7-C6-approved.png` |

**Result: all steps PASS.** Combined with the manual run: MT-1 … MT-6 all PASS on the deployed release, 0 FAIL.
The student screenshots show the join code of the synthetic Team Gamma (test data only).

## Screenshot run — MT-1, MT-4, MT-5 (automated browser, not manual)

The manual screenshots of jaruwan18 for MT-1, MT-4 and MT-5 were not supplied to the repository, so the same steps were captured by **Claude Code with Playwright for Film26** on **28 Nov 2026 12:14 UTC (19:14 Bangkok)** on revision `cpms-00009-2ft` (`/api/version` = `f0599f6`; same application code as `f0142cd`, see `../post-deploy-f0599f6.txt`). Script `docs/labs/lab07/manual-complete-prod-2.mjs`; log [`claude-playwright-MT1-MT4-MT5.txt`](claude-playwright-MT1-MT4-MT5.txt).

| ID | Step | Expected | Actual | Evidence |
|---|---|---|---|---|
| MT-1 | `student5` opens the team page with "Team Gamma - Lab 7 v2" submitted | SUBMITTED + *Withdraw submission* | as expected, 1 Withdraw button | `L7-C7-MT1-submitted.png` |
| MT-4 | `instructor1`, filter Submitted → Reject → *Confirm reject* with an empty reason | refused | "A reason is required", status stays SUBMITTED | `L7-C8-MT4-reject-needs-reason.png` |
| MT-5 | enter a reason → *Confirm reject* | REJECTED, reason stored and shown | instructor: REJECTED, "Decided: 28 Nov 2026, 19:14 by Instructor One"; student: banner and History show the reason | `L7-C9-MT5-rejected-instructor.png`, `L7-C9-MT5-rejected-student.png` |

**Result: all steps PASS.** Every selected user test MT-1 … MT-6 now has a passing result and a screenshot on the deployed application.

**Limitations of this evidence**
- Screenshots exist for MT-1, MT-4, MT-5 only; MT-2, MT-3, MT-6 rely on the tester's written notes. The screenshots do not show the computer clock; times are the tester's notes, and MT-5 shows the decision time on the page.
- `L7-M5-rejected.png` is a **composite**: the page header was joined to the proposal card by the tester (stated by the tester). No content was changed.
- The Claude desktop built-in browser dismisses `window.confirm()` (returns Cancel), so the withdraw step had to be done in Chrome. This is a limitation of the test tool, not of CPMS.
- Test data left on production: Team Beta proposal APPROVED; Team Gamma (`student5`, `student6`) with two REJECTED proposals ("… Reject Test", "… Lab 7 v2") (synthetic data).
