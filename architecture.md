# P10354 field assessment system — architecture

REET Limited · CBM Tanzania · Project P10354, *Take All My Friends to School*.

The field-facing app is vanilla HTML/CSS/JavaScript with no build step, so it can be
copied onto a tablet and opened from the filesystem in a school with no connectivity.
It is a **field client**, not a system of record: it must be connected to the server API
below before it holds real assessment data.

## File map

| File | Role |
| --- | --- |
| `framework.js` | The assessment framework as data: rating scales, results, verification questions, school roster with the 2025 accessibility baselines, activities, DAC criteria, reconciliation items. Read-only. |
| `data.js` | Storage layer — localStorage for structured records, IndexedDB for evidence blobs. Record factories, schema migration, backfill. |
| `app.js` | Shared UI library (`UI`) and scoring rules (`Scoring`). Page chrome, form controls, record cards, registers, CSV export, progress and triangulation checks. |
| `dashboard.js` / `assessment.js` / `programme.js` / `review.js` / `admin.js` / `consent.js` | One page controller each. |
| `database-schema.sql` | The authoritative relational model the API must own. |

`framework.js` is deliberately separate from the code that renders it. Amending the
assessment instrument means editing one data file, and every page — plus the CSV
exports and the SQL reference tables — follows.

## Why the framework lives in data

Each structure in `framework.js` carries a source tag naming where it was transcribed
from — `[CL nn]` for a checklist sheet, `[AA]` for the 2025 accessibility audit, `[QNR]`
for the quarterly narrative report, `[BMZ]` for the narrative interim report, `[PR]` for
the proposal. That traceability is the point: a reviewer can take any field in the app
and follow it back to the document it came from. Nothing in the framework is invented.
Where the source material is incomplete or self-contradictory, the gap is recorded as a
reconciliation item rather than filled with an assumption.

### Source documents

| Source | What it supplies |
| --- | --- |
| Region assessment checklists (Katavi, Rukwa) | The 24-sheet instrument: results matrix, verification questions, DAC review, baseline-to-now, sustainability, VFM, evidence map |
| 2025 Accessibility Audit (Eng. Kesha William Chinguku, CST/ADM/BMZ/2025/005) | All 18 schools: councils, wards, enrolment, children with disabilities, disability categories, per-school findings, planned modifications, and the technical standards the retest measures against |
| Quarterly Narrative Report, Q1 2025 | CST's own activity codes and the reported figures this assessment tests |
| BMZ Narrative Interim Report (Annex 4, Jan–Jun 2025) | Project duration, start and end dates, confirmation of the three regions |
| REET proposal | Grading vocabulary, four evidence streams, triangulation rule, deliverables and gates |

### CST's reported claims are pre-loaded

Each activity in `framework.js` carries a `reported` field holding what CST has claimed
in its own reporting, and a `verify` field saying how to test it. They render as
read-only context on the activity card so an auditor arrives at a school verifying a
specific figure — "91 teachers trained, 5 per school, 91 IEPs created" — rather than
filling an empty box. A pre-loaded claim is the thing being tested; it is never evidence
that the activity happened.

## Rules the system enforces

These come from the assessment instruments, not from UI preference. They are
implemented in `Scoring` and must be re-implemented server-side, because a control
enforced only in the browser is not a control.

1. **Triangulation.** A question marked ASSESSED must cite at least two of the four
   evidence streams (documentation, field evidence, stakeholder testimony, financial
   records). Single-source findings are flagged at submission and in the master sheet.
2. **NV is not zero.** Achievement and quality are stored as `'0'`–`'4'` or `'NV'`.
   Never coerce "not verifiable" into "not achieved"; it changes what the report claims.
3. **Discrepancies survive.** Two auditors assess independently. Where their grades
   differ, both are retained and the Team Leader records a final grade with a written
   rationale. Nothing is overwritten.
4. **Consent gates interviews.** An interview cannot be linked to a report without a
   cleared, un-withdrawn consent record. Child engagement needs caregiver consent *and*
   the child's own assent.
5. **Unconfirmed rosters cannot be graded.** All 18 schools are now confirmed, so this
   control is dormant — it stays in place for any school added later without a
   verified record.
6. **Contested figures block final percentages.** The twelve reconciliation items are
   project-wide contradictions across the PPA, the kick-off materials, the proposal, the
   2025 audit and CST's own reporting. Achievement rates calculated against a disputed
   denominator are not defensible, so the system tracks them and warns until agreed.
7. **Evidence is never deleted in the field.** Detaching an evidence item removes the
   reference from the report; the blob stays in the local sync queue.

## User-feedback update — September 2026

The Programme Workbook now persists the selected region in the current browser session and treats the URL selection as authoritative when supplied. Region names are normalised by ID/name, and switching regions clears the in-memory workbook instance so data from a previous region cannot remain displayed after a selection change. The assessment interface uses **Students** as the user-facing term and explicitly defines students with disabilities as a subset of the total student population.

## Scope: the regions question, resolved

