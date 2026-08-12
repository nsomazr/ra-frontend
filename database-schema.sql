-- ============================================================================
-- P10354 External Programmatic Assessment — PostgreSQL schema.
--
-- The browser app uses localStorage + IndexedDB as an offline field cache only.
-- This is the authoritative model the API must own. Table and column names
-- follow the assessment instruments so a reviewer can map any field back to
-- the checklist sheet it came from; sheet names are given in comments.
--
-- Conventions:
--   * Enumerations are CHECK constraints rather than PG enums, because the
--     assessment vocabulary is fixed by the approved instruments and a change
--     is a documented amendment, not a migration convenience.
--   * Achievement/quality scores are stored as text ('0'..'4','NV') exactly as
--     scored. Never coerce 'NV' to 0 — "not verifiable" is not "not achieved".
--   * Anything that identifies a child lives in a restricted table with its own
--     API routes and is excluded from viewer/dashboard exports by default.
-- ============================================================================

-- ---------------------------------------------------------------------------
-- Reference data (mirrors framework.js; seeded, not user-editable in the field)
-- ---------------------------------------------------------------------------

CREATE TABLE regions (
  region_id      text PRIMARY KEY,                       -- KATAVI, RUKWA, SONGWE, MBEYA
  region_name    text NOT NULL,
  in_scope       boolean NOT NULL DEFAULT false,
  roster_status  text NOT NULL CHECK (roster_status IN ('CONFIRMED','UNCONFIRMED')),
  scope_note     text
);

CREATE TABLE schools (                                   -- [CL 03] school profile
  school_id            text PRIMARY KEY,
  region_id            text NOT NULL REFERENCES regions,
  school_name          text NOT NULL,
  name_variant         text,                             -- alternate spelling on file; see RC-05
  council              text,
  ward                 text,
  roster_status        text NOT NULL CHECK (roster_status IN ('CONFIRMED','UNCONFIRMED')),
  pupils               integer,                          -- [CL 24] snapshot
  learners_with_disabilities integer,
  disability_categories text,
  audit_headline       text,                             -- [CL 24] 2025 audit summary
  audit_baseline       text,                             -- [CL 03] 2025 baseline
  planned_modification text,                             -- [CL 03] planned works
  assessment_focus     text,
  priority             text,
  active               boolean NOT NULL DEFAULT true
);

CREATE TABLE school_accessibility_areas (                -- [CL 17] retest rows
  area_id        uuid PRIMARY KEY,
  school_id      text NOT NULL REFERENCES schools,
  area_name      text NOT NULL,                          -- e.g. 'Toilets', 'Ramps / circulation'
  audit_recommendation text NOT NULL,                    -- the 2025 audit recommendation
  UNIQUE (school_id, area_name)
);

CREATE TABLE results (                                   -- [CL 02] results matrix
  result_id      text PRIMARY KEY,                       -- R1..R5, XC
  result_name    text NOT NULL,
  intent         text,
  indicators     text,
  project_target text,
  check_in_field text,
  evidence_to_request text
);

CREATE TABLE verification_questions (                    -- [CL 04] field assessment
  question_id    text PRIMARY KEY,                       -- FV-01..FV-22
  result_id      text NOT NULL REFERENCES results,
  area           text NOT NULL,
  question       text NOT NULL,
  planned_standard text
);

CREATE TABLE evidence_streams (                          -- Proposal Appendix B
  stream_id      text PRIMARY KEY,                       -- DOC, FIELD, TESTIMONY, FINANCIAL
  stream_name    text NOT NULL,
  detail         text
);

-- ---------------------------------------------------------------------------
-- Identity and access
-- ---------------------------------------------------------------------------

