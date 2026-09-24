/* ============================================================================
   P10354 ASSESSMENT FRAMEWORK — canonical, read-only reference data.
   ----------------------------------------------------------------------------
   Every structure below is transcribed from the approved assessment
   instruments so that the field system and the Excel checklists stay in step:

     [CL] REET_CBM_Katavi_External_Programmatic_Assessment_Checklist.xlsx
     [CL] REET_CBM_Rukwa_External_Programmatic_Assessment_Checklist.xlsx
     [PR] REET_CBM_P10354_Proposal_FINAL (technical & financial proposal)
     [AA] Accessibility Audit Report Final 2025 (Eng. Kesha William Chinguku)
     [QNR] Quarterly Narrative Report, CST, 2025 Q1
     [BMZ] BMZ Narrative Interim Report (Annex 4), CST, Jan–Jun 2025
     [KO] Project kick-off presentation, CST

   Sheet references are given as [CL 02] etc. so a reviewer can trace any field
   in the app back to the source workbook column it represents.
   Nothing in this file is invented: where the source material is incomplete or
   contradictory the gap is recorded explicitly (see `reconciliation` and any
   `sourceNote` marked UNCONFIRMED) rather than filled with an assumption.
============================================================================ */

const FRAMEWORK = (() => {

  /* --- Assignment metadata [PR] ------------------------------------------ */
  const meta = {
    project: "P10354",
    projectRef: "IDEA000650",
    title: "Take All My Friends to School: Strengthening the Inclusive Education System in Tanzania",
    implementer: "Child Support Tanzania (CST)",
    funders: "BMZ and CBM",
    client: "CBM Tanzania Country Office",
    assessor: "REET Limited",
    projectManager: "Nemes Temba, Project Manager, Child Support Tanzania",
    projectPeriod: "1 October 2023 – 31 December 2027 (54 months)",
    assessmentScope: "Full reconstruction and verification of implementation from project inception to September 2025",
    /* Regions of delivery are Songwe, Rukwa and Katavi. Three independent CST/CBM
       documents agree — the 2025 accessibility audit, the Q1 2025 QNR and the BMZ
       narrative interim report. The proposal's reference to Mbeya is a drafting
       error; Mbeya holds no project school. See reconciliation item RC-07. */
    regionsOfDelivery: ["Songwe", "Rukwa", "Katavi"],
    proposalRegions: ["Mbeya", "Songwe", "Katavi"],
    checklistRegions: ["Katavi", "Rukwa"],
    councils: {
      Songwe: ["Tunduma", "Ileje", "Momba"],
      Katavi: ["Mpanda", "Mpimbwe", "Nsimbo"],
      Rukwa: ["Kalambo", "Sumbawanga MC", "Sumbawanga DC"],
    },
    schoolsProjectWide: 18,
    esracsProjectWide: 3,
    independence: "REET has no prior or current relationship with Child Support Tanzania.",
    triangulationRule: "No finding reaches the final report on a single source. Every confirmed finding is supported by at least two of the four evidence streams.",
  };

  /* --- Rating scales -----------------------------------------------------
     The workbooks score Achievement and Quality on a 0-4 scale with an
     NV escape hatch [CL 02, 04, 06]. Only band 4 is spelled out in the sample
     workbook; the remaining bands follow the same 0-4 convention and are
     labelled here so field teams score consistently across regions. -------- */
  const scales = {
    rating: [
      { value: "4", label: "4 – Fully achieved", help: "Target/result achieved and quality is satisfactory; evidence verified." },
      { value: "3", label: "3 – Largely achieved", help: "Most of the target/standard met; minor gaps that do not undermine the result." },
      { value: "2", label: "2 – Partially achieved", help: "Meaningful progress but substantial gaps in delivery, reach or quality." },
      { value: "1", label: "1 – Minimally achieved", help: "Only token delivery; the result is not materially in place." },
      { value: "0", label: "0 – Not achieved", help: "No credible evidence that the target/standard was delivered." },
      { value: "NV", label: "NV – Not verifiable", help: "Evidence is unavailable or insufficient. Use NV rather than assuming achievement." },
    ],
    /* Evidence classification system [PR Appendix H] */
    grade: [
      { value: "VERIFIED", label: "Verified", help: "Confirmed by at least two independent evidence streams." },
      { value: "PARTIALLY VERIFIED", label: "Partially verified", help: "Some supporting evidence, but gaps or inconsistencies remain." },
      { value: "DISPUTED", label: "Disputed", help: "Evidence streams conflict and cannot be reconciled." },
      { value: "UNVERIFIED", label: "Unverified", help: "No supporting field evidence available." },
    ],
    confidence: ["HIGH", "MEDIUM", "LOW"],
    severity: ["CRITICAL", "HIGH", "MEDIUM", "LOW"],
    priority: ["HIGH", "MEDIUM", "LOW"],
    yesNo: ["", "YES", "NO", "PARTIAL", "NOT VERIFIABLE"],
    itemStatus: ["NOT ASSESSED", "IN PROGRESS", "ASSESSED", "NOT APPLICABLE", "REQUIRES FOLLOW-UP"],
    reportStatus: ["DRAFT", "IN PROGRESS", "READY FOR SUBMISSION", "SUBMITTED", "UNDER REVIEW", "REQUIRES CLARIFICATION", "QA APPROVED", "FINALIZED"],
    evidenceStrength: ["", "STRONG", "MODERATE", "WEAK", "NONE"],
  };

  const gradeValues = scales.grade.map((g) => g.value);
  const ratingValues = scales.rating.map((r) => r.value);

  /* --- The four evidence streams [PR Appendix B] -------------------------- */
  const evidenceStreams = [
    { id: "DOC", name: "Documentation", detail: "Proposal, workplan, logframe, registers, progress and audit reports." },
    { id: "FIELD", name: "Field evidence", detail: "Physical inspection, geo-tagged photos, asset counts, accessibility measurements." },
    { id: "TESTIMONY", name: "Stakeholder testimony", detail: "Interviews, child-friendly FGDs, community corroboration." },
    { id: "FINANCIAL", name: "Financial records", detail: "External audit findings and expenditure cross-checks." },
  ];

  /* --- Verification & Learning Framework building blocks [PR Appendix M] --- */
  const buildingBlocks = [
    { id: "RECONSTRUCT", name: "1. Reconstruct", focus: "Rebuild the full record of what was planned and reported", output: "Activity reconstruction matrix, document map" },
    { id: "VERIFY", name: "2. Verify", focus: "Confirm on the ground that activities took place and reached people", output: "Field verification forms, asset checks" },
    { id: "TRIANGULATE", name: "3. Triangulate", focus: "Cross-check programmatic, physical and financial evidence", output: "Triangulation matrix, evidence register" },
    { id: "ASSESS", name: "4. Assess", focus: "Judge compliance, accessibility and safeguarding integrity", output: "Compliance and safeguarding findings" },
    { id: "VALIDATE", name: "5. Validate", focus: "Test findings with CBM and stakeholders before they are fixed", output: "Validated findings, corrections log" },
    { id: "LEARN", name: "6. Learn", focus: "Turn evidence into recommendations and lessons", output: "Recommendations, lessons learned record" },
  ];

  /* --- Assessment architecture: 8 verification layers [CL 12] ------------- */
  const architectureLayers = [
    { id: "L1", name: "1. Delivery", question: "Did the planned activity actually happen?", evidence: "Attendance, approved report, deliverable, procurement record, photos, dated activity evidence.", insufficient: "Narrative saying the activity was completed.", method: "Document review + interview.", sources: "CST, school, trainer, district.", output: "Verified activity status." },
    { id: "L2", name: "2. Reach", question: "Did the intended people actually receive the intervention?", evidence: "Disaggregated beneficiary records, registers, school records, referral/assessment records.", insufficient: "Participant totals without names/unique identifiers or disaggregation.", method: "Record verification + sampling.", sources: "Children, parents, teachers, assessors.", output: "Verified reach." },
    { id: "L3", name: "3. Quality", question: "Was it delivered to the required standard?", evidence: "Pre/post results, observation, technical inspection, participant feedback, accessibility measurements.", insufficient: "Attendance certificate or completion photo alone.", method: "Observation + technical check + interview.", sources: "Teachers, children, accessibility specialist, assessor.", output: "Quality judgement." },
    { id: "L4", name: "4. Immediate change", question: "Did knowledge, skills, behaviour or access change?", evidence: "Pre/post tests, classroom observation, IEP use, changed practice, functional accessibility, referral completion.", insufficient: "Claim that people were 'sensitised' or 'trained'.", method: "Before/after comparison + observation.", sources: "Teachers, parents, children, officials.", output: "Outcome evidence." },
    { id: "L5", name: "5. Beneficiary change", question: "Did children experience a meaningful difference?", evidence: "Attendance, participation, learning progress, transition, assistive-device use, child/parent testimony triangulated with records.", insufficient: "A single success story without supporting evidence.", method: "Case tracing + records + interview.", sources: "Children, parents, teachers.", output: "Human-level change." },
    { id: "L6", name: "6. System change", question: "Is the change becoming part of the education system?", evidence: "Government budget, plans, procedures, official supervision, ESRAC operation, school mechanisms, role clarity.", insufficient: "Meeting minutes without a decision/action.", method: "Document review + key informant interview.", sources: "LGA, MoEST, school management.", output: "Institutionalisation judgement." },
    { id: "L7", name: "7. Sustainability", question: "Could the result continue without project funding?", evidence: "Owner, budget, maintenance plan, trained local capacity, replacement arrangements, exit plan.", insufficient: "'Government will continue' without evidence.", method: "Sustainability interview + document check.", sources: "LGA, school, ESRAC, OPD, CST.", output: "Sustainability rating." },
    { id: "L8", name: "8. Value for money", question: "Were resources converted into useful results economically and efficiently?", evidence: "Budget-to-output mapping, procurement evidence, unit costs where available, utilisation and quality of outputs.", insufficient: "Low spending automatically interpreted as efficiency.", method: "Financial + programme triangulation.", sources: "CST finance/MEL, procurement, schools.", output: "VFM observations." },
  ];

  /* --- Results matrix [CL 02] -------------------------------------------- */
  const results = [
    {
      id: "R1", name: "Result 1 – Access, assessment, referral & placement",
      intent: "Children with disabilities have improved access to government schools under the project.",
      indicators: "Children identified/assessed; referrals/rehabilitation; children accessing inclusive education; enrolment/completion/transition; assistive devices; learning ability change; assessors trained and practicing.",
      target: "PPA contains project-wide indicators; exact annual/regional allocations should be taken from the latest MEL/workplan.",
      checkInField: "Trace children from identification → assessment → referral → assistive device/rehab → school placement → attendance/enrolment. Verify whether services are timely and actually usable.",
      evidence: "Assessment registers; referral records; rehab records; assistive-device registers; school enrolment/attendance; IEPs; assessor training records; mobile assessment reports.",
    },
    {
      id: "R2", name: "Result 2 – Quality inclusive teaching & learning",
      intent: "Improve equitable and quality learning outcomes for children with disabilities in target government schools.",
      indicators: "IE kits/curriculum developed and used; teachers trained; teachers adapt practice; schools modified; children feel accepted/supported; inclusive learning materials available.",
      target: "360 teachers in PPA; confirm current target/workplan.",
      checkInField: "Observe lessons; review IEPs and lesson plans; check inclusive materials; interview teachers and students; verify mentoring and follow-up.",
      evidence: "Training registers; pre/post tests; lesson plans; IEPs; classroom observation forms; mentoring reports; materials inventory; student feedback.",
    },
    {
      id: "R3", name: "Result 3 – Community engagement",
      intent: "Improved community awareness and engagement to prevent dropout and support inclusive education.",
      indicators: "KAP/attitude change; mobilized community members; parent/caregiver engagement with government; OPD joint advocacy; child abuse reporting; PSG activity and IGA support.",
      target: "Kick-off materials reference a 1m community awareness goal; PPA lists 2m community members. Reconcile before scoring.",
      checkInField: "Determine whether awareness changed behaviour, not only whether meetings occurred. Check active PSGs, CRCs, OPD participation and evidence of advocacy.",
      evidence: "KAP baseline/endline or monitoring data; PSG registers/minutes; CRC records; media evidence; campaign reports; IGA records; safeguarding/referral records.",
    },
    {
      id: "R4", name: "Result 4 – Assessment/referral systems & accessibility",
      intent: "Improved assessment, referral and placement systems and accessible school environments.",
      indicators: "Children assessed through ESRAC/mobile services; ESRACs equipped; assessment/placement procedures improved; 18 schools modified; children enrolled after modifications.",
      target: "18 project schools; 3 ESRACs; exact annual targets to confirm.",
      checkInField: "Verify whether modifications followed the accessibility audit and are usable in practice. Re-test ramps, toilets, paths, doors, signage and safety features.",
      evidence: "2025 accessibility audit; BoQs/drawings; procurement/payment records; completion certificates; photos before/after; school inspection; ESRAC equipment register.",
    },
    {
      id: "R5", name: "Result 5 – Government engagement & financing",
      intent: "Increased government engagement and commitment to inclusive education and ESRAC financing.",
      indicators: "Advocacy meetings leading to change; annual district school observations; schools receiving government budget support; officials implementing plans aligned to national policy.",
      target: "Annual meetings/observations; budget allocations; district implementation plans.",
      checkInField: "Look for decisions and resource commitments, not attendance only. Verify budget lines, official plans, inspection visits and follow-up actions.",
      evidence: "Minutes; attendance; official letters; council plans; budget books; inspection reports; advocacy trackers; MoUs; commitments and follow-up evidence.",
    },
    {
      id: "XC", name: "Cross-cutting – Safeguarding, inclusion & participation",
      intent: "Children and persons with disabilities participate safely and meaningfully.",
      indicators: "Disability inclusion; child protection/safeguarding; participation of children, parents and OPDs; accessible communication; complaints/referrals.",
      target: "Project activities include safeguarding training and inclusive child protection.",
      checkInField: "Check whether children can speak safely; whether complaints/referral pathways are known and functioning; whether OPDs participate beyond attendance.",
      evidence: "Safeguarding policy; training records; complaints/referral logs; interview evidence; OPD records; child participation records.",
    },
  ];

  /* --- Field assessment questions [CL 04] --------------------------------- */
  const fieldQuestions = [
    { id: "FV-01", result: "R1", area: "Child assessment", question: "Are all children identified/assessed through the project actually recorded and traceable?", standard: "R1 indicator – children identified and assessed" },
    { id: "FV-02", result: "R1", area: "Referral/rehabilitation", question: "Are children needing referral receiving appropriate referral and rehabilitation services?", standard: "R1 indicator – referral and rehabilitation" },
    { id: "FV-03", result: "R1", area: "Assistive devices", question: "Are assistive devices provided to eligible children and are they suitable, functional and used?", standard: "R1 indicator – assistive devices" },
    { id: "FV-04", result: "R1", area: "Enrolment/transition", question: "Has access/enrolment/completion/transition improved for children with disabilities?", standard: "R1 indicators – access, enrolment, completion and transition" },
    { id: "FV-05", result: "R1", area: "IEP / learning", question: "Do IEPs and assessment results influence lesson planning and learning support?", standard: "R1 indicator – change in ability to learn" },
    { id: "FV-06", result: "R1", area: "Assessors", question: "Are trained assessors practicing the Child-to-Child approach and using IE Assessment Kits?", standard: "R1 indicator – trained/practicing assessors" },
    { id: "FV-07", result: "R2", area: "Teacher training", question: "Were planned teachers trained, and can they demonstrate what they learned?", standard: "360 project-wide in PPA – confirm current target" },
    { id: "FV-08", result: "R2", area: "Classroom practice", question: "Does observation show child-centred/inclusive teaching, adaptation and participation of students with disabilities?", standard: "Quality inclusive education" },
    { id: "FV-09", result: "R2", area: "Teaching materials", question: "Are inclusive teaching/learning materials available, accessible and actually used?", standard: "Improved availability of inclusive materials" },
    { id: "FV-10", result: "R2", area: "Mentoring", question: "Did mentoring/classroom observation occur and lead to changes in practice?", standard: "Mentoring activity in PPA" },
    { id: "FV-11", result: "R3", area: "PSG", question: "Are Parents Support Groups formed, active and meeting quarterly?", standard: "PSG activity – quarterly meetings/training" },
    { id: "FV-12", result: "R3", area: "PSG livelihoods", question: "Did PSG members receive livelihood training/start-up support and is it helping children access education?", standard: "PSG IGA activity" },
    { id: "FV-13", result: "R3", area: "CRC", question: "Are Child Rights Clubs functioning with monthly meetings and annual training?", standard: "CRC activity" },
    { id: "FV-14", result: "R3", area: "OPDs", question: "Are OPDs actively involved in advocacy/resource mobilisation rather than only attending events?", standard: "OPD engagement activity" },
    { id: "FV-15", result: "R3", area: "KAP", question: "Is there evidence of change in community attitudes, practices and acceptance?", standard: "KAP indicator" },
    { id: "FV-16", result: "R4", area: "Accessibility modification", question: "For this school, were the 2025 audit recommendations implemented?", standard: "18 schools project-wide; 6 schools per assessed region" },
    { id: "FV-17", result: "R4", area: "Accessibility usability", question: "Can a child with a mobility/visual disability actually use the modified route independently and safely?", standard: "Universal Design / CBM accessibility requirements" },
    { id: "FV-18", result: "R4", area: "ESRAC", question: "Is the relevant ESRAC equipped and operational, and are assessment/placement procedures functioning?", standard: "3 ESRACs project-wide" },
    { id: "FV-19", result: "R5", area: "Government visits", question: "Are district/national officials conducting school observations as planned?", standard: "Annual/semi-annual observation activity" },
    { id: "FV-20", result: "R5", area: "Government financing", question: "Is there evidence that government budgets or plans now support inclusive education/ESRACs?", standard: "Budget/commitment indicators" },
    { id: "FV-21", result: "XC", area: "Safeguarding", question: "Do staff, children and parents know the safeguarding/complaints/referral pathway?", standard: "Safeguarding activity" },
    { id: "FV-22", result: "XC", area: "Participation", question: "Do children, parents and OPDs participate meaningfully rather than only attending?", standard: "Inclusive participation / accessible communication" },
  ];

  /* --- Beneficiary interview questions [CL 05] ---------------------------- */
  const interviewQuestions = [
    { id: "Q01", text: "How has access to school changed for children with disabilities?" },
    { id: "Q02", text: "Can children move independently between classroom, toilet and other key facilities?" },
    { id: "Q03", text: "Are assistive devices available, suitable and functioning?" },
    { id: "Q04", text: "Do teachers adapt teaching to individual needs/IEPs?" },
    { id: "Q05", text: "Do children feel accepted and supported by peers?" },
    { id: "Q06", text: "Have attendance, participation, completion or transition changed?" },
    { id: "Q07", text: "Do parents know where to seek assessment/referral/rehabilitation?" },
    { id: "Q08", text: "Are parents/PSGs actively supporting children's education?" },
    { id: "Q09", text: "Have community attitudes towards disability and inclusive education changed?" },
    { id: "Q10", text: "What is the biggest remaining barrier?" },
    { id: "Q11", text: "What should CST/CBM/government do next?" },
  ];

  const respondentTypes = [
    "Child with disability", "Child without disability", "Parent / caregiver",
    "Teacher", "Head teacher", "School committee member", "Education assessor",
    "IECV", "OPD representative", "District/ward education officer", "CST staff", "Other",
  ];

  /* --- Stakeholder engagement [CL 06] ------------------------------------- */
  const stakeholders = [
    { id: "SH-01", name: "Regional education officials", role: "Oversight and inclusive education coordination" },
    { id: "SH-02", name: "District/municipal education officials", role: "School oversight, implementation plans and school observations" },
    { id: "SH-03", name: "School heads/teachers", role: "Implementation of inclusive education practices" },
    { id: "SH-04", name: "Education assessors / medical officers", role: "Assessment, referral and placement" },
    { id: "SH-05", name: "IECVs", role: "Home visits, community support and child-to-child/community linkages" },
    { id: "SH-06", name: "OPDs", role: "Advocacy, participation and accountability" },
    { id: "SH-07", name: "Parents / PSGs", role: "Support children, participate in PSGs and advocacy" },
    { id: "SH-08", name: "Children / CRCs", role: "Participation, peer support, child protection and safeguarding" },
    { id: "SH-09", name: "Religious/traditional leaders", role: "Community awareness and social norm change" },
    { id: "SH-10", name: "Government finance/planning officials", role: "Budget allocation for inclusive education / ESRACs" },
    { id: "SH-11", name: "ESRAC / CBR actors", role: "Assessment, referral and rehabilitation services" },
  ];

  /* --- Activity-to-result verification [CL 15 + QNR + BMZ] ----------------
     Activity codes are CST's own, from the Q1 2025 QNR and the approved
     workplan. `reported` is what CST has claimed in its own reporting — the
     claim the field team is there to test. It is pre-loaded so an auditor
     verifies a specific figure rather than an empty box; it is never evidence
     of delivery on its own.                                              --- */
  const activities = [
    {
      id: "A01.02", name: "Training of teachers on inclusive education, child protection and the Child-to-Child model",
      timing: "2024 and 2026 in the approved timeline; delivered 8–9 March 2025",
      expected: "Trained teachers with registers, pre/post evidence and observable classroom application.",
      reported: "91 teachers trained (39 male, 52 female) against a target of 90 — Katavi 30, Rukwa 30, Songwe 31; 5 teachers from each of the 18 schools. 91 IEPs created. Follow-up visits to two schools per region; feedback collected from 50% of participants. Behaviour change reported at Mukamanye.",
      verify: "Sight the register and count names against 91. Check the regional split. Ask to see the 91 IEPs and whether they are in use. Test whether the four schools per region never followed up differ in practice.",
    },
    {
      id: "A01.04", name: "Quarterly IECV home visits to children with disabilities",
      timing: "Ongoing, quarterly",
      expected: "Visit records, cases followed up, referrals made and outcomes recorded.",
      reported: "Conducted January–March 2025 by trained IECVs with education assessors. No visit numbers, coverage or referral counts were reported.",
      verify: "A claim with no numbers is unverifiable as stated. Request the visit register, count visits per IECV, and trace a sample of children to a referral outcome.",
    },
    {
      id: "A01.05", name: "Educational and medical assessment of out-of-school children by mobile services",
      timing: "Bi-annual; February 2025 planned",
      expected: "Children assessed, needs identified, referrals and school placement tracked.",
      reported: "Postponed. The Sogea ESRAC in Tunduma was not yet equipped. Rescheduled to April 2025, subject to the government completing the centre modification.",
      verify: "Establish whether the assessments actually ran from April 2025, how many children were assessed, and how many reached school placement.",
    },
    {
      id: "A01.06", name: "Training on Appropriate Paper-based Technology (APT) for parents",
      timing: "2024 and 2026; forecast for Q2 2025",
      expected: "Parents can explain and use APT, and the devices produced are functional and in use.",
      reported: "Listed in the Q2 2025 activity forecast. No Q1 delivery reported.",
      verify: "Confirm whether the training happened, then check whether any APT device is actually in a child's hands and still working.",
    },
    {
      id: "A01.07", name: "Mentoring sessions by CST with education assessors and IECVs",
      timing: "Bi-annual; rescheduled to April 2025",
      expected: "Mentoring records, classroom observations and evidence of changed practice.",
      reported: "Mentoring for 270 teachers across the 18 schools rescheduled from early 2025 to April 2025, to follow the March teacher training.",
      verify: "Note that 270 teachers here differs from the 91 trained under A01.02. Establish which population is being mentored and whether the sessions took place.",
    },
    {
      id: "A01.08", name: "Exchange learning visits by CST teachers and education assessors",
      timing: "Selected years; rescheduled to late April 2025",
      expected: "Learning captured and demonstrably applied in the visiting school.",
      reported: "Rescheduled to the last week of April 2025 so that mentoring outcomes could materialise first.",
      verify: "Confirm the visits happened and look for a specific practice a school adopted as a result.",
    },
    {
      id: "A01.09", name: "Provision of inclusive teaching and learning materials",
      timing: "Planned 2023–2024; delivered March 2025",
      expected: "Materials present, accessible, and actually used in lessons.",
      reported: "Procured under RFQ CST/BMZ/RFQ/002/2024 — crayons, glue, paper, pens, flip charts, Manila paper, pencils, rulers, nylon cards, marker pens, magazines — and distributed to all 18 schools in March 2025. Needs assessments run in Songwe and Katavi only; the Rukwa RFO had left. No transport budget was available.",
      verify: "Count what is physically present against the delivery note, and check whether it is in classrooms or still in a store room. Rukwa had no needs assessment — test whether what arrived matched what that region needed.",
    },
    {
      id: "A01.10", name: "Technical study of building accessibility in 18 schools",
      timing: "Planned 2024; conducted March–April 2025",
      expected: "Study findings translated into costed decisions and actions.",
      reported: "Accessibility audit by Eng. Kesha William Chinguku under agreement CST/ADM/BMZ/2025/005, commenced 17 March 2025, consultancy period to 15 April 2025, covering all 18 schools. Delayed from 2024 by consultant recruitment.",
      verify: "This one is largely verified — the report exists and is the baseline for the accessibility retest. Test instead whether its recommendations were carried into the modification designs and budgets.",
    },
    {
      id: "A01.13", name: "School modifications",
      timing: "2025; preparations reported for Q2 2025",
      expected: "Modifications completed to the agreed technical standard and usable in practice.",
      reported: "Preparations for renovations in TEN selected schools, based on the technical assessment, with a selection criterion, cost breakdown, professional and local contractors and a Bill of Quantities to follow.",
      verify: "The PPA target is 18 schools modified; CST reports selecting 10. Establish the selection criterion, which 8 schools are excluded and what happens to them. See reconciliation item RC-11.",
    },
    {
      id: "A02.01", name: "Training of OPD leaders and members on the inclusive education system",
      timing: "2025–2027; forecast for Q2 2025",
      expected: "OPDs actively advocating and mobilising resources, with documented results.",
      reported: "Listed in the Q2 2025 activity forecast. No Q1 delivery reported.",
      verify: "Check whether OPDs participate beyond attending events — look for an advocacy action they initiated.",
    },
    {
      id: "A02.04", name: "Formation and running of child rights clubs",
      timing: "Ongoing; quarterly meetings",
      expected: "Active CRCs with meetings, training and evidence of child participation.",
      reported: "2024 mobilisation could not proceed due to budget constraints for Regional Field Officers. Strategy reorganised: RFOs are preparing CRC patrons and matrons to supervise. Target is 18 clubs, each with a male and female patron and 13 members, meeting once per quarter at each school.",
      verify: "Test whether a club exists at each school, whether it has met, and whether children with disabilities are members rather than spectators. Check the patron/matron capacity building actually happened.",
    },
    {
      id: "A02.05", name: "Assessing out-of-school children with disabilities through mobile assessment services",
      timing: "Ongoing; forecast for Q2 2025",
      expected: "Out-of-school children identified, assessed and referred into school.",
      reported: "Listed in the Q2 2025 activity forecast.",
      verify: "Trace identified out-of-school children through to enrolment and attendance, not just assessment.",
    },
    {
      id: "A02.06", name: "Media advocacy campaign",
      timing: "Ongoing; suspended in Q1 2025",
      expected: "Reach plus evidence of changed awareness or behaviour, not only broadcast counts.",
      reported: "Suspended by CST management to align with the National Strategy for Inclusive Education, rescheduled to the second week of April 2025.",
      verify: "Establish whether the campaign ran, what was broadcast, and whether anyone's attitude or behaviour demonstrably shifted.",
    },
    {
      id: "A03.02", name: "Translation and dissemination of the National Strategy for Inclusive Education",
      timing: "Commenced 22 October 2024; completed March 2025",
      expected: "Accessible copies delivered and evidence that stakeholders use them.",
      reported: "Consultant Peter Kisanga translated the NSIE 2022–2026 into Swahili and produced 120 regular font, 40 Braille and 40 extra-large font copies, delivered to CST in March 2025. Distribution to the 18 schools and stakeholders was postponed to April 2025.",
      verify: "Delivery to CST is not delivery to schools. Count copies actually held at each school, in which format, and ask whether anyone has used them.",
    },
    {
      id: "A03.03", name: "Bi-annual school visits by government officials",
      timing: "2024–2027",
      expected: "Visit reports, findings, agreed actions and follow-up.",
      reported: "Collaborative monitoring visits by CST staff and government officials to all 18 project schools in Q1 2025. Best practice cited at Malangali (school code of conduct), Katisunga and Mukamanye. Social Welfare Officers could not be secured as they are not based at council offices.",
      verify: "Ask each school for the visit record and what changed afterwards. A visit with no recorded action is attendance, not engagement.",
    },
    {
      id: "A03.05", name: "Equipping ESRACs with tools and equipment for identification and diagnosis",
      timing: "2024–2027",
      expected: "Three operational ESRACs with functional equipment and service records.",
      reported: "Equipment purchased for the Sogea ESRAC (Songwe), awaiting government renovation of the designated room. Matai A (Rukwa) and Majimoto (Katavi) informed to prepare. TZS 44,000,000 advance from the 2026 budget requested from the CBM Country Director. Total ESRAC budget TZS 155,791,000 — 15,791,000 in 2023, 68,000,000 in 2024, 28,000,000 in 2025, 44,000,000 in 2026.",
      verify: "Physically inspect and count the Sogea equipment against the procurement record; establish whether either of the other two centres has anything. Trace the TZS 68,000,000 spent in 2024 to assets that exist.",
    },
    {
      id: "AV-PSG", name: "Parent Support Groups",
      timing: "Ongoing / quarterly",
      expected: "Active PSGs meeting, trained, and supporting children's education, with livelihood/IGA support where planned.",
      reported: "Not separately reported in the Q1 2025 QNR; CRC patron and matron capacity building is planned to use the Q2 2025 PSG sessions.",
      verify: "Establish whether PSGs exist and meet quarterly, and whether any livelihood support reached a household in a way that kept a child in school.",
    },
    {
      id: "AV-SAFE", name: "Safeguarding training for education assessors and IECVs",
      timing: "2025",
      expected: "Trained personnel able to explain the safeguarding and complaints/referral route without prompting.",
      reported: "Not separately reported in the Q1 2025 QNR.",
      verify: "Ask staff, children and parents to describe the reporting route from memory. Do not record incident detail.",
    },
  ];

  /* --- Baseline-to-now verification [CL 14] ------------------------------- */
  const baselineIndicators = [
    { id: "BL-01", name: "Inclusive classes / children attending", baseline: "Feasibility study established baseline data on inclusive-class participation and school enrolment.", target: "10,250 persons in inclusive classes by project end (approved project plan)." },
    { id: "BL-02", name: "Children receiving individualized school-based support", baseline: "100 children in feasibility evidence.", target: "360 children with disabilities receiving individual support; 50% girls." },
    { id: "BL-03", name: "Teachers trained in inclusive education / Child-to-Child", baseline: "54 teachers; feasibility analysis also discusses 180 as a target and notes attrition risk.", target: "Confirm approved current target before scoring; project plan timeline includes teacher training." },
    { id: "BL-04", name: "Specialist teachers with learning development plans", baseline: "36 trained specialist education teachers without prior experience in developing learning plans.", target: "75% of specialist teachers benefiting from the project have developed plans used by children and parents." },
    { id: "BL-05", name: "Safeguarding / accessible complaints", baseline: "0 target schools had a safeguarding mechanism and accessible complaints procedure.", target: "18 schools." },
    { id: "BL-06", name: "Home-based academic support", baseline: "Approximately 10 children with disabilities received academic support at home.", target: "288 persons; current target definition should be confirmed." },
    { id: "BL-07", name: "Parents/caregivers trained for home support", baseline: "54 parents/caregivers trained.", target: "180 parents/caregivers; 70% women able to apply learning." },
    { id: "BL-08", name: "Community advocacy / awareness", baseline: "200,000 community members participating in advocacy as of 2022.", target: "1,000,000 over project lifetime." },
    { id: "BL-09", name: "Faith / traditional leaders", baseline: "10 leaders were aware of and advocated for quality inclusive education.", target: "45 leaders over project life." },
    { id: "BL-10", name: "Government engagement", baseline: "20 district government officials engaged in implementing plans aligned with national strategies.", target: "75% of district government officials reached by the project involved in contextualising plans/guidelines." },
    { id: "BL-11", name: "ESRAC operation", baseline: "No ESRACs were operational in the target regions.", target: "3 ESRACs operational and equipped by end of project." },
    { id: "BL-12", name: "School accessibility", baseline: "2025 audit provides school-specific physical accessibility baseline for 18 schools.", target: "18 project schools to be inclusive; 6 schools per assessed region." },
  ];

  /* --- OECD-DAC review [CL 13, PR Appendix P] ----------------------------- */
  const dacCriteria = [
    { id: "DAC-1", name: "Relevance", question: "Does the intervention still address the real barriers facing children with disabilities in this region, including identification, access, teaching quality, infrastructure and community attitudes?", evidence: "Current school records; child/parent views; district priorities; current barriers; accessibility audit follow-up.", sources: "Children, parents, schools, SNEO, LGA plans." },
    { id: "DAC-2", name: "Coherence", question: "Does the project complement government inclusive education work and other actors, without duplication or conflicting approaches?", evidence: "District plans; MoEST/LGA programmes; other NGO interventions; referral networks; school plans.", sources: "LGA, MoEST, OPDs, other programmes, CST." },
    { id: "DAC-3", name: "Effectiveness", question: "To what extent are intended results being achieved, and which activities are producing the strongest/weakest results?", evidence: "Results matrix; target vs actual; quality evidence; outcome stories; school-level comparisons.", sources: "MEL data, schools, children, parents, officials." },
    { id: "DAC-4", name: "Efficiency", question: "Are time, people and funds being converted into useful, good-quality results? Are roles clear and bottlenecks resolved?", evidence: "Budget, procurement, staffing, workplans, delays, unit costs where available, output quality.", sources: "CST finance/MEL, project team, schools, LGA." },
    { id: "DAC-5", name: "Impact / contribution", question: "What meaningful changes are emerging for children, schools, families and the system, and what evidence supports a contribution by the project?", evidence: "Trends, case studies, enrolment/attendance/transition, learning evidence, government actions, triangulated testimony.", sources: "Children, parents, teachers, officials, records." },
    { id: "DAC-6", name: "Sustainability", question: "Which results are likely to continue after project funding, and what is still dependent on CST/CBM?", evidence: "Government budget, ownership, maintenance, staff capacity, policies, exit plans, community structures.", sources: "LGA, school, ESRAC, OPD, CST." },
    { id: "DAC-7", name: "Disability inclusion sustainability", question: "Are accessibility and inclusion being embedded in ordinary systems rather than remaining project-specific?", evidence: "School plans, budgets, procurement standards, maintenance, accessible complaints, inclusive teaching routines.", sources: "School management, LGA, children, OPD." },
  ];

  /* --- Sustainability & exit readiness [CL 20] ---------------------------- */
  const sustainabilityAssets = [
    "Accessible school infrastructure", "Inclusive teaching practice", "IEPs / learning development plans",
    "Education assessor capacity", "IECV/home visit system", "Parent Support Groups", "Child Rights Clubs",
    "Accessible safeguarding / complaints mechanism", "Assistive devices / maintenance / replacement",
    "ESRAC equipment and services", "Government planning and budgeting for IE", "OPD advocacy capacity",
    "Community awareness / local leadership", "Monitoring, learning and data systems",
  ].map((name, i) => ({ id: `SUS-${String(i + 1).padStart(2, "0")}`, name }));

  /* --- Learning, adaptation & unexpected change [CL 21] ------------------- */
  const learningAreas = [
    "Child access and identification", "Teacher practice", "Assistive devices", "Accessibility infrastructure",
    "Parent / community engagement", "OPD participation", "Government engagement", "ESRAC operation",
    "Safeguarding", "MEL / data", "Coordination between CST, LGAs and other actors",
  ].map((name, i) => ({ id: `LRN-${String(i + 1).padStart(2, "0")}`, name }));

  /* --- Data reconciliation: known contradictions [CL 10] ------------------
     These must be resolved before any achievement percentage is calculated.
     The system blocks final QA approval while any of them is unresolved.  --- */
  const reconciliation = [
    { id: "RC-01", issue: "Children with disabilities target", sourceA: "PPA: 2,880", sourceB: "Kick-off presentation: 20,500 (11,274 male + 9,224 female)", why: "A major difference changes the denominator and achievement calculation.", action: "Obtain latest approved MEL/results framework and confirm which figure applies to the assessment period." },
    { id: "RC-02", issue: "Children without disabilities target", sourceA: "PPA: 14,400", sourceB: "Kick-off presentation: 10,250 (5,638 male + 4,612 female)", why: "Different target population totals.", action: "Reconcile against latest approved target matrix." },
    { id: "RC-03", issue: "Teachers target", sourceA: "PPA: 360 primary teachers", sourceB: "Kick-off presentation: 270 school teachers plus other categories", why: "Could affect training achievement percentage.", action: "Confirm whether 360 is project-wide and how other trained categories are counted." },
    { id: "RC-04", issue: "Community reach", sourceA: "PPA: 2,000,000 community members", sourceB: "Kick-off: 1,800,000 indirect beneficiaries; project goal says 1 million awareness/engagement", why: "Different definitions may be being used.", action: "Clarify whether these are population/indirect beneficiaries vs intended people reached/engaged." },
    { id: "RC-05", issue: "Rukwa school naming", sourceA: "Kick-off: Mukanye, Laela B, Matai A, Msanzi A", sourceB: "Accessibility audit: Mukamanye, Laela, Matai A, Msanzi A", why: "Could create duplicate/missing school records.", action: "Confirm official school names/codes with CST and district authorities." },
    { id: "RC-06", issue: "Assessment timing", sourceA: "Project runs to Dec 2027", sourceB: "External assessment is being conducted before project end", why: "Endline-style conclusions may be premature.", action: "Use 'achievement to date' unless the TOR defines a specific completed phase." },
    { id: "RC-07", issue: "Regions of delivery", sourceA: "The REET proposal names Mbeya, Songwe and Katavi", sourceB: "The 2025 accessibility audit, the Q1 2025 QNR and the BMZ narrative interim report all name Songwe, Rukwa and Katavi, and all 18 project schools sit in those three regions", why: "Field itinerary, budget and school coverage all depend on which regions are in scope.", action: "Evidence is one-sided: three CST/CBM documents agree on Songwe, Rukwa and Katavi. Treat the proposal's reference to Mbeya as a drafting error, confirm in writing with CBM at inception, and correct the itinerary and budget accordingly." },
    { id: "RC-08", issue: "School name variants across sources", sourceA: "CST reporting and the region checklists use Msia, Chiwezi, Matai A, Laela B, Mukamanye, Majimoto Maalum", sourceB: "Earlier documentation carried Nsia and Chiyezi; the 2025 audit's demographic table uses 'Matai “B”' while its narrative uses 'Matai'; the Nyerere ward appears as both Kawajense and Kiwajense", why: "Variant names create duplicate or missing school records and break the link between an audit finding and the school it belongs to.", action: "Confirm the official school names, codes and wards with CST and the district authorities, and record one controlling name per school." },
    { id: "RC-09", issue: "Disability category counts that do not reconcile", sourceA: "2025 accessibility audit Table 01 states a total number of children with disabilities per school", sourceB: "For Sogea the categories sum to 28 against a stated 30; for Msanzi A the categories list 'II' twice and sum to 22 against a stated 20", why: "The category breakdown is the basis for judging whether support reaches the right children; if it does not sum, neither figure can be relied on.", action: "Reconcile both schools' category breakdowns against the school register and the ESRAC assessment records during fieldwork." },
    { id: "RC-10", issue: "Schools where nearly every pupil has a disability", sourceA: "Malangali records 100 children with disabilities out of 105 pupils; Maji Moto records 50 of 50", sourceB: "Project targets are written around inclusive settings mixing children with and without disabilities", why: "If these are special or resource schools rather than inclusive schools, per-school achievement denominators and the inclusion logic differ.", action: "Establish each school's official designation and decide how it is counted before calculating inclusion or enrolment achievement." },
    { id: "RC-11", issue: "Number of schools to be physically modified", sourceA: "PPA and kick-off materials: 18 schools modified, and the 2025 audit assessed all 18", sourceB: "Q1 2025 QNR: renovations are being prepared for ten selected schools, chosen against a selection criterion", why: "Eight schools may receive no physical modification at all. Achievement against the 18-school accessibility indicator cannot be judged until this is settled.", action: "Obtain the selection criterion and the list of the ten schools, establish what is planned for the other eight, and confirm whether the target was formally revised with CBM." },
    { id: "RC-12", issue: "Teacher population being trained and mentored", sourceA: "A01.02 reports 91 teachers trained (5 per school); PPA target is 360 primary teachers", sourceB: "A01.07 reports mentoring for 270 teachers across the 18 schools; the kick-off presentation cites 270 school teachers", why: "Training achievement is being reported against at least three different denominators.", action: "Establish which population each indicator counts and whether the 91, the 270 and the 360 are cumulative, overlapping or separate." },
  ];

  /* --- Technical accessibility standards [AA section 4] -------------------
     The measurable thresholds the retest is judged against. Carrying them in
     the system means a field team can test a ramp against a number rather
     than an impression. Sources: MoEST standards, CBM Accessibility Policy
     2018, Tanzania Persons with Disabilities Act 2010.                   --- */
  const accessibilityStandards = [
    { area: "Ramps — slope", standard: "Ideal 1:20, preferred maximum 1:12 (8%). Stairs should be provided alongside ramps." },
    { area: "Ramps — width", standard: "Minimum 0.9m; 1.5m preferred so a wheelchair user and a walking person can pass." },
    { area: "Ramps — handrails", standard: "Both sides unless one side is a wall. Dual heights: 0.60–0.70m for children and wheelchair users, 0.80–0.90m for others. Wheel guard 0.15–0.20m at the base. Extend 30cm beyond start and end." },
    { area: "Ramps — tactile marking", standard: "Hard non-slip surface. Contrasting tactile markings 0.60m wide at both the beginning and the end of every ramp." },
    { area: "Wheelchair turning space", standard: "Clear circle of 1.50m diameter, free of obstacles." },
    { area: "Footpaths and walkways", standard: "Minimum 1.5m wide, usable in rain. Access roads to the compound 4.5–6m wide. Compound fenced with lockable, managed gates." },
    { area: "Corridors — width", standard: "Minimum clear width 1.3m, preferably 1.5m for a single wheelchair; 1.5m minimum (1.8m preferred) for two-way movement. 1.5m x 1.5m turning space at corridor ends." },
    { area: "Corridors — slope and surface", standard: "Accessible paths not steeper than 1:20. Smooth, firm, level, slip-resistant, differing in texture and colour from surrounding areas." },
    { area: "Corridors — safety", standard: "Free of hazards. Safety barriers or railings of at least 1.0m where there is a risk of falling." },
    { area: "Doors — width", standard: "Exterior doors minimum 0.90m clear opening; interior doors minimum 0.80m; accessible toilet doors minimum 0.90m. On double doors at least one leaf must give 0.90m clear." },
    { area: "Doors — contrast", standard: "Doors and frames painted in contrast to surrounding walls. Labels in high contrast, large print, engraved or Braille." },
    { area: "Toilets — provision", standard: "At least two accessible toilets per public building, one per gender, designed for children with disabilities." },
    { area: "Toilets — room", standard: "Minimum 2.10m x 2.30m, with a 1.50m clear turning circle and at least 0.9m clearance between toilet and sink." },
    { area: "Toilets — door", standard: "Minimum 0.90m clear opening, opening outwards, extended pull handle with a 50mm gap, clear space outside the swing arc." },
    { area: "Toilets — seat and grab bars", standard: "Seat at 0.45m above finished floor. Horizontal and vertical grab bars both sides at 800–850mm, rust-proof, non-slip, anchored to bear at least 110kg. Lever flush on the transfer side." },
    { area: "Toilets — basins", standard: "Two heights: 0.75m for standing users and 0.45m for crawling or lower-height users. Knee clearance minimum 680mm. Push, lever or sensor taps." },
    { area: "Toilets — signage and lighting", standard: "International wheelchair symbol with embossed or Braille text at about 1400mm eye level, high contrast, weatherproof. Well lit; switch no higher than 0.9m. Non-slip level floor." },
    { area: "Urinals", standard: "At least three at different heights, tallest no higher than 0.90m. Clear space 1.5m x 0.80m in front. Non-slip ramps where needed." },
    { area: "Wayfinding", standard: "Sign language symbols displayed along walkways and corridors to guide hearing-impaired pupils to classrooms, offices and toilets." },
  ];

  /* --- Budget & value for money [CL 19] ----------------------------------- */
  const vfm = {
    frame: [
      { item: "Approved total budget", value: "EUR 999,967", source: "Approved Project Plan & Budget" },
      { item: "Approved project period", value: "01.10.2023 – 31.12.2027", source: "Approved Project Plan & Budget" },
      { item: "Direct project cost", value: "EUR 878,320", source: "Approved Project Plan & Budget" },
      { item: "Feasibility VFM observation", value: "88.6% of total budget assessed as Direct Project Cost; support cost assessed at 12.4%", source: "Feasibility Study" },
    ],
    questions: [
      { id: "VFM-1", question: "Were planned resources actually deployed to this region's activities?", evidence: "Budget vs actual expenditure; activity records; procurement." },
      { id: "VFM-2", question: "Did spending produce the intended outputs at the expected quality?", evidence: "BoQs, invoices, training outputs, completed modifications, materials, beneficiary reach." },
      { id: "VFM-3", question: "Were there avoidable delays, duplication or under-utilisation?", evidence: "Workplans, procurement timelines, stock records, meeting minutes." },
      { id: "VFM-4", question: "Were roles and responsibilities clear enough to prevent rework or delays?", evidence: "TORs, role matrices, coordination minutes, escalation records." },
      { id: "VFM-5", question: "For accessibility work, was the cheapest option also technically appropriate and durable?", evidence: "BoQs, specifications, technical supervision, defects/repairs." },
      { id: "VFM-6", question: "For training, is there evidence that the investment translated into changed practice?", evidence: "Pre/post tests, classroom observation, mentoring, retention/attrition." },
      { id: "VFM-7", question: "Could the same result have been achieved with less external support?", evidence: "Government/OPD contributions, existing infrastructure, staff capacity." },
    ],
  };

  /* --- Team Leader end-of-field summary fields [CL 09] -------------------- */
  const teamLeaderSummary = [
    { id: "TL-01", label: "Assessment period" },
    { id: "TL-02", label: "Team members" },
    { id: "TL-03", label: "Schools visited / planned" },
    { id: "TL-04", label: "Key achievements", long: true },
    { id: "TL-05", label: "Most significant gaps", long: true },
    { id: "TL-06", label: "Evidence limitations", long: true },
    { id: "TL-07", label: "Accessibility status across assessed schools", long: true },
    { id: "TL-08", label: "Quality of implementation", long: true },
    { id: "TL-09", label: "Beneficiary-level change", long: true },
    { id: "TL-10", label: "Government engagement / financing change", long: true },
    { id: "TL-11", label: "Safeguarding / inclusion concerns", long: true },
    { id: "TL-12", label: "Top 5 recommendations", long: true },
    { id: "TL-13", label: "Overall preliminary conclusion", long: true },
  ];

  /* --- Source notes [CL 11] ----------------------------------------------- */
  const sourceNotes = [
    { source: "Approved PPA", note: "Project IDEA000650; timeframe 1 July 2023–31 December 2027; overall objective is strengthening inclusive education for quality learning outcomes by 2027." },
    { source: "PPA Results", note: "Five result areas cover access/assessment; teaching and learning; community engagement; assessment/referral/accessibility; and government engagement/financing." },
    { source: "Kick-off presentation", note: "Project goal includes increased access to quality inclusive education; stronger capacity in 18 schools; improved community awareness/engagement; and increased state-actor participation." },
    { source: "Accessibility audit 2025", note: "18 schools were assessed using interviews/FGDs and physical site surveys against Tanzania Persons with Disabilities Act 2010, MoEST standards and CBM accessibility standards." },
    { source: "Accessibility audit 2025 — author", note: "Conducted by Eng. Kesha William Chinguku under agreement CST/ADM/BMZ/2025/005, 17 March – 15 April 2025, covering all 18 schools with interviews, FGDs and physical site surveys. Provides Table 01 demographics and per-school findings and recommendations." },
    { source: "Quarterly Narrative Report, Q1 2025", note: "CST's own report for January–March 2025, submitted 5 April 2025 by Nemes Temba. Names the regions as Songwe, Rukwa and Katavi and gives activity-level reported figures — the claims this assessment tests." },
    { source: "BMZ Narrative Interim Report", note: "Annex 4, project cycle January–June 2025, Year 3, submitted 5 July 2025. Confirms 54-month duration, 1 October 2023 – 31 December 2027, and the same three regions." },
    { source: "Important limitation", note: "The source materials contain inconsistent beneficiary and target figures, school-name variants, disability-category counts that do not sum, and a difference between 18 schools to be modified and 10 selected. These must be reconciled before calculating final achievement percentages." },
    { source: "Proposal (REET)", note: "Assessment covers inception to September 2025, delivered over five weeks; every finding triangulated across at least two of four evidence streams before reporting." },
  ];

  /* --- Deliverables and readiness gates [PR] ------------------------------ */
  const deliverables = [
    { id: "D1", name: "Inception Report: methodology, finalized tools, activity reconstruction matrix, workplan and deployment schedule", due: "End of Week 1" },
    { id: "D2", name: "Data collection tools: verification checklists, interview and FGD guides, asset inspection and observation templates", due: "End of Week 1" },
    { id: "D3", name: "Field verification matrix: planned against verified activities across all regions, with evidence references", due: "End of Week 3" },
    { id: "D4", name: "Draft Programmatic Assessment Report", due: "Week 4" },
    { id: "D5", name: "Preliminary findings presentation to CBM and stakeholders", due: "Week 5" },
    { id: "D6", name: "Final Programmatic Assessment Report, formatted for BMZ reporting", due: "End of Week 5" },
    { id: "D7", name: "Annexes and supporting evidence: photographs, completed templates, anonymized notes, asset lists, attendance records", due: "With final report" },
  ];

  const gates = [
    { id: "G1", name: "Gate 1 – Inception Report approved and document request cleared", when: "End of Week 1" },
    { id: "G2", name: "Gate 2 – Field verification complete across all regions", when: "End of Week 3" },
    { id: "G3", name: "Gate 3 – Draft report accepted by CBM", when: "Week 4" },
    { id: "G4", name: "Gate 4 – Validation session held and corrections agreed", when: "Week 5, before the final report" },
  ];

  /* --- Team roles [PR] ---------------------------------------------------- */
  const teamRoles = [
    "Team Leader / Senior MEL Specialist",
    "Inclusive Education Specialist",
    "Disability Inclusion Expert",
    "Financial and Compliance Auditor",
    "Procurement and Asset Verification Specialist",
    "Research Associate",
    "Data Analyst",
    "Safeguarding Lead",
    "System Administrator",
    "CBM Viewer",
  ];

  /* --- Regions ------------------------------------------------------------ */
  const regions = [
    { id: "SONGWE", name: "Songwe", active: true, rosterStatus: "CONFIRMED", councils: "Tunduma, Ileje and Momba", note: "Six project schools with a full 2025 accessibility baseline. The Sogea ESRAC is the first of the three centres to be equipped." },
    { id: "RUKWA", name: "Rukwa", active: true, rosterStatus: "CONFIRMED", councils: "Kalambo, Sumbawanga MC and Sumbawanga DC", note: "Six project schools with a full 2025 accessibility baseline. Matai A is designated to receive the region's ESRAC equipment." },
    { id: "KATAVI", name: "Katavi", active: true, rosterStatus: "CONFIRMED", councils: "Mpanda, Mpimbwe and Nsimbo", note: "Six project schools with a full 2025 accessibility baseline. Maji Moto is designated to receive the region's ESRAC equipment." },
    { id: "MBEYA", name: "Mbeya", active: false, rosterStatus: "OUT OF SCOPE", councils: "", note: "Not a region of delivery. The proposal names Mbeya, but the 2025 accessibility audit, the Q1 2025 QNR and the BMZ interim report all give Songwe, Rukwa and Katavi, and no project school sits in Mbeya. Retained only so the discrepancy stays visible." },
  ];

  /* --- Schools ------------------------------------------------------------
     All 18 project schools. Councils, wards, enrolment, children with
     disabilities and the disability-category breakdown come from Table 01 of
     the 2025 accessibility audit [AA]; the per-school baseline and planned
     modification come from the audit's school sections and, for Katavi and
     Rukwa, the region checklists [CL 03 / 17 / 24].

     `dataNote` records where the audit's own category counts do not sum to its
     stated total. Those are recorded, not silently corrected — they are
     findings for the MEL data-quality sheet.                              --- */
  const schools = [
    /* --- Katavi [AA / CL 03 / 17 / 24] --- */
    {
      id: "KAT-SCH01", region: "Katavi", name: "Katisunga Primary School", council: "Nsimbo District Council", ward: "Machimboni Ward",
      rosterStatus: "CONFIRMED", pupils: 1072, pupilsMale: 537, pupilsFemale: 535,
      learnersWithDisabilities: 24, cwdMale: 12, cwdFemale: 12, disabilityCategories: "HI 6; PI 7; LV 10; MI 1",
      auditHeadline: "Major physical accessibility gaps", assessmentFocus: "Re-test corridors, ramps, signage, handrails and toilets", priority: "High",
      baseline: "One two-classroom building and administration block had worn corridors/ramps; two buildings lacked corridors/ramps; no contrasting strips/signage; no handrails around hazardous areas, especially new WASH buildings; no disability-friendly toilets.",
      plannedModification: "Resurface existing corridors/ramps; construct accessible corridors/ramps for two buildings; contrasting/tactile strips and signage; continuous handrails; construct accessible toilets for both genders with grab bars, seated WCs, accessible basins and signage.",
      retest: [
        { area: "Classrooms / corridors", recommendation: "Resurface worn corridors/ramps; construct accessible corridors/ramps in two buildings; install continuous handrails." },
        { area: "Signage / visual access", recommendation: "Install 0.60m contrasting/textured strips at ramp ends and clear/tactile signage adjacent to doorways." },
        { area: "Toilets", recommendation: "Construct disability-friendly toilets for both genders with turning space, grab bars, seated WCs, accessible basins and tactile signage." },
      ],
    },
    {
      id: "KAT-SCH02", region: "Katavi", name: "Mnyaki Primary School", council: "Nsimbo District Council", ward: "Katumba Ward",
      rosterStatus: "CONFIRMED", pupils: 1454, pupilsMale: 711, pupilsFemale: 743,
      learnersWithDisabilities: 35, cwdMale: 23, cwdFemale: 12, disabilityCategories: "HI 3; PI 14; LV 12; II 6",
      auditHeadline: "Major physical accessibility gaps", assessmentFocus: "Re-test ramps, corridors, toilets and safety features", priority: "High",
      baseline: "Some ramps reached about 20% slope and lacked handrails; two buildings lacked corridors/ramps; no contrasting strips/signage; no handrails around hazardous areas; disability toilets had inadequate space, barriers and non-functioning WCs.",
      plannedModification: "Reconstruct ramps to accessible slope with handrails; accessible corridors/ramps for two old buildings; contrasting strips/signage; secure handrails; rehabilitate disability toilets with adequate turning space, grab bars, accessible WCs, basins and signage.",
      retest: [
        { area: "Ramps / circulation", recommendation: "Reconstruct steep ramps to accessible slope; provide sturdy handrails; construct accessible corridors/ramps for two old buildings." },
        { area: "Signage / visual access", recommendation: "Install 0.60m contrasting/textured strips and tactile/Braille signage." },
        { area: "Toilets", recommendation: "Rehabilitate disability toilets with 1.5m turning space, grab bars, accessible seated WCs, basins and signage." },
      ],
    },
    {
      id: "KAT-SCH03", region: "Katavi", name: "Nyerere Primary School", council: "Mpanda Municipal Council", ward: "Kiwajense Ward",
      nameVariant: "Ward spelled 'Kawajense' in the region checklist and 'Kiwajense' in the 2025 audit",
      rosterStatus: "CONFIRMED", pupils: 2141, pupilsMale: 1002, pupilsFemale: 1139,
      learnersWithDisabilities: 48, cwdMale: 23, cwdFemale: 25, disabilityCategories: "HI 3; PI 12; LV 3; II 18; MI 12",
      auditHeadline: "Steep/deteriorated ramps; worn floors; poor accessible toilets", assessmentFocus: "Re-test circulation, floors, toilets and usability", priority: "High",
      baseline: "Ramps/stairs were deteriorated and steep (up to 20%); high door thresholds; no contrasting strips/signage or handrails; old classrooms had potholes/corrugation; two accessible toilets were in poor condition and lacked support handles.",
      plannedModification: "Reconstruct/retrofit ramps; curb ramps at thresholds; contrasting strips/signage; continuous handrails; resurface old classroom floors; rehabilitate accessible toilets, add grab bars, functional seated WCs, accessible basins and signage.",
      retest: [
        { area: "Ramps / circulation", recommendation: "Reconstruct/retrofit ramps to max 1:12; provide continuous handrails; address high thresholds with curb ramps." },
        { area: "Classrooms / floors", recommendation: "Repair and resurface old classroom floors to remove potholes and uneven/corrugated surfaces." },
        { area: "Toilets", recommendation: "Rehabilitate two accessible toilets; add grab bars, functional seated WCs, accessible basins and tactile signage." },
      ],
    },
    {
      id: "KAT-SCH04", region: "Katavi", name: "Azimio Primary School", council: "Mpanda Municipal Council", ward: "Majengo Ward",
      rosterStatus: "CONFIRMED", pupils: 586, pupilsMale: 321, pupilsFemale: 265,
      learnersWithDisabilities: 43, cwdMale: 23, cwdFemale: 20, disabilityCategories: "HI 37; PI 3; LV 2; TB 1",
      auditHeadline: "Major building/corridor and toilet gaps", assessmentFocus: "Re-test five buildings, corridors, dormitory access and toilets", priority: "High",
      baseline: "Three buildings lacked corridors/ramps; five buildings were dilapidated with potholes; two classroom corridors were worn; no accessible footpath to dormitory; disability toilets had non-functional WCs and were dilapidated.",
      plannedModification: "Construct accessible corridors/ramps (handrails on higher buildings); contrasting strips/signage; rehabilitate five dilapidated buildings and two worn corridors; improve accessible footpath to dormitory; replace non-functional disability WCs and improve finishing.",
      retest: [
        { area: "Buildings / corridors", recommendation: "Construct accessible corridors/ramps for the affected buildings; fit handrails where height requires; rehabilitate five dilapidated buildings." },
        { area: "Pathways / circulation", recommendation: "Repair worn corridors and provide an accessible footpath to the dormitory." },
        { area: "Toilets", recommendation: "Replace non-functional WCs in the two disability toilets and ensure accessible finishing and support features." },
      ],
    },
    {
      id: "KAT-SCH05", region: "Katavi", name: "Maji Moto Primary School", nameVariant: "Recorded as 'Majimoto Maalum' in CST reporting",
      council: "Mpimbwe District Council", ward: "Maji Moto Ward", esrac: "Designated to receive the Katavi ESRAC equipment",
      rosterStatus: "CONFIRMED", pupils: 50, pupilsMale: 38, pupilsFemale: 12,
      learnersWithDisabilities: 50, cwdMale: 38, cwdFemale: 12, disabilityCategories: "HI 18; PI 10; LV 5; TB 4; II 13",
      dataNote: "Every pupil is recorded as having a disability, confirming the audit's description of a special school. Verify whether project targets counting 'children without disabilities' apply here at all.",
      auditHeadline: "Approx. 95% aligned with inclusive design; remaining handrail/washbasin gaps", assessmentFocus: "Verify remaining gaps and whether accessibility is functional, safe and maintained in practice", priority: "Medium",
      baseline: "School was assessed as approximately 95% aligned with inclusive design; remaining gaps were handrails along long corridors/ramps and accessible toilet washing sinks/handrails.",
      plannedModification: "Install sturdy continuous handrails along long corridors/ramps; install toilet-landing handrails; replace/modify washbasins for wheelchair access.",
      retest: [
        { area: "Corridors / ramps", recommendation: "Install sturdy, continuous handrails along long corridors and ramps." },
        { area: "Toilets", recommendation: "Install handrails at toilet landings and replace/modify washbasins for wheelchair access." },
      ],
    },
    {
      id: "KAT-SCH06", region: "Katavi", name: "Kilida Primary School", council: "Mpimbwe District Council", ward: "Mamba Ward",
      rosterStatus: "CONFIRMED", pupils: 1206, pupilsMale: 604, pupilsFemale: 602,
      learnersWithDisabilities: 11, cwdMale: 5, cwdFemale: 6, disabilityCategories: "HI 2; PI 4; LV 2; II 3",
      auditHeadline: "Major ramp, threshold, signage and toilet gaps", assessmentFocus: "Re-test ramps, thresholds, signage and toilets", priority: "High",
      baseline: "New buildings had steep/high ramps and gaps in handrails; old buildings lacked ramps; high door thresholds; no contrasting strips/signage; no handrails at hazardous areas; toilets were squat type, lacked accessible signage, had non-accessible basins and lacked accessible ramps.",
      plannedModification: "Reconstruct steep ramps to preferably 1:12; provide ramps at all old-building entrances with continuous handrails; curb ramps at thresholds; contrasting strips/signage; construct accessible toilets with turning space, grab bars, seated WCs, accessible basins and tactile signage.",
      retest: [
        { area: "Ramps / circulation", recommendation: "Reconstruct steep ramps to preferably 1:12; construct ramps at old buildings with continuous handrails." },
        { area: "Thresholds / visual access", recommendation: "Install curb ramps at thresholds; 0.60m contrasting/textured strips; clear/tactile signage adjacent to doorways." },
        { area: "Toilets", recommendation: "Replace squat toilets with accessible seated toilets; provide turning space, grab bars, accessible basins, tactile signage and accessible ramps." },
      ],
    },

    /* --- Rukwa [CL 03 / 17] --- */
    {
      id: "RUK-SCH01", region: "Rukwa", name: "Laela B Primary School", nameVariant: "Recorded as 'Laela Primary School' in the 2025 accessibility audit",
      council: "Sumbawanga District Council", ward: "Kasanzama Ward", rosterStatus: "CONFIRMED",
      pupils: 1845, pupilsMale: 845, pupilsFemale: 1000,
      learnersWithDisabilities: 33, cwdMale: 14, cwdFemale: 19, disabilityCategories: "II 11; PI 6; LV 7; HI 9",
      auditHeadline: "Missing corridors/ramps, dilapidated buildings and non-functional disability WCs", assessmentFocus: "Re-test corridors, ramps, building condition and toilets", priority: "High",
      baseline: "3 buildings lacked corridors/ramps; high thresholds; 3 buildings dilapidated; 2 classes incomplete; disability toilets had non-functional WCs.",
      plannedModification: "Accessible corridors/ramps; contrasting strips/signage; renovate dilapidated buildings/complete classrooms; replace non-functional WCs.",
      retest: [
        { area: "Classrooms / corridors", recommendation: "Construct accessible corridors/ramps; renovate dilapidated buildings; complete classrooms." },
        { area: "Toilets", recommendation: "Replace non-functional WCs and ensure disability-friendly toilet access." },
      ],
    },
    {
      id: "RUK-SCH02", region: "Rukwa", name: "Kizwite Primary School", council: "Sumbawanga Municipal Council", ward: "Kizwite Ward",
      rosterStatus: "CONFIRMED", pupils: 2245, pupilsMale: 1112, pupilsFemale: 1133,
      learnersWithDisabilities: 130, cwdMale: 71, cwdFemale: 59, disabilityCategories: "II 91; PI 2; HI 37",
      dataNote: "The largest cohort of children with disabilities in the project (130). Verify the identification and assessment records behind this figure.",
      auditHeadline: "Steep ramps without handrails; hazardous high foundation areas", assessmentFocus: "Re-test ramp gradients, handrails, signage and toilet support features", priority: "High",
      baseline: "Ramps around 90:400 were too steep and lacked handrails; no contrasting strips/signage; hazardous/high foundation areas; disability toilets existed but lacked handrails.",
      plannedModification: "Ramps at proper gradient with handrails; contrasting strips/signage; toilet handrails.",
      retest: [
        { area: "Ramps / circulation", recommendation: "Proper gradients and handrails; contrasting strips and signage." },
        { area: "Toilets", recommendation: "Install protective support handrails in disability toilets." },
      ],
    },
    {
      id: "RUK-SCH03", region: "Rukwa", name: "Matai A Primary School",
      nameVariant: "'Matai A' in CST reporting and the region checklist; the 2025 audit uses 'Matai Primary School' in its narrative and 'Matai “B”' in its demographic table",
      council: "Kalambo District Council", ward: "Matai Ward", rosterStatus: "CONFIRMED",
      esrac: "Designated to receive the Rukwa ESRAC equipment",
      pupils: 817, pupilsMale: 405, pupilsFemale: 412,
      learnersWithDisabilities: 25, cwdMale: 11, cwdFemale: 14, disabilityCategories: "II 19; MI 2; HI 4",
      auditHeadline: "Six buildings without proper ramps/corridors; dilapidated classrooms", assessmentFocus: "Re-test corridors, ramps, classroom condition and accessible toilets", priority: "High",
      baseline: "One improper ramp and no ramps/corridors for the other buildings; six buildings affected; no contrasting strips/signage; dilapidated classrooms/potholes; audit noted need for accessible toilets.",
      plannedModification: "Accessible corridors/ramps; contrasting strips/signage; renovate dilapidated buildings; construct accessible toilets.",
      retest: [
        { area: "Buildings / circulation", recommendation: "Construct corridors and ramps; address dilapidated buildings and potholes." },
        { area: "Toilets", recommendation: "Construct accessible toilets with grab bars and accessible sinks." },
      ],
    },
    {
      id: "RUK-SCH04", region: "Rukwa", name: "Msanzi A Primary School", council: "Kalambo District Council", ward: "Msanzi Ward",
      rosterStatus: "CONFIRMED", pupils: 706, pupilsMale: 351, pupilsFemale: 355,
      learnersWithDisabilities: 20, cwdMale: 13, cwdFemale: 7, disabilityCategories: "II 6; LV 2; PI 8; II 6 (as printed)",
      dataNote: "The 2025 audit lists 'II' twice for this school and the categories sum to 22, not the stated total of 20. Reconcile the category breakdown with the school register before using this figure.",
      auditHeadline: "Old buildings in a road reserve; no disability-friendly toilets", assessmentFocus: "Verify replacement structures, signage and accessible toilets", priority: "High",
      baseline: "Old buildings were in a road reserve/right-of-way and lacked accessible features; new buildings lacked protection/signage/contrasting strips; no disability-friendly toilets.",
      plannedModification: "Phase out old buildings and replace with accessible structures; contrasting strips/signage; toilet handrails; accessible toilets with grab bars/sinks.",
      retest: [
        { area: "Buildings / circulation", recommendation: "Phase out old inaccessible structures where required; provide accessible replacement structures." },
        { area: "Toilets / signage", recommendation: "Accessible toilets, handrails, contrasting strips and signage." },
      ],
    },
    {
      id: "RUK-SCH05", region: "Rukwa", name: "Malangali Primary School", council: "Sumbawanga Municipal Council", ward: "Malangala Ward",
      rosterStatus: "CONFIRMED", pupils: 105, pupilsMale: 58, pupilsFemale: 47,
      learnersWithDisabilities: 100, cwdMale: 54, cwdFemale: 46, disabilityCategories: "MI 7; PI 4; LV 58; TB 31",
      dataNote: "100 of 105 pupils are recorded as having a disability, and 58 have low vision. Confirm whether this is a special/resource school; it materially changes any per-school achievement denominator.",
      auditHeadline: "No proper main entry; severely worn corridors; inaccessible toilets", assessmentFocus: "Re-test main entry, corridor surfaces and toilet functionality", priority: "High",
      baseline: "No proper main entry; corridors severely worn with potholes/uneven surfaces; inaccessible toilets; disrepair in WC/squat toilets.",
      plannedModification: "Proper main entry; renovate/resurface corridors; contrasting strips/signage; toilet handrails; replace non-functional WCs/squat toilets.",
      retest: [
        { area: "Main entry / corridors", recommendation: "Proper main entry; renovate/resurface corridors; remove uneven surfaces." },
        { area: "Toilets", recommendation: "Install handrails and replace non-functional WC/squat toilets." },
      ],
    },
    {
      id: "RUK-SCH06", region: "Rukwa", name: "Mukamanye Primary School", nameVariant: "Recorded as 'Mukanye' in the kick-off materials",
      council: "Sumbawanga District Council", ward: "Muze Ward", rosterStatus: "CONFIRMED",
      pupils: 1195, pupilsMale: 548, pupilsFemale: 647,
      learnersWithDisabilities: 35, cwdMale: 19, cwdFemale: 16, disabilityCategories: "HI 5; PI 12; LV 3; II 15",
      auditHeadline: "No accessible corridors/ramps; valley adjacent to premises creates a safety risk", assessmentFocus: "Re-test corridors, doorway widths, valley safety measures and toilets", priority: "High",
      baseline: "No accessible corridors/ramps in three buildings; narrow doorways; incomplete building; valley near premises creating safety risk, particularly for children with low vision; no disability-friendly toilets.",
      plannedModification: "Accessible corridors/ramps; protective fencing/safe walkways around valley; contrasting strips/signage; renovate/complete buildings; accessible toilets with grab bars/sinks.",
      retest: [
        { area: "Buildings / corridors", recommendation: "Construct accessible corridors/ramps; complete unfinished classrooms; accessible doors." },
        { area: "Safety / pathways", recommendation: "Protect valley and provide safe walkways, especially for children with low vision." },
        { area: "Toilets", recommendation: "Construct accessible toilets with grab bars and accessible sinks." },
      ],
    },

    /* --- Songwe [AA sections 3.1–3.6] --- */
    {
      id: "SON-SCH01", region: "Songwe", name: "Ilulu Primary School", council: "Ileje District Council", ward: "Isongole Ward",
      rosterStatus: "CONFIRMED", established: 1973, pupils: 389, pupilsMale: 171, pupilsFemale: 218,
      learnersWithDisabilities: 19, cwdMale: 11, cwdFemale: 8, disabilityCategories: "II 9; PI 5; LV 5",
      auditHeadline: "Steep ramp without handrails; no accessible toilet design; deteriorated ramps",
      assessmentFocus: "Re-test ramp gradient and handrails, signage, and the accessible toilet build", priority: "High",
      baseline: "One improperly constructed ramp (too steep) and no handrails; no 0.60m contrasting/textured strips at ramp ends; no signage on doorframes or adjoining walls; no handrails around hazardous areas, stairs and ramps. Toilet cubicles under 1.5m with no turning space, no grab bars, squat toilets only, no tactile or Braille signage, basins too high with no knee clearance, and existing ramps largely deteriorated.",
      plannedModification: "Construct or retrofit ramps to a gradient not exceeding 1:12 with dual-height handrails at 80cm; 0.60m contrasting textured strips at both ramp ends; durable contrasting signage adjacent to doorways; continuous child-friendly handrails extending 30cm beyond start and end. Construct disability-friendly toilets for both genders with 1.5m turning space, 900mm doorways, grab bars at 800–850mm, one seated WC per gender, tactile/Braille signage at 1400mm, and basins at 650–700mm with 680mm knee clearance.",
      retest: [
        { area: "Ramps / circulation", recommendation: "Construct or retrofit ramps to a gradient not exceeding 1:12 with handrails on both sides at dual heights (80cm); continuous handrails extending 30cm beyond the start and end of every ramp and stair." },
        { area: "Signage / visual access", recommendation: "Install 0.60m contrasting and textured strips at both ends of all ramps; provide durable contrasting signage adjacent to doorways rather than on the doors." },
        { area: "Toilets", recommendation: "Construct disability-friendly toilets for both genders: 1.5m turning space, 900mm outward-opening doors, grab bars at 800–850mm, one seated WC per gender, tactile/Braille signage, basins at 650–700mm with 680mm knee clearance. Reconstruct the deteriorated ramps at 1:12, minimum 1.2m wide, non-slip." },
      ],
    },
    {
      id: "SON-SCH02", region: "Songwe", name: "Msia Primary School", nameVariant: "Carried as 'Nsia' in earlier project documentation",
      council: "Ileje District Council", ward: "Chitete Ward",
      rosterStatus: "CONFIRMED", established: 2023, pupils: 662, pupilsMale: 310, pupilsFemale: 352,
      learnersWithDisabilities: 17, cwdMale: 10, cwdFemale: 7, disabilityCategories: "II 4; PI 7; LV 5; HI 1",
      auditHeadline: "Steep and deteriorated ramps; no formalised footpaths; squat toilets only",
      assessmentFocus: "Re-test ramp geometry against the recorded 85:220 rise-to-run, corridor handrails and toilet provision", priority: "High",
      baseline: "Ramps poorly designed and too steep at several points (85 rise : 220 run) with no supporting handrails; two other ramps at appropriate slope but deteriorated. No tactile or contrasting colour strips (0.60m) at ramp ends. Signage not positioned on adjacent walls or doorframes. No protective handrails around dangerous areas, specifically corridors where two buildings stand 50–80cm high. No formalised footpaths anywhere on the premises. Squat toilets only.",
      plannedModification: "Construct and retrofit ramps at a gradient not exceeding 1:12 with dual-height handrails at 80cm, built parallel to the corridor rather than perpendicular given the 50–85cm building height; 0.60m contrasting textured strips; contrasting signage adjacent to doorways; continuous handrails on both sides of stairs and ramps and one side of the corridor. Construct accessible toilets for both genders to the standard turning space, grab bar, seated WC, signage and basin specification.",
      retest: [
        { area: "Ramps / corridors", recommendation: "Retrofit ramps to a maximum 1:12 gradient with dual-height handrails at 80cm, constructed parallel to the corridor because two buildings stand only 50–85cm high; continuous handrails on both sides of stairs and ramps and one side of the corridor." },
        { area: "Footpaths / signage", recommendation: "Formalise footpaths across the school premises; install 0.60m contrasting textured strips at ramp ends and contrasting signage adjacent to doorways." },
        { area: "Toilets", recommendation: "Construct accessible toilets for both genders: 1.5m turning space, 900mm doors, grab bars at 800–850mm, one seated WC per gender, tactile/Braille signage, basins at 650–700mm. Reconstruct ramps at 1:12, minimum 1.5m wide, non-slip." },
      ],
    },
    {
      id: "SON-SCH03", region: "Songwe", name: "Sogea Primary School", council: "Tunduma District Council", ward: "Sogea Ward",
      esrac: "Hosts the Songwe ESRAC; equipment purchased, awaiting government room renovation",
      rosterStatus: "CONFIRMED", established: 2012, pupils: 1882, pupilsMale: 901, pupilsFemale: 981,
      learnersWithDisabilities: 30, cwdMale: 19, cwdFemale: 11, disabilityCategories: "II 9; PI 5; LV 12; HI 2",
      dataNote: "The 2025 audit's category breakdown sums to 28 against a stated total of 30. Reconcile with the school register.",
      auditHeadline: "Steep ramps in two buildings; four incomplete classrooms; high door thresholds",
      assessmentFocus: "Re-test ramps, classroom completion and floor condition, thresholds and the ESRAC room", priority: "High",
      baseline: "Improperly constructed ramps (60 rise : 195 run) in two buildings, too steep and without handrails. Four classes incomplete with many floor potholes preventing wheelchair manoeuvrability. High thresholds at doorways in one building. No 0.60m contrasting textured strips at any ramp. No signage on doorframes or adjoining walls. No handrails around hazardous areas, stairs, ramps or corridors. Toilet cubicles too narrow with no 1.5m turning space; squat toilets only.",
      plannedModification: "Upgrade ramps to no steeper than 1:12 with dual-height handrails at 80cm; complete the four classrooms (plaster, paint, doors and windows) and repair all floor surfaces; install curb ramps at high thresholds; 0.60m contrasting textured strips; contrasting signage beside doorways; continuous handrails extending 30cm beyond every slope and staircase. Construct accessible toilets to the standard specification.",
      retest: [
        { area: "Ramps / circulation", recommendation: "Upgrade ramps to a gradient no steeper than 1:12 with dual-height handrails at 80cm; install curb ramps at high door thresholds with contrasting markings; continuous handrails extending 30cm beyond each slope and staircase." },
        { area: "Classrooms / floors", recommendation: "Complete the four unfinished classrooms — plaster, paint, doors and windows — and repair all floor surfaces to a smooth, level, firm finish for wheelchair users." },
        { area: "Toilets", recommendation: "Construct toilet cubicles with 1.5m turning space and 900mm doorways, grab bars at 800–850mm, one seated WC per gender, tactile/Braille signage at 1400mm, basins at 650–700mm; ramps at 1:12, minimum 1.2m wide." },
        { area: "ESRAC facility", recommendation: "Verify the ESRAC room renovation, the installed equipment against the procurement record, and whether assessment services are actually running." },
      ],
    },
    {
      id: "SON-SCH04", region: "Songwe", name: "Chiwezi Primary School", nameVariant: "Carried as 'Chiyezi' in earlier project documentation",
      council: "Tunduma District Council", ward: "Chiwezi Ward",
      rosterStatus: "CONFIRMED", established: 1975, pupils: 557, pupilsMale: 270, pupilsFemale: 287,
      learnersWithDisabilities: 14, cwdMale: 9, cwdFemale: 5, disabilityCategories: "II 3; PI 3; LV 2; MI 6",
      auditHeadline: "Corridors only 1100mm wide; two buildings without corridors; no disability toilets at all",
      assessmentFocus: "Measure corridor widths against the 1500mm standard; verify the incomplete building and toilet construction", priority: "High",
      baseline: "Existing corridors only 1100mm wide, insufficient for wheelchair access, and two buildings lack corridors entirely. Two classroom buildings have floors with potholes; one building of three classes is entirely incomplete. No 0.60m contrasting textured strips at ramp ends. No signage on doorframes or adjoining walls. No disability-friendly toilets for either gender, and existing toilets have no ramps at all.",
      plannedModification: "Widen existing corridors to a minimum of 1500mm and construct new covered accessible corridors in the two buildings without them, with firm non-slip surfaces and turning spaces every 20 metres; rehabilitate classroom floors and complete the unfinished three-class building; 0.60m contrasting textured strips; contrasting signage adjacent to doorways. Construct disability-friendly toilets for both genders to the standard specification.",
      retest: [
        { area: "Corridors / circulation", recommendation: "Widen corridors to a minimum of 1500mm and construct new covered accessible corridors in the two buildings that lack them, with firm non-slip surfaces and turning spaces every 20 metres." },
        { area: "Classrooms / floors", recommendation: "Repair all classroom floor potholes to a smooth, level, non-slip finish and complete the unfinished three-class building to basic accessibility and safety standards." },
        { area: "Toilets", recommendation: "Construct disability-friendly toilets for both genders with 1.5m turning space, 900mm doors, grab bars, one seated WC per gender, tactile signage and accessible basins, plus the missing access ramps." },
      ],
    },
    {
      id: "SON-SCH05", region: "Songwe", name: "Ndalambo Primary School", council: "Momba District Council", ward: "Ndalambo Ward",
      rosterStatus: "CONFIRMED", established: 1954, pupils: 1222, pupilsMale: 672, pupilsFemale: 550,
      learnersWithDisabilities: 54, cwdMale: 30, cwdFemale: 24, disabilityCategories: "II 21; PI 12; LV 10; HI 11",
      auditHeadline: "None of the five buildings have corridors or ramps; inadequate classroom lighting; dilapidated classrooms",
      assessmentFocus: "Re-test corridor and ramp construction across all five buildings, window and door sizing, and toilet refurbishment", priority: "High",
      baseline: "None of the five buildings have corridors or ramps, making classroom access difficult for wheelchair users. No 0.60m contrasting textured strips at ramp ends. No signage on doorframes or adjoining walls. All classrooms have inadequate lighting from small windows (120x100cm) and doors of only about 80cm. Most classrooms are dilapidated and pose safety risks. The two toilets for pupils with disabilities are in poor condition, never refurbished, missing support handrails, and their doors are only 80cm wide.",
      plannedModification: "Construct corridors and accessible ramps at a preferred 1500mm width and maximum 1:12 slope, without handrails since average building height is 40cm; 0.60m contrasting textured strips; tactile signage on doorframes or adjacent walls; enlarge windows to at least 150x150cm and widen doors to at least 900mm; renovate the five dilapidated buildings. Renovate the disability toilets with Western-type WCs and support handrails at 850mm, and replace doors with 900mm minimum width.",
      retest: [
        { area: "Corridors / ramps", recommendation: "Construct corridors and accessible ramps at 1500mm preferred width and a maximum 1:12 slope across all five buildings; handrails are not required as average building height is 40cm." },
        { area: "Classroom lighting & doors", recommendation: "Enlarge windows to at least 150x150cm for natural lighting and widen doors to at least 900mm; renovate the five dilapidated buildings to structural safety and accessibility standards." },
        { area: "Toilets", recommendation: "Renovate the two disability-designated toilets with durable accessible designs, new Western-type WCs and support handrails at 850mm on both sides; replace the 80cm doors with minimum 900mm doors." },
      ],
    },
    {
      id: "SON-SCH06", region: "Songwe", name: "Kitete Primary School", council: "Momba District Council", ward: "Chitete Ward",
      rosterStatus: "CONFIRMED", established: 1954, pupils: 1100, pupilsMale: 468, pupilsFemale: 632,
      learnersWithDisabilities: 29, cwdMale: 21, cwdFemale: 8, disabilityCategories: "II 10; PI 10; LV 4; HI 5",
      auditHeadline: "Ramp at 20:120; no corridors or ramps on five buildings; four dilapidated buildings; no disability toilets",
      assessmentFocus: "Re-test ramp gradients, corridor construction, building renovation and toilet completion", priority: "High",
      baseline: "Improperly constructed ramps, too steep at 20 rise : 120 run. None of the five buildings have corridors or ramps. No 0.60m contrasting textured strips at ramp ends. No signage on doorframes or adjoining walls. Most classrooms dilapidated and posing safety risks. No disability-friendly toilets for either gender, and the existing squat toilets are incomplete and unfinished.",
      plannedModification: "Construct or retrofit ramps at a gradient not exceeding 1:12 with dual-height handrails at 80cm; construct corridors and accessible ramps at 1500mm preferred width and 1:12 maximum slope, without handrails given the 40cm average building height; 0.60m contrasting textured strips; contrasting signage adjacent to doorways; renovate the four dilapidated buildings. Construct disability-friendly toilets for both genders to the standard specification.",
      retest: [
        { area: "Ramps / corridors", recommendation: "Retrofit the 20:120 ramp to a maximum 1:12 gradient with dual-height handrails; construct corridors and accessible ramps at 1500mm width across the five buildings that lack them." },
        { area: "Buildings / signage", recommendation: "Renovate the four dilapidated buildings to structural safety and accessibility standards; install 0.60m contrasting textured strips and contrasting signage adjacent to doorways." },
        { area: "Toilets", recommendation: "Construct disability-friendly toilets for both genders with 1.5m turning space, 900mm doors, grab bars, one seated WC per gender, tactile signage and accessible basins; complete and finish the existing squat toilets." },
      ],
    },
  ];

  /* --- Column definitions for the open registers -------------------------- */
  const registers = {
    /* Evidence register [CL 07] */
    evidence: [
      { key: "type", label: "Evidence type", type: "select", options: ["", "Document / record", "Register", "Photograph (geo-tagged)", "Physical inspection note", "Interview / FGD note", "Financial record", "Procurement / BoQ", "Other"] },
      { key: "name", label: "Document / record name" },
      { key: "period", label: "Date / period" },
      { key: "location", label: "Location" },
      { key: "supports", label: "Indicator / result supported" },
      { key: "copy", label: "Original / copy", type: "select", options: ["", "Original sighted", "Copy", "Photograph of original", "Not sighted"] },
      { key: "verifiedWith", label: "Verified with whom" },
      { key: "consistency", label: "Consistency check", type: "select", options: ["", "CONSISTENT", "MINOR DISCREPANCY", "MATERIAL DISCREPANCY", "NOT CHECKED"] },
      { key: "stream", label: "Evidence stream", type: "select", options: ["", ...evidenceStreams.map((s) => s.name)] },
      { key: "finding", label: "Finding", type: "textarea" },
    ],
    /* Findings & recommendations [CL 08] */
    findings: [
      { key: "level", label: "School / level" },
      { key: "result", label: "Result", type: "select", options: ["", ...results.map((r) => r.id)] },
      { key: "finding", label: "Finding", type: "textarea" },
      { key: "evidence", label: "Evidence (IDs)" },
      { key: "rootCause", label: "Root cause / contributing factor", type: "textarea" },
      { key: "effect", label: "Effect / significance", type: "textarea" },
      { key: "severity", label: "Severity", type: "select", options: ["", ...scales.severity] },
      { key: "recommendation", label: "Recommendation", type: "textarea" },
      { key: "owner", label: "Responsible party" },
      { key: "timeframe", label: "Suggested timeframe" },
      { key: "priority", label: "Priority", type: "select", options: ["", ...scales.priority] },
      { key: "status", label: "Status", type: "select", options: ["OPEN", "IN DISCUSSION", "AGREED", "CLOSED"] },
    ],
    /* Child journey [CL 16] — coded case IDs only, never names */
    childJourney: [
      { key: "caseId", label: "Case ID (no name)" },
      { key: "profile", label: "Child profile / disability category" },
      { key: "identified", label: "Identified", type: "select", options: scales.yesNo },
      { key: "assessed", label: "Assessed", type: "select", options: scales.yesNo },
      { key: "referred", label: "Referred", type: "select", options: scales.yesNo },
      { key: "service", label: "Rehabilitation / service received", type: "select", options: scales.yesNo },
      { key: "device", label: "Assistive device", type: "select", options: scales.yesNo },
      { key: "iep", label: "IEP / individual support", type: "select", options: scales.yesNo },
      { key: "enrolled", label: "Enrolled / attending", type: "select", options: scales.yesNo },
      { key: "change", label: "Observed change / remaining barrier", type: "textarea" },
    ],
    /* Daily debrief [CL 22] */
    debrief: [
      { key: "date", label: "Date", type: "date" },
      { key: "location", label: "School / location" },
      { key: "surprise", label: "What surprised us?", type: "textarea" },
      { key: "changed", label: "What evidence changed our initial understanding?", type: "textarea" },
      { key: "childIssue", label: "Most important child-level issue", type: "textarea" },
      { key: "systemIssue", label: "Most important system-level issue", type: "textarea" },
      { key: "followUp", label: "Follow-up before leaving", type: "textarea" },
      { key: "notes", label: "Team lead notes", type: "textarea" },
    ],
    /* Report evidence map [CL 23] */
    evidenceMap: [
      { key: "conclusion", label: "Finding / conclusion", type: "textarea" },
      { key: "criterion", label: "Result / DAC criterion" },
      { key: "claim", label: "Claim made", type: "textarea" },
      { key: "evidenceIds", label: "Evidence ID(s)" },
      { key: "source1", label: "Triangulation source 1" },
      { key: "source2", label: "Triangulation source 2" },
      { key: "observed", label: "Direct observation?", type: "select", options: scales.yesNo },
      { key: "contradictory", label: "Contradictory evidence?", type: "textarea" },
      { key: "confidence", label: "Confidence", type: "select", options: ["", ...scales.confidence] },
      { key: "wording", label: "Final wording", type: "textarea" },
    ],
    /* MEL data quality & claim verification [CL 18] */
    dataQuality: [
      { key: "claim", label: "Indicator / claim", type: "textarea" },
      { key: "definition", label: "Definition clear?", type: "select", options: scales.yesNo },
      { key: "numerator", label: "Numerator verified?", type: "select", options: scales.yesNo },
      { key: "denominator", label: "Denominator verified?", type: "select", options: scales.yesNo },
      { key: "disaggregation", label: "Disaggregation available?", type: "select", options: scales.yesNo },
      { key: "source", label: "Source document" },
      { key: "crossCheck", label: "Cross-check source" },
      { key: "consistent", label: "Data consistent?", type: "select", options: scales.yesNo },
      { key: "rating", label: "Rating", type: "select", options: ["", ...ratingValues] },
      { key: "action", label: "Action before reporting", type: "textarea" },
    ],
  };

  return {
    meta, scales, gradeValues, ratingValues, evidenceStreams, buildingBlocks,
    architectureLayers, results, fieldQuestions, interviewQuestions, respondentTypes,
    stakeholders, activities, baselineIndicators, dacCriteria, sustainabilityAssets,
    learningAreas, reconciliation, vfm, teamLeaderSummary, sourceNotes,
    deliverables, gates, teamRoles, regions, schools, registers,
    accessibilityStandards,
  };
})();
