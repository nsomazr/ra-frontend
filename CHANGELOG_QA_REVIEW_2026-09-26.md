# QA Review & Consolidation — 2026-09-26

- Consolidated the concurrent editing build with draft/in-progress report deletion.
- Added synchronized deletion tombstones to the multi-user sync model so an offline draft deletion is not resurrected by an older device copy.
- Kept team-wide Evidence Library access.
- Fixed the server login response so password verifiers are never returned to the browser.
- Added first-run administrator bootstrap using `P10354_ADMIN_USERNAME` / `P10354_ADMIN_PASSWORD` when the server has no users.
- Preserved offline login by generating a local PBKDF2 verifier after successful online authentication.
- Ran JavaScript syntax checks and server/API integration tests.
- Verified static page references and core API endpoints.

- Bumped the browser/service-worker cache version to v12 so field devices load the consolidated build.
