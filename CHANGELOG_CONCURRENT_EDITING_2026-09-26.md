# Concurrent Editing Update – 2026-09-26

## Added
- Three-way server synchronization for concurrent multi-user edits.
- Field-level merge for different changes to the same school report or regional programme workbook.
- Explicit conflict records when two users change the same field concurrently.
- Sync Conflicts page for Team Leader review.
- Keep server value / use other auditor value actions.
- Lightweight live presence for users working on the same school or region.
- Server conflict audit entries and persistent conflict log.

## Behaviour
- Different fields changed by Auditor 1 and Auditor 2 are merged automatically.
- Exact same-field conflicts are not silently overwritten; they are recorded and surfaced for review.
- Existing evidence, reports and programme records remain compatible with the current data model.
