# Login Fix — 26 September 2026

## Problem
The REET-branded build displayed a sign-in page, but the page did not contain a working username/password form. The earlier `login.js` therefore could not authenticate users, and users received an incorrect-login experience.

## Changes
- Added a working username/password sign-in form to `login.html`.
- Added online authentication through `POST /api/auth/login`.
- Added offline/local authentication for accounts already stored on the device.
- Usernames are trimmed and matched case-insensitively.
- Added clear login error messages.
- New passwords created by the Administration page use PBKDF2-SHA256 with a per-user salt.
- Legacy prototype SHA-256 accounts are upgraded to PBKDF2 after a successful local login.
- Added server-side user provisioning endpoint for accounts created in Administration.
- Added server-side password update endpoint for the initial password-change flow.
- Added basic login-attempt throttling on the server.
- Updated service-worker cache version to ensure the corrected login page and scripts load.

## Result
Users created by the administrator can now sign in using the credentials assigned to them. When the API is available, the server is preferred; when the user is offline, an account already available on the device can still sign in.