The proposal names **Mbeya, Songwe and Katavi**. Three CST/CBM documents — the 2025
accessibility audit, the Q1 2025 QNR and the BMZ narrative interim report — all give
**Songwe, Rukwa and Katavi**, and all 18 project schools sit in those three regions
across nine councils (Tunduma, Ileje, Momba; Kalambo, Sumbawanga MC, Sumbawanga DC;
Mpanda, Mpimbwe, Nsimbo). Mbeya holds no project school.

The evidence is one-sided, so the system treats Songwe, Rukwa and Katavi as the regions
of delivery and keeps Mbeya on the roster page marked out of scope, so the discrepancy
stays visible. RC-07 records it for written confirmation with CBM at inception — the
itinerary and budget in the proposal are built around the wrong region list.

## Findings the documents produced before fieldwork started

Reconciling the sources surfaced issues that are themselves assessment findings:

- **18 schools to be modified, 10 selected.** The PPA and the audit cover 18 schools;
  the Q1 2025 QNR reports preparing renovations for ten. Eight schools may receive
  nothing. (RC-11)
- **Three different teacher denominators.** 91 trained, 270 to be mentored, 360 in the
  PPA. (RC-12)
- **Category counts that do not sum.** Sogea's disability categories total 28 against a
  stated 30; Msanzi A lists "II" twice and totals 22 against a stated 20. (RC-09)
- **Two schools that may not be inclusive settings at all.** Malangali records 100
  children with disabilities out of 105 pupils; Maji Moto records 50 of 50. (RC-10)
- **Name variants across sources.** Msia/Nsia, Chiwezi/Chiyezi, Matai A/Matai B,
  Kawajense/Kiwajense. (RC-08)

## What must move server-side before production

The browser app is not safe to run against real data as-is. Everything below is
required, not optional.

- **Authentication.** Server-side Argon2id or bcrypt password hashing; httpOnly, secure,
  SameSite session cookies or short-lived access tokens with refresh; rate limiting;
  lockout after failed attempts; password-reset tokens with expiry; session invalidation
  via `session_version`. The SHA-256 hashing in `admin.js` and `change-password.js` is a
  local prototype convenience and is labelled as such in the UI. `login.html` ships
  without a password form on purpose: a static site cannot authenticate anyone safely.
- **Authorization.** Enforce every role on every route — Team Leader, auditor,
  disability inclusion, finance/compliance, procurement, research associate, data
  analyst, safeguarding lead, admin, CBM viewer. Hiding a control in the browser is not
  a permission check.
- **The integrity rules above.** All seven, in the API. The client-side versions are a
  usability affordance for the field team, nothing more.
- **Restricted data.** Child journey rows, consent records, interviews and safeguarding
  referrals belong behind separate routes with their own authorization, and must be
  excluded from viewer and dashboard exports by default. Safeguarding referral payloads
  are encrypted at rest; incident detail never enters the assessment workbook.
- **Offline sync.** Encrypt evidence blobs in IndexedDB, keep a pending-sync queue, sync
  through the authenticated API when connectivity returns, and never drop local evidence
  after a failed sync. Reports carry a `version`; the server resolves conflicts and
  writes both sides to the audit log rather than last-write-wins.
- **Audit log.** Append-only, server-side, for every change to a submitted, reviewed or
  approved record. `REVOKE UPDATE, DELETE` as in the schema.
- **Data protection.** Handle personal data in line with Tanzania's Personal Data
  Protection Act; encrypt at rest and in transit; restrict access by role; retain
  anonymised interview records only.

## Local data and migration

`data.js` holds `SCHEMA_VERSION`. Records from earlier versions used an ad-hoc
commitment list that the approved checklists supersede; rather than discard field data,
migration parks the old reports under `legacy` and the dashboard offers them as a JSON
download. New records start on the current model. Framework growth (a new question, a
new audit area) is handled by `backfillReport` / `getProgramme`, which add missing
records without touching anything already entered.

Asset URLs carry a `?v=` version so a field tablet picks up an update instead of running
a cached copy of the previous release. Bump it on every deployment.

## Included server/API synchronization service (2026-09-24)

The current package now includes a Node.js server under `server/server.js`. It serves the web application and exposes the synchronization API used by the offline field client.

- `GET /api/health` — service health and current server version.
- `POST /api/sync/push` — uploads the local project/report/programme/consent snapshot.
- `POST /api/sync/pull` — retrieves the current server snapshot.
- `POST /api/evidence/:id` — uploads evidence files saved during fieldwork.
- `GET /api/evidence` and `GET /api/evidence/:id` — lists/downloads server evidence.

The browser client automatically attempts synchronization when the device comes online, every 60 seconds, after saved changes, and when the user clicks the sync status button. The server keeps five recent state backups and writes synchronization events to `server/data/audit.jsonl`.

The sync service uses record-level reconciliation based on `updatedAt` when more than one device has changed data. The client shows sync errors and pending changes rather than silently discarding them.

For deployment, run the included `start-server.bat` on Windows or `node server/server.js`. Set `P10354_API_KEY` and use HTTPS/reverse-proxy authentication for a protected production deployment.