CREATE TABLE users (
  user_id        uuid PRIMARY KEY,
  username       text UNIQUE NOT NULL,
  full_name      text NOT NULL,
  staff_id       text,
  email          text,
  phone          text,
  -- Argon2id (preferred) or bcrypt, computed server-side. The browser never
  -- hashes or stores a password in production.
  password_hash  text NOT NULL,
  must_change_password boolean NOT NULL DEFAULT true,
  failed_attempts integer NOT NULL DEFAULT 0,
  locked_until   timestamptz,
  last_login_at  timestamptz,
  password_reset_token_hash text,
  password_reset_expires_at timestamptz,
  session_version integer NOT NULL DEFAULT 1,            -- bump to invalidate sessions
  home_region_id text REFERENCES regions,
  active         boolean NOT NULL DEFAULT true,
  created_at     timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE roles (
  role_id        text PRIMARY KEY,                       -- TEAM_LEADER, AUDITOR, DISABILITY_INCLUSION,
  role_name      text NOT NULL                           -- FINANCE_COMPLIANCE, PROCUREMENT, RESEARCH_ASSOCIATE,
);                                                       -- DATA_ANALYST, SAFEGUARDING_LEAD, ADMIN, CBM_VIEWER

CREATE TABLE user_roles (
  user_id        uuid REFERENCES users,
  role_id        text REFERENCES roles,
  PRIMARY KEY (user_id, role_id)
);

CREATE TABLE school_assignments (
  assignment_id  uuid PRIMARY KEY,
  school_id      text NOT NULL REFERENCES schools,
  user_id        uuid NOT NULL REFERENCES users,
  assignment_role text NOT NULL CHECK (assignment_role IN ('AUDITOR_1','AUDITOR_2','FIELD_AGENT','TEAM_LEADER','SAFEGUARDING_LEAD')),
  active         boolean NOT NULL DEFAULT true,
  assigned_at    timestamptz NOT NULL DEFAULT now(),
  UNIQUE (school_id, user_id, assignment_role)
);

-- ---------------------------------------------------------------------------
-- Project level: the contested figures that gate any achievement percentage
-- [CL 10] Data reconciliation. Project-wide, not per region: agreed once.
-- ---------------------------------------------------------------------------

CREATE TABLE reconciliation_items (
  item_id        text PRIMARY KEY,                       -- RC-01..RC-08
  issue          text NOT NULL,
  source_a       text,
  source_b       text,
  why_it_matters text,
  required_action text
);

CREATE TABLE reconciliation_resolutions (
  item_id        text PRIMARY KEY REFERENCES reconciliation_items,
  status         text NOT NULL CHECK (status IN ('OPEN','IN PROGRESS','RESOLVED')) DEFAULT 'OPEN',
  agreed_value   text,
  resolved_by    uuid REFERENCES users,
  resolved_at    timestamptz,
  updated_at     timestamptz NOT NULL DEFAULT now()
);

-- ---------------------------------------------------------------------------
-- School reports
-- ---------------------------------------------------------------------------

CREATE TABLE school_reports (
  report_id      text PRIMARY KEY,                       -- CBM-P10354-KAT-KP-2026-001
  school_id      text NOT NULL REFERENCES schools,
  status         text NOT NULL CHECK (status IN (
                   'DRAFT','IN PROGRESS','READY FOR SUBMISSION','SUBMITTED',
                   'UNDER REVIEW','REQUIRES CLARIFICATION','QA APPROVED','FINALIZED')),
  version        integer NOT NULL DEFAULT 1,
  field_agent_id uuid REFERENCES users,
  auditor_1_id   uuid REFERENCES users,
  auditor_2_id   uuid REFERENCES users,
  team_leader_id uuid REFERENCES users,
  safeguarding_lead_id uuid REFERENCES users,
  visit_start    date,
  visit_end      date,
  gps_lat        numeric,
  gps_lng        numeric,
  head_teacher   text,
  focal_person   text,
  school_committee text,
  teachers_total integer,
  teachers_trained_ie integer,
  learners_total integer,
  learners_with_disabilities integer,
  girls_with_disabilities integer,
  roster_confirmed text,
  roster_note    text,
  overall_findings text,
  recommendations text,
  evidence_limitations text,
  created_at     timestamptz NOT NULL DEFAULT now(),
  updated_at     timestamptz NOT NULL DEFAULT now(),
  submitted_at   timestamptz,
  UNIQUE (school_id)                                     -- one consolidated report per school
);

CREATE TABLE report_results (                            -- [CL 02] per report × result
  report_id      text NOT NULL REFERENCES school_reports ON DELETE CASCADE,
  result_id      text NOT NULL REFERENCES results,
  regional_target text,
  achievement    text CHECK (achievement IN ('0','1','2','3','4','NV')),
  quality        text CHECK (quality IN ('0','1','2','3','4','NV')),
  evidence_strength text CHECK (evidence_strength IN ('STRONG','MODERATE','WEAK','NONE')),
  key_finding    text,
  recommendation text,
  contribution_judgement text,
  sustainability_note text,
  updated_at     timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (report_id, result_id)
);

CREATE TABLE report_questions (                          -- [CL 04] per report × question
  report_question_id uuid PRIMARY KEY,
  report_id      text NOT NULL REFERENCES school_reports ON DELETE CASCADE,
  question_id    text NOT NULL REFERENCES verification_questions,
  assessment_status text NOT NULL CHECK (assessment_status IN (
                   'NOT ASSESSED','IN PROGRESS','ASSESSED','NOT APPLICABLE','REQUIRES FOLLOW-UP')),
  reported_achievement text,                             -- what the project claims
  actual_finding text,                                   -- what we verified
  evidence_checked text,
  respondent_source text,
  achievement    text CHECK (achievement IN ('0','1','2','3','4','NV')),
  quality        text CHECK (quality IN ('0','1','2','3','4','NV')),
  issue_cause    text,
  effect_on_result text,
  recommendation text,
  document_reference text,
  -- Team Leader's final call. Kept separate from the auditor rows so a
  -- discrepancy is never overwritten, only adjudicated.
  final_verified text,
  final_grade    text CHECK (final_grade IN ('VERIFIED','PARTIALLY VERIFIED','DISPUTED','UNVERIFIED')),
  final_reviewer_id uuid REFERENCES users,
  final_rationale text,
  updated_at     timestamptz NOT NULL DEFAULT now(),
  UNIQUE (report_id, question_id)
);

CREATE TABLE report_question_streams (                   -- triangulation: >= 2 required
  report_question_id uuid NOT NULL REFERENCES report_questions ON DELETE CASCADE,
  stream_id      text NOT NULL REFERENCES evidence_streams,
  PRIMARY KEY (report_question_id, stream_id)
);

CREATE TABLE auditor_assessments (                       -- two independent assessments
  assessment_id  uuid PRIMARY KEY,
  report_question_id uuid NOT NULL REFERENCES report_questions ON DELETE CASCADE,
  auditor_slot   text NOT NULL CHECK (auditor_slot IN ('AUDITOR_1','AUDITOR_2')),
  auditor_id     uuid REFERENCES users,
  verified_value text,
  suggested_grade text CHECK (suggested_grade IN ('VERIFIED','PARTIALLY VERIFIED','DISPUTED','UNVERIFIED')),
  observations   text,
  submitted_at   timestamptz,
  UNIQUE (report_question_id, auditor_slot)
);

CREATE TABLE report_accessibility (                      -- [CL 17] accessibility retest
  report_accessibility_id uuid PRIMARY KEY,
  report_id      text NOT NULL REFERENCES school_reports ON DELETE CASCADE,
  area_id        uuid NOT NULL REFERENCES school_accessibility_areas,
  current_condition text,
  standard_check text,                                   -- measured gradient, widths, grab bars…
  accessible_in_practice text CHECK (accessible_in_practice IN ('YES','NO','PARTIAL','NOT VERIFIABLE')),
  tested_by      text,                                   -- who physically walked the route
  evidence_now   text,
  achievement    text CHECK (achievement IN ('0','1','2','3','4','NV')),
  quality        text CHECK (quality IN ('0','1','2','3','4','NV')),
  safety_risk    text CHECK (safety_risk IN ('NO','LOW','MEDIUM','HIGH — immediate action')),
  action_required text,
  updated_at     timestamptz NOT NULL DEFAULT now(),
  UNIQUE (report_id, area_id)
);

CREATE TABLE report_evidence_register (                  -- [CL 07] documents sighted
  evidence_record_id uuid PRIMARY KEY,
  report_id      text NOT NULL REFERENCES school_reports ON DELETE CASCADE,
  evidence_type  text,
  document_name  text,
  period         text,
  location       text,
  supports_indicator text,
  original_or_copy text,
  verified_with  text,
  consistency_check text CHECK (consistency_check IN ('CONSISTENT','MINOR DISCREPANCY','MATERIAL DISCREPANCY','NOT CHECKED')),
  stream_id      text REFERENCES evidence_streams,
  finding        text
);

CREATE TABLE report_findings (                           -- [CL 08] findings & recommendations
  finding_id     uuid PRIMARY KEY,
  report_id      text NOT NULL REFERENCES school_reports ON DELETE CASCADE,
  level          text,
  result_id      text REFERENCES results,
  finding        text NOT NULL,
  evidence_refs  text,
  root_cause     text,
  effect         text,
  severity       text CHECK (severity IN ('CRITICAL','HIGH','MEDIUM','LOW')),
  recommendation text,
  responsible_party text,
  timeframe      text,
  priority       text CHECK (priority IN ('HIGH','MEDIUM','LOW')),
  status         text NOT NULL CHECK (status IN ('OPEN','IN DISCUSSION','AGREED','CLOSED')) DEFAULT 'OPEN',
  created_at     timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE report_debriefs (                           -- [CL 22] daily debrief
  debrief_id     uuid PRIMARY KEY,
  report_id      text NOT NULL REFERENCES school_reports ON DELETE CASCADE,
  debrief_date   date,
  location       text,
  what_surprised text,
  what_changed_understanding text,
  child_level_issue text,
  system_level_issue text,
  follow_up      text,
  team_lead_notes text
);

-- ---------------------------------------------------------------------------
-- Evidence files. Blobs live in object storage; only the key is stored here.
-- A field action detaches a reference; it never deletes the object.
-- ---------------------------------------------------------------------------

CREATE TABLE evidence_files (
  evidence_id    uuid PRIMARY KEY,
  report_id      text NOT NULL REFERENCES school_reports,
  report_question_id uuid REFERENCES report_questions,
  report_accessibility_id uuid REFERENCES report_accessibility,
  uploader_id    uuid REFERENCES users,
  filename       text NOT NULL,
  storage_key    text NOT NULL,
  mime_type      text,
  byte_size      bigint,
  description    text,
  stream_id      text REFERENCES evidence_streams,
  gps_lat        numeric,
  gps_lng        numeric,
  captured_at    timestamptz,
  detached       boolean NOT NULL DEFAULT false,         -- unlinked, but retained
  sync_status    text NOT NULL CHECK (sync_status IN (
                   'PENDING SYNC','SYNCING','SYNCED','REVIEWED','ACCEPTED','REJECTED','REQUIRES CLARIFICATION'))
);

-- ---------------------------------------------------------------------------
-- RESTRICTED: child-level and safeguarding data.
-- Separate API routes, separate authorization, excluded from general exports.
-- No child is ever individually identified: coded case IDs only.
-- ---------------------------------------------------------------------------

CREATE TABLE restricted_child_journey (                  -- [CL 16] child journey
  case_row_id    uuid PRIMARY KEY,
  report_id      text NOT NULL REFERENCES school_reports ON DELETE CASCADE,
  case_code      text NOT NULL,                          -- coded ID, never a name
  child_profile  text,                                   -- disability category only
  identified     text, assessed text, referred text, service_received text,
  assistive_device text, iep_support text, enrolled_attending text,
  observed_change text,
  UNIQUE (report_id, case_code)
);

CREATE TABLE restricted_consents (                       -- consent & assent register
  consent_id     uuid PRIMARY KEY,
  report_id      text REFERENCES school_reports,
  school_id      text NOT NULL REFERENCES schools,
  respondent_code text NOT NULL,                         -- code, never a name
  participation_type text NOT NULL CHECK (participation_type IN ('ADULT','CHILD')),
  language       text NOT NULL,
  adult_status   text CHECK (adult_status IN ('CONSENTED','DECLINED','WITHDRAWN','NOT REQUIRED')),
  caregiver_code text,
  caregiver_status text CHECK (caregiver_status IN ('CONSENT GIVEN','CONSENT DECLINED','CONSENT WITHDRAWN')),
  child_assent_status text CHECK (child_assent_status IN (
                   'ASSENT GIVEN','ASSENT DECLINED','ASSENT WITHDRAWN','UNABLE TO PROVIDE ASSENT — REFER')),
  photography_consent boolean NOT NULL DEFAULT false,
  audio_consent  boolean NOT NULL DEFAULT false,
  cleared        boolean NOT NULL DEFAULT false,         -- derived: may an interview proceed?
  withdrawn      boolean NOT NULL DEFAULT false,
  withdrawn_at   timestamptz,
  recorded_by    uuid REFERENCES users,
  recorded_at    timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE restricted_interviews (                     -- [CL 05] beneficiary interviews
  interview_id   uuid PRIMARY KEY,
  report_id      text NOT NULL REFERENCES school_reports ON DELETE CASCADE,
  consent_id     uuid REFERENCES restricted_consents,    -- enforced NOT NULL at the API layer
  respondent_type text NOT NULL,
  role_note      text,
  key_change     text,
  barrier        text,
  independently_verified text,
  safeguarding_concern boolean NOT NULL DEFAULT false,
  recorded_at    timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE restricted_interview_answers (
  interview_id   uuid NOT NULL REFERENCES restricted_interviews ON DELETE CASCADE,
  question_code  text NOT NULL,                          -- Q01..Q11
  response       text,
  PRIMARY KEY (interview_id, question_code)
);

CREATE TABLE restricted_safeguarding_referrals (
  referral_id    uuid PRIMARY KEY,
  report_id      text REFERENCES school_reports,
  -- Encrypted at rest. Incident detail never enters the assessment workbook.
  encrypted_payload bytea NOT NULL,
  submitted_by   uuid REFERENCES users,
  safeguarding_lead_id uuid REFERENCES users,
  status         text NOT NULL,
  created_at     timestamptz NOT NULL DEFAULT now()
);

-- ---------------------------------------------------------------------------
-- Programme (region) workbook
-- ---------------------------------------------------------------------------

CREATE TABLE programme_workbooks (
  region_id      text PRIMARY KEY REFERENCES regions,
  updated_at     timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE programme_baseline (                        -- [CL 14] baseline vs now
  region_id      text NOT NULL REFERENCES programme_workbooks ON DELETE CASCADE,
  indicator_id   text NOT NULL,                          -- BL-01..BL-12
  current_value  text, change_since_baseline text, source_of_current text,
  triangulated   text, achievement_judgement text CHECK (achievement_judgement IN ('0','1','2','3','4','NV')),
  explanation    text, evidence_limitation text,
  PRIMARY KEY (region_id, indicator_id)
);

CREATE TABLE programme_activities (                      -- [CL 15] activity verification
  region_id      text NOT NULL REFERENCES programme_workbooks ON DELETE CASCADE,
  activity_id    text NOT NULL,                          -- AV-01..AV-18
  reported       text, verified text, quality_fidelity text, immediate_change text,
  contribution   text, delay_reason text, evidence text, follow_up text,
  achievement    text CHECK (achievement IN ('0','1','2','3','4','NV')),
  grade          text CHECK (grade IN ('VERIFIED','PARTIALLY VERIFIED','DISPUTED','UNVERIFIED')),
  PRIMARY KEY (region_id, activity_id)
);

CREATE TABLE programme_dac (                             -- [CL 13] OECD-DAC review
  region_id      text NOT NULL REFERENCES programme_workbooks ON DELETE CASCADE,
  criterion_id   text NOT NULL,                          -- DAC-1..DAC-7
  rating         smallint CHECK (rating BETWEEN 1 AND 5),
  evidence_strength text, finding text, recommendation text, conclusion text,
  PRIMARY KEY (region_id, criterion_id)
);

CREATE TABLE programme_stakeholders (                    -- [CL 06] stakeholder engagement
  region_id      text NOT NULL REFERENCES programme_workbooks ON DELETE CASCADE,
  stakeholder_id text NOT NULL,                          -- SH-01..SH-11
  evidence       text, what_changed text, commitment text, budget_commitment text,
  follow_up      text, rating text CHECK (rating IN ('0','1','2','3','4','NV')), report_message text,
  PRIMARY KEY (region_id, stakeholder_id)
);

CREATE TABLE programme_sustainability (                  -- [CL 20] sustainability & exit
  region_id      text NOT NULL REFERENCES programme_workbooks ON DELETE CASCADE,
  asset_id       text NOT NULL,                          -- SUS-01..SUS-14
  owner          text, payer text, maintainer text, skills_local text,
  in_government_plan text, dependent_on_cst_cbm text, exit_started text,
  rating         smallint CHECK (rating BETWEEN 1 AND 5), evidence text,
  PRIMARY KEY (region_id, asset_id)
);

CREATE TABLE programme_learning (                        -- [CL 21] learning & change
  region_id      text NOT NULL REFERENCES programme_workbooks ON DELETE CASCADE,
  area_id        text NOT NULL,                          -- LRN-01..LRN-11
  learned        text, changed_implementation text, unexpected_positive text,
  unexpected_negative text, evidence text, identified_by text,
  should_adapt   text, priority text CHECK (priority IN ('HIGH','MEDIUM','LOW')), recommendation text,
  PRIMARY KEY (region_id, area_id)
);

CREATE TABLE programme_vfm (                             -- [CL 19] budget & value for money
  region_id      text NOT NULL REFERENCES programme_workbooks ON DELETE CASCADE,
  question_id    text NOT NULL,                          -- VFM-1..VFM-7
  finding        text, vfm_implication text, recommendation text,
  PRIMARY KEY (region_id, question_id)
);

CREATE TABLE programme_data_quality (                    -- [CL 18] MEL data quality
  row_id         uuid PRIMARY KEY,
  region_id      text NOT NULL REFERENCES programme_workbooks ON DELETE CASCADE,
  claim          text, definition_clear text, numerator_verified text,
  denominator_verified text, disaggregation_available text,
  source_document text, cross_check_source text, data_consistent text,
  rating         text CHECK (rating IN ('0','1','2','3','4','NV')), action_before_reporting text
);

CREATE TABLE programme_evidence_map (                    -- [CL 23] report evidence map
  row_id         uuid PRIMARY KEY,
  region_id      text NOT NULL REFERENCES programme_workbooks ON DELETE CASCADE,
  conclusion     text, criterion text, claim text, evidence_ids text,
  triangulation_source_1 text, triangulation_source_2 text,
  direct_observation text, contradictory_evidence text,
  confidence     text CHECK (confidence IN ('HIGH','MEDIUM','LOW')), final_wording text
);

CREATE TABLE programme_summary (                         -- [CL 09] Team Leader summary
  region_id      text NOT NULL REFERENCES programme_workbooks ON DELETE CASCADE,
  field_id       text NOT NULL,                          -- TL-01..TL-13
  content        text,
  PRIMARY KEY (region_id, field_id)
);

CREATE TABLE programme_deliverables (                    -- Proposal: deliverables & gates
  region_id      text NOT NULL REFERENCES programme_workbooks ON DELETE CASCADE,
  item_kind      text NOT NULL CHECK (item_kind IN ('DELIVERABLE','GATE')),
  item_id        text NOT NULL,                          -- D1..D7 / G1..G4
  status         text NOT NULL,
  status_date    date,
  note           text,
  PRIMARY KEY (region_id, item_kind, item_id)
);

-- ---------------------------------------------------------------------------
-- Append-only audit log. Every change to a submitted, reviewed or approved
-- record must land here; the API must never issue a hard UPDATE without one.
-- ---------------------------------------------------------------------------

CREATE TABLE audit_log (
  audit_log_id   bigserial PRIMARY KEY,
  actor_id       uuid REFERENCES users,
  entity_type    text NOT NULL,
  entity_id      text NOT NULL,
  report_id      text REFERENCES school_reports,
  field_name     text,
  old_value      jsonb,
  new_value      jsonb,
  reason         text,
  occurred_at    timestamptz NOT NULL DEFAULT now()
);

REVOKE UPDATE, DELETE ON audit_log FROM PUBLIC;

-- ---------------------------------------------------------------------------
-- Indexes for the views the field system actually reads
-- ---------------------------------------------------------------------------

CREATE INDEX ON school_reports (status);
CREATE INDEX ON schools (region_id);
CREATE INDEX ON report_questions (report_id, assessment_status);
CREATE INDEX ON report_findings (severity, status);
CREATE INDEX ON evidence_files (report_id, sync_status);
CREATE INDEX ON audit_log (report_id, occurred_at DESC);
CREATE INDEX ON restricted_consents (school_id, cleared, withdrawn);

-- ---------------------------------------------------------------------------
-- Integrity rules the API must enforce (not expressible as simple constraints)
-- ---------------------------------------------------------------------------
-- 1. An interview may not be created without a restricted_consents row that is
--    cleared = true AND withdrawn = false at the moment of creation.
-- 2. A report_question may not reach assessment_status 'ASSESSED' with fewer
--    than two rows in report_question_streams while the triangulation control
--    is enabled.
-- 3. A report for a school whose roster_status is 'UNCONFIRMED' may not be
--    submitted while that control is enabled (reconciliation item RC-08).
-- 4. QA approval of a regional conclusion requires every reconciliation_item
--    to have status 'RESOLVED'; achievement percentages calculated against a
--    disputed denominator are not defensible.
-- 5. A discrepancy between auditor_1 and auditor_2 grades is never overwritten.
--    The Team Leader records final_grade and final_rationale; both auditor rows
--    are retained.
-- 6. Evidence is never hard-deleted by a field action. Set detached = true.
