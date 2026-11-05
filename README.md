# Course Project Management System

CPE 334 group project — a system for instructors and students to manage course projects
(teams, project proposals, review and approval).

## Branching workflow

| Branch | Purpose |
|---|---|
| `main` | Accepted releases only (tagged, e.g. `v1.0-sprint1`) |
| `sprint-1` | Sprint 1 staging / integration branch |
| `feature/F-xx-short-name` | Feature work, branched from the current sprint branch |

1. Pick or open a GitHub Issue for the feature (`F-xx`).
2. Branch from `sprint-1`: `git switch sprint-1 && git pull && git switch -c feature/F-01-auth`
3. Commit the feature contract (spec / AC / STS) **before** implementation.
4. Open a PR into `sprint-1`, link the Issue (`Closes #n`), and request review from your teammate.
   Authors never approve their own PRs.
5. After Sprint 1 integration and acceptance checks, open a release PR `sprint-1` → `main` and tag it.

## Documentation

See [`docs/`](docs/) — SRS, features, traceability, system SDS, sprint plan and Sprint 1 contracts.

## Local setup

_To be completed once the stack is set up (dependencies, environment variables,
database migration/seed, run/build/test commands)._
