# User Feedback Update — 24 September 2026

## Changes implemented

### 1. Terminology
- Replaced the user-facing **Learners (total)** label with **Students (total)**.
- Replaced **Learners with disabilities** with **Students with disabilities**.
- Updated relevant user-facing evidence/question wording from learners to students.
- Kept the existing internal JavaScript/data field names (for example `learnersWithDisabilities`) to avoid breaking saved records and compatibility.

### 2. Student scope clarification
The School Profile now explains:
- **Students (total)** = all enrolled students recorded for the school.
- **Students with disabilities** = a subset of the total student population and should be entered separately.

### 3. Programme Workbook region-selection fix
The Programme Workbook now:
- Accepts a region by either region ID or region name and normalises it to the correct region ID.
- Treats an explicit `?region=` URL value as authoritative.
- Persists the selected region in the current browser session.
- Clears the in-memory programme record when the user changes region so the previous region's workbook cannot remain displayed.
- Re-displays the selected region in the workbook summary for visibility.
- Persists the selection when navigating between workbook tabs.

### 4. Cache update
All application pages were updated from asset version `v=6` to `v=7` so browsers do not continue using stale JavaScript/CSS after deployment.

## Acceptance test
1. Open Programme Workbook.
2. Select **Katavi**.
3. Move through multiple tabs.
4. Confirm the header and **Selected region** remain **Katavi**.
5. Change to **Rukwa**.
6. Confirm the workbook immediately switches to Rukwa and does not retain Katavi.
7. Refresh the page and confirm the selected region is retained for the current browser session.
8. Repeat with Songwe, Dar es Salaam (where applicable to future configuration), Mwanza (where applicable), and Dodoma (where applicable).

## Important compatibility note
The existing internal data keys have not been renamed. This means existing localStorage records remain readable while the interface adopts the clearer **Students** terminology.
