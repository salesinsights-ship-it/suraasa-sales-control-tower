/* ============================================================
   SEED DATA — Suraasa Sales Project Management Control Tower
   Conventions:
   - Any value beginning with "TBD" is unconfirmed and must be assigned by the Head of Sales.
   - "(proposed)" marks a recommendation made during structuring, not a confirmed fact.
   - Dates: start/due dates are PROPOSED planning dates unless the brief stated otherwise.
   - Progress is 0 unless the brief stated the work as done. Nothing is fabricated.
   ============================================================ */
function buildSeed() {
  const HOS = 'Head of Sales';
  const AK = 'AK';
  const ANKIT = 'Ankit Khanna';
  const PM = 'TBD — proposed: Project Manager';
  const SOPS = 'TBD — proposed: Sales Operations';
  const CRM = 'TBD — proposed: CRM/Tech';
  const MKT = 'TBD — proposed: Marketing';
  const B2B = 'TBD — proposed: B2B Sales';
  const PROD = 'TBD — proposed: Product';
  const SET = 'Setters';
  const CLO = 'Closers';
  const TBD = 'TBD';

    const roles = [
    { name: 'Head of Sales', kind: 'Confirmed', note: 'Overall portfolio oversight and strategic decisions.' },
    { name: 'AK', kind: 'Confirmed', note: 'Vouchers, approvals, incentives; contributed to messaging revision.' },
    { name: 'Ankit Khanna', kind: 'Confirmed', note: 'Vouchers, approvals, incentives.' },
    { name: 'Divya', kind: 'Confirmed', note: 'Contributed to messaging revision.' },
    { name: 'Atishay', kind: 'Confirmed', note: 'Contributed to messaging revision.' },
    { name: 'Setters', kind: 'Confirmed (team)', note: 'Lead engagement, qualification, chat and setter SLA execution.' },
    { name: 'Closers', kind: 'Confirmed (team)', note: 'Counselling, deal management and deal-loss reactivation.' },
    { name: 'Project Manager', kind: 'Proposed role', note: 'Proposed PMO role to run the control tower. Not a confirmed employee.' },
    { name: 'Sales Operations', kind: 'Proposed role', note: 'Trackers, CRM views, reporting, SLA compliance.' },
    { name: 'Shrayansh Sood', kind: 'Confirmed', note: 'CRM/Tech lead.' },
    { name: 'CRM/Tech', kind: 'Proposed role', note: 'CRM triggers, fields, integrations, logging.' },
    { name: 'Marketing', kind: 'Proposed role', note: 'Campaigns, promotion, registration journeys.' },
    { name: 'B2B Sales', kind: 'Proposed role', note: 'School/principal/HR outreach and institutional selling.' },
    { name: 'Product', kind: 'Proposed role', note: 'Observe journey, job platform integration.' },
    { name: 'School HR leaders', kind: 'External', note: 'External stakeholders in Suraasa Hire.' },
    { name: 'School principals', kind: 'External', note: 'External stakeholders in Suraasa Share and school partnerships.' },
    { name: 'School leaders (podcast guests)', kind: 'External', note: 'Podcast guests and B2B relationship targets.' },
    { name: 'PRJ-06 owner (TBD)', kind: 'Proposed role', note: 'Owner of PRJ-06 (Career Launchpad).' },
    { name: 'PRJ-13 owner (TBD)', kind: 'Proposed role', note: 'Owner of PRJ-13 (Suraasa Share).' }
  ];

  const programs = [
    { id: 'SI-01', name: 'Teacher Employment Ecosystem', objective: 'Connect Suraasa teachers with school employment opportunities; monetise through Suraasa Hire; use the podcast as the relationship channel. One shared school-outreach engine — no duplicate outreach.', children: ['PRJ-06', 'PRJ-12', 'OPS-03'], note: 'Proposed grouping. Career Launchpad = teacher supply + platform; Suraasa Hire = school demand + LOIs + fulfilment; Podcast = relationship channel feeding both.' },
    { id: 'SI-02', name: 'UAE Market', objective: 'Generate and convert UAE B2C revenue through campaigns (demand) and a dedicated lead-handling motion (conversion).', children: ['PRJ-04', 'PRJ-05'], note: 'Proposed grouping. Kept as two linked projects per the brief — campaigns own demand, Leads owns conversion and revenue.' },
    { id: 'SI-03', name: 'Deal-Loss Recovery', objective: 'Recover revenue from lost deals via two distinct mechanisms: a time-boxed offer experiment and a permanent CRM-led closer reactivation process.', children: ['EXP-01', 'PRJ-07'], note: 'Proposed grouping. Experiment and process are kept distinct per the brief.' },
    { id: 'SI-04', name: 'Setter Productivity & Funnel Velocity', objective: 'Raise speed and completeness of setter engagement: 3-day SLA, live chat, no-show reactivation, optimised messaging.', children: ['PRJ-10', 'OPS-01', 'PRJ-09', 'OPS-02', 'PRJ-11'], note: 'Proposed grouping for weekly review purposes.' }
  ];

  // ---------- PROJECTS ----------
  const projects = [
    {
      id: 'PRJ-01', name: 'Ambassador Program', category: 'Revenue Generation', type: 'Project', program: null,
      objective: 'Build and operationalise an ambassador-led acquisition channel that generates leads, SQLs, registrations and revenue.',
      problem: 'No structured ambassador channel exists today; acquisition is not leveraging advocates in a measurable way.',
      outcome: 'A defined ambassador model with an onboarded first cohort, an active engagement cadence and attributed pipeline/revenue.',
      impact: 'New acquisition channel (revenue). Impact size TBD until targets are set.',
      metrics: ['Ambassadors onboarded (target TBD)', 'Leads attributed to ambassadors', 'SQLs attributed', 'Registrations attributed', 'Revenue attributed'],
      owner: PM, accountable: TBD + ' — proposed: Project Manager', sponsor: HOS,
      start: '2026-11-10', due: '2027-01-31', datesProposed: true,
      status: 'Not Started', priority: 'P2', priorityProposed: true,
      priorityRationale: 'Revenue-generating but needs model, incentive approval and recruitment before any pipeline appears; medium effort, incentive dependency on AK/Ankit. Proposed P2 (important capability).',
      valueClass: 'Revenue-generating',
      dependencies: ['Incentive decisions (DEP-01)', 'CRM attribution fields (CRM/Tech)'],
      risks: ['Incentive structure not approved in time', 'Attribution overlap with Referral Plan'],
      assumptions: ['Ambassadors are drawn from existing teachers/learners (to confirm)'],
      workstreams: [
        { id: 'WS-01A', name: 'Model & incentives' }, { id: 'WS-01B', name: 'Recruitment & onboarding' },
        { id: 'WS-01C', name: 'Activation & engagement' }, { id: 'WS-01D', name: 'Tracking & reporting' }
      ],
      milestones: [
        { id: 'MS-01-1', name: 'Ambassador model & incentive structure approved', due: '2026-11-21', status: 'Pending', ws: 'WS-01A' },
        { id: 'MS-01-2', name: 'First ambassador cohort onboarded', due: '2026-12-12', status: 'Pending', ws: 'WS-01B' },
        { id: 'MS-01-3', name: 'Activation plan and engagement cadence live', due: '2026-12-19', status: 'Pending', ws: 'WS-01C' },
        { id: 'MS-01-4', name: 'First monthly ambassador performance report', due: '2027-01-31', status: 'Pending', ws: 'WS-01D' }
      ],
      raci: [
        { item: 'Project outcome', R: [PM], A: TBD + ' — proposed: Project Manager', C: [HOS, AK, ANKIT], I: [SOPS] },
        { item: 'Incentive structure', R: [PM], A: HOS, C: [AK, ANKIT], I: [SOPS] },
        { item: 'Ambassador recruitment & onboarding', R: [PM, SOPS], A: TBD, C: [HOS], I: [SET] },
        { item: 'Tracking & attribution', R: [SOPS, CRM], A: TBD, C: [PM], I: [HOS] }
      ],
      nextAction: 'Assign a project owner, then define the ambassador model (first task).',
      flags: ['Owner TBD', 'Targets TBD', 'Incentives need AK/Ankit decision'],
      comments: []
    },
    {
      id: 'PRJ-02', name: 'Referral Plan', category: 'Revenue Generation', type: 'Project', program: null,
      objective: 'Build a structured, tracked referral acquisition channel with defined mechanics, journeys, cadence and incentives.',
      problem: 'Referrals are not run as a structured channel with attribution and a defined journey.',
      outcome: 'Referral mechanics live, communication journeys running on cadence, attribution in CRM, leads/SQLs/conversions reported.',
      impact: 'Low-cost acquisition channel (revenue). Size TBD until targets set.',
      metrics: ['Referrals received', 'Referral leads → SQLs', 'Referral conversions', 'Cost per referral conversion'],
      owner: PM, accountable: TBD + ' — proposed: Project Manager', sponsor: HOS,
      start: '2026-11-10', due: '2027-01-15', datesProposed: true,
      status: 'Not Started', priority: 'P2', priorityProposed: true,
      priorityRationale: 'Revenue channel with low external dependency except incentives and CRM attribution. Proposed P2; can move to P1 once incentives are approved.',
      valueClass: 'Revenue-generating',
      dependencies: ['Referral incentive decision (DEP-01)', 'CRM attribution (CRM/Tech)'],
      risks: ['Attribution conflict with Ambassador Program', 'Incentive approval delay'],
      assumptions: ['Referral base = existing learners (to confirm)'],
      workstreams: [
        { id: 'WS-02A', name: 'Mechanics & incentives' }, { id: 'WS-02B', name: 'Communication journeys' },
        { id: 'WS-02C', name: 'Tracking & attribution' }, { id: 'WS-02D', name: 'Launch & monitoring' }
      ],
      milestones: [
        { id: 'MS-02-1', name: 'Referral mechanics & incentives approved', due: '2026-11-21', status: 'Pending', ws: 'WS-02A' },
        { id: 'MS-02-2', name: 'Referral journeys and tracking live', due: '2026-12-12', status: 'Pending', ws: 'WS-02B' },
        { id: 'MS-02-3', name: 'Referral programme launched', due: '2026-12-19', status: 'Pending', ws: 'WS-02D' },
        { id: 'MS-02-4', name: 'First referral conversion report', due: '2027-01-15', status: 'Pending', ws: 'WS-02D' }
      ],
      raci: [
        { item: 'Project outcome', R: [PM], A: TBD + ' — proposed: Project Manager', C: [HOS], I: [SOPS, SET] },
        { item: 'Referral incentives', R: [PM], A: HOS, C: [AK, ANKIT], I: [SOPS] },
        { item: 'Communication journeys', R: [MKT, PM], A: TBD, C: [HOS], I: [SET, CLO] },
        { item: 'Tracking & attribution', R: [SOPS, CRM], A: TBD, C: [PM], I: [HOS] }
      ],
      nextAction: 'Assign owner; define referral mechanics and incentive proposal for approval.',
      flags: ['Owner TBD', 'Incentive decision pending'],
      comments: []
    },
    {
      id: 'EXP-01', name: 'Deal Loss – Application-Based Offers', category: 'Revenue Generation', type: 'Experiment', program: 'SI-03',
      objective: 'Reactivate lost deals using application-based special offers and measure reactivation, applications and paid registrations against baseline.',
      problem: 'Lost deals represent unrecovered revenue; it is unproven whether an application-based offer reactivates them at a worthwhile rate.',
      outcome: 'A read-out comparing the test cohort to baseline, with a scale / iterate / stop recommendation.',
      impact: 'Direct revenue recovery from an existing lost-deal base.',
      metrics: ['Eligible lost deals segmented', 'Outreach sent / responses', 'Reactivations', 'Applications submitted', 'Paid registrations', 'Baseline comparison (uplift)'],
      hypothesis: 'PROPOSED (to confirm): "If segmented lost deals receive an application-based special offer, reactivation and paid-registration rates will exceed the baseline lost-deal recovery rate." Target uplift TBD.',
      testPeriod: 'PROPOSED: 4 weeks from offer go-live (2026-11-13 → 2026-12-11). Confirm actual start date.',
      successCriteria: 'TBD — must be set before results are read. Proposed: reactivation rate and paid-registration rate vs. baseline cohort of comparable lost deals.',
      baseline: 'TBD — baseline reactivation/registration rate for lost deals without an offer must be recorded.',
      owner: TBD + ' — proposed: Sales Operations', accountable: TBD, sponsor: HOS,
      start: '2026-10-30', due: '2026-12-18', datesProposed: true,
      status: 'In Progress', priority: 'P1', priorityProposed: true,
      priorityRationale: 'Already underway with direct revenue impact; low effort to complete. Needs a stated hypothesis, baseline and success criteria now so results are interpretable. Proposed P1.',
      valueClass: 'Experiment',
      dependencies: ['Offer/voucher approval (DEP-01)'],
      risks: ['No recorded baseline → results uninterpretable', 'Offer not approved → outreach stalls'],
      assumptions: ['Offer is a discount/voucher requiring approval (to confirm)'],
      workstreams: [
        { id: 'WS-E1A', name: 'Experiment design' }, { id: 'WS-E1B', name: 'Execution' }, { id: 'WS-E1C', name: 'Measurement' }
      ],
      milestones: [
        { id: 'MS-E1-1', name: 'Segment, eligibility, baseline and success criteria defined', due: '2026-11-06', status: 'Pending', ws: 'WS-E1A' },
        { id: 'MS-E1-2', name: 'Offer communication approved and live', due: '2026-11-13', status: 'Pending', ws: 'WS-E1B' },
        { id: 'MS-E1-3', name: 'Test period ends', due: '2026-12-11', status: 'Pending', ws: 'WS-E1B' },
        { id: 'MS-E1-4', name: 'Results vs baseline reviewed; scale/stop decision', due: '2026-12-18', status: 'Pending', ws: 'WS-E1C' }
      ],
      raci: [
        { item: 'Experiment outcome', R: [SOPS], A: TBD, C: [HOS], I: [CLO] },
        { item: 'Offer approval', R: [SOPS], A: HOS, C: [AK, ANKIT], I: [CLO] },
        { item: 'Outreach execution', R: [CLO], A: TBD, C: [SOPS], I: [HOS] },
        { item: 'Measurement & read-out', R: [SOPS], A: TBD, C: [HOS], I: [AK] }
      ],
      nextAction: 'Record the baseline and success criteria before outreach scales; confirm offer approval status.',
      flags: ['Owner TBD', 'Baseline TBD', 'Success criteria TBD', 'Offer approval pending'],
      comments: []
    },
    {
      id: 'PRJ-03', name: 'MDRPL', category: 'Revenue Generation', type: 'Project', program: null,
      objective: 'Deliver MDRPL revenue through a defined audience, sales approach, pipeline plan and reporting cadence.',
      problem: 'Scope, revenue objective and pipeline requirements for MDRPL are not documented in the brief.',
      outcome: 'Agreed revenue objective, named owner, pipeline plan with execution milestones and a weekly revenue report.',
      impact: 'Ongoing revenue line. Size TBD.',
      metrics: ['Revenue vs objective (objective TBD)', 'Leads / pipeline required vs available', 'Conversion rate'],
      owner: TBD, accountable: TBD, sponsor: HOS,
      start: '2026-10-30', due: '2026-12-04', datesProposed: true,
      status: 'In Progress', priority: 'P1', priorityProposed: true,
      priorityRationale: 'Stated as an ongoing revenue project; priority depends on revenue objective, which is not yet defined. Proposed P1 pending clarification — the first task is to confirm scope.',
      valueClass: 'Revenue-generating',
      dependencies: ['Head of Sales clarification of MDRPL scope (DEC-05)'],
      risks: ['Scope ambiguity — any expansion of MDRPL has NOT been assumed'],
      assumptions: ['None — scope flagged for clarification per brief.'],
      clarification: 'FLAG: The brief does not define MDRPL (meaning, product, current revenue). Do not expand scope. Head of Sales to confirm.',
      workstreams: [
        { id: 'WS-03A', name: 'Charter & targets' }, { id: 'WS-03B', name: 'Pipeline & ownership' }, { id: 'WS-03C', name: 'Execution & reporting' }
      ],
      milestones: [
        { id: 'MS-03-1', name: 'Scope, revenue objective and target audience confirmed', due: '2026-11-13', status: 'Pending', ws: 'WS-03A' },
        { id: 'MS-03-2', name: 'Lead & pipeline requirements and ownership agreed', due: '2026-11-20', status: 'Pending', ws: 'WS-03B' },
        { id: 'MS-03-3', name: 'Execution milestones agreed', due: '2026-11-27', status: 'Pending', ws: 'WS-03C' },
        { id: 'MS-03-4', name: 'Revenue reporting cadence live', due: '2026-12-04', status: 'Pending', ws: 'WS-03C' }
      ],
      raci: [
        { item: 'Revenue objective & scope', R: [HOS], A: HOS, C: [], I: [SOPS] },
        { item: 'Pipeline & execution', R: [TBD], A: TBD, C: [HOS], I: [SOPS] },
        { item: 'Revenue reporting', R: [SOPS], A: TBD, C: [HOS], I: [] }
      ],
      nextAction: 'Head of Sales to confirm MDRPL scope and revenue objective (Decision DEC-05).',
      flags: ['Scope needs clarification', 'Owner TBD', 'Revenue objective TBD'],
      comments: []
    },
    {
      id: 'PRJ-04', name: 'UAE Leads', category: 'Revenue Generation', type: 'Project', program: 'SI-02',
      objective: 'Generate and convert UAE leads with defined targets, sales ownership, follow-up cadence, funnel tracking and revenue reporting.',
      problem: 'UAE leads lack dedicated targets, ownership and a follow-up cadence suited to the market.',
      outcome: 'Monthly UAE lead and revenue targets, named owners, a follow-up SLA and a weekly UAE funnel report.',
      impact: 'Revenue from an international segment.',
      metrics: ['UAE leads vs target (target TBD)', 'Lead → meeting → SQL → paid conversion', 'UAE revenue'],
      owner: TBD, accountable: TBD, sponsor: HOS,
      start: '2026-11-03', due: '2027-01-30', datesProposed: true,
      status: 'Not Started', priority: 'P1', priorityProposed: true,
      priorityRationale: 'Direct revenue; mostly process definition and ownership (low effort). Proposed P1.',
      valueClass: 'Revenue-generating',
      dependencies: ['UAE Campaigns (PRJ-05) for lead supply', 'CRM segment tracking (CRM/Tech)'],
      risks: ['Time-zone coverage for follow-up', 'Lead volume depends on campaign timing'],
      assumptions: ['UAE leads are B2C teacher leads (to confirm)'],
      workstreams: [
        { id: 'WS-04A', name: 'Targets & ownership' }, { id: 'WS-04B', name: 'Follow-up cadence' }, { id: 'WS-04C', name: 'Funnel & revenue tracking' }
      ],
      milestones: [
        { id: 'MS-04-1', name: 'Lead targets and sales ownership set', due: '2026-11-14', status: 'Pending', ws: 'WS-04A' },
        { id: 'MS-04-2', name: 'Follow-up cadence and CRM tracking live', due: '2026-11-28', status: 'Pending', ws: 'WS-04B' },
        { id: 'MS-04-3', name: 'First monthly UAE revenue review', due: '2026-12-31', status: 'Pending', ws: 'WS-04C' }
      ],
      raci: [
        { item: 'UAE revenue', R: [TBD], A: TBD, C: [HOS], I: [MKT] },
        { item: 'Lead follow-up', R: [SET, CLO], A: TBD, C: [SOPS], I: [HOS] },
        { item: 'Funnel tracking', R: [SOPS, CRM], A: TBD, C: [], I: [HOS] }
      ],
      nextAction: 'Set monthly UAE lead targets and name the owning setter/closer group.',
      flags: ['Owner TBD', 'Targets TBD'],
      comments: []
    },
    {
      id: 'PRJ-05', name: 'UAE Campaigns', category: 'Revenue Generation', type: 'Project', program: 'SI-02',
      objective: 'Run B2C campaigns for the UAE market with clear objectives, a campaign-to-sales handover, qualification rules, scripts and quality/revenue tracking.',
      problem: 'No defined handover and qualification standard between UAE campaigns and the sales team.',
      outcome: 'Campaign objectives, handover SLA, qualification criteria and UAE scripts in place; lead quality, SQLs and revenue tracked per campaign.',
      impact: 'Demand generation feeding UAE revenue (PRJ-04).',
      metrics: ['Leads per campaign', 'Lead quality (qualified %)', 'SQLs', 'Revenue per campaign'],
      owner: TBD + ' — proposed: Marketing', accountable: TBD, sponsor: HOS,
      start: '2026-11-10', due: '2027-01-30', datesProposed: true,
      status: 'Not Started', priority: 'P2', priorityProposed: true,
      priorityRationale: 'Enables PRJ-04 but is cross-functional (Marketing) and campaign timing is unknown. Proposed P2; linked to PRJ-04 priority.',
      valueClass: 'Revenue-generating',
      dependencies: ['Marketing campaign calendar (Marketing)', 'UAE Leads ownership (PRJ-04)'],
      risks: ['Lead quality mismatch if qualification rules are not agreed up-front'],
      assumptions: ['Marketing owns campaign execution; Sales owns handover and conversion (to confirm)'],
      workstreams: [
        { id: 'WS-05A', name: 'Campaign objectives & handover' }, { id: 'WS-05B', name: 'Qualification, scripts & process' }, { id: 'WS-05C', name: 'Quality & revenue tracking' }
      ],
      milestones: [
        { id: 'MS-05-1', name: 'Campaign objectives and sales handover agreed', due: '2026-11-21', status: 'Pending', ws: 'WS-05A' },
        { id: 'MS-05-2', name: 'UAE scripts and qualification criteria ready', due: '2026-12-05', status: 'Pending', ws: 'WS-05B' },
        { id: 'MS-05-3', name: 'First campaign live', due: 'TBD', status: 'Pending', ws: 'WS-05A' },
        { id: 'MS-05-4', name: 'Campaign performance review', due: '2027-01-15', status: 'Pending', ws: 'WS-05C' }
      ],
      raci: [
        { item: 'Campaign objectives & execution', R: [MKT], A: TBD, C: [HOS], I: [SET] },
        { item: 'Campaign-to-sales handover', R: [MKT, SOPS], A: TBD, C: [HOS], I: [SET, CLO] },
        { item: 'Scripts & qualification', R: [SOPS], A: TBD, C: [SET], I: [MKT] }
      ],
      nextAction: 'Agree campaign objectives and the handover SLA with Marketing.',
      flags: ['Owner TBD', 'Campaign dates TBD', 'Cross-functional (Marketing)'],
      comments: []
    },
    {
      id: 'PRJ-06', name: 'Milestone 3 – Career Launchpad', category: 'Funnel Conversion & Sales Productivity', type: 'Strategic Project', program: 'SI-01',
      objective: 'Connect teachers with employment opportunities by building school relationships, capturing hiring requirements and running a teacher-to-employment pipeline on Suraasa\'s existing job platform.',
      problem: 'Teachers lack a structured employment pathway; school hiring demand is not systematically captured or matched.',
      outcome: 'Defined Launchpad model, agreed school acquisition strategy (shared with Suraasa Hire), teacher supply pipeline live and integrated with the job platform, success metrics reported.',
      impact: 'Conversion lever (employment outcome strengthens the PgCTL proposition) and foundation for Suraasa Hire revenue.',
      metrics: ['Teachers in supply pipeline', 'Schools engaged (shared with PRJ-12)', 'Hiring requirements captured', 'Matches / placements'],
      owner: TBD, accountable: TBD, sponsor: HOS,
      start: '2026-11-17', due: '2027-03-31', datesProposed: true,
      status: 'Not Started', priority: 'P3', priorityProposed: true,
      priorityRationale: 'High strategic value but long horizon, product/tech integration and dependency on Suraasa Hire school outreach. Proposed P3 (strategic / longer-term).',
      valueClass: 'Strategic growth',
      dependencies: ['Shared school outreach engine (PRJ-12)', 'Job platform integration (Product/Tech)'],
      risks: ['Duplicate school outreach with Suraasa Hire', 'Platform integration effort unknown'],
      assumptions: ['Existing job platform can be integrated (to confirm with Product)'],
      workstreams: [
        { id: 'WS-06A', name: 'Model & strategy' }, { id: 'WS-06B', name: 'School demand (shared with PRJ-12)' },
        { id: 'WS-06C', name: 'Teacher supply pipeline' }, { id: 'WS-06D', name: 'Job platform integration' }, { id: 'WS-06E', name: 'Metrics' }
      ],
      milestones: [
        { id: 'MS-06-1', name: 'Career Launchpad model defined', due: '2026-12-05', status: 'Pending', ws: 'WS-06A' },
        { id: 'MS-06-2', name: 'School acquisition strategy aligned with Suraasa Hire', due: '2026-12-12', status: 'Pending', ws: 'WS-06B' },
        { id: 'MS-06-3', name: 'Teacher supply pipeline defined', due: '2026-12-19', status: 'Pending', ws: 'WS-06C' },
        { id: 'MS-06-4', name: 'Job platform integration scoped', due: '2027-01-16', status: 'Pending', ws: 'WS-06D' },
        { id: 'MS-06-5', name: 'Pilot cohort matched', due: 'TBD', status: 'Pending', ws: 'WS-06C' }
      ],
      raci: [
        { item: 'Launchpad model & outcome', R: [TBD], A: TBD, C: [HOS, B2B, PROD], I: [SOPS] },
        { item: 'School acquisition (shared engine)', R: [B2B], A: TBD + ' — proposed: Suraasa Hire owner', C: [HOS], I: [] },
        { item: 'Teacher supply pipeline', R: [SOPS], A: TBD, C: [CLO], I: [HOS] },
        { item: 'Job platform integration', R: [PROD], A: TBD, C: [CRM], I: [HOS] }
      ],
      nextAction: 'Assign owner; define the Launchpad model and agree one shared school-outreach plan with Suraasa Hire.',
      flags: ['Owner TBD', 'Shares school outreach with PRJ-12', 'Product dependency'],
      comments: []
    },
    {
      id: 'PRJ-07', name: 'Deal Loss – SLA Reactivation', category: 'Funnel Conversion & Sales Productivity', type: 'Project → Recurring Ops', program: 'SI-03',
      objective: 'Implement a CRM-led process in which closers systematically reactivate eligible lost deals via triggers, sequences and timelines, with reporting.',
      problem: 'Lost deals are not systematically re-worked by closers; no triggers, ownership or sequences exist.',
      outcome: 'Eligible categories defined, CRM triggers live, closer ownership assigned, sequences and timelines documented, weekly reactivation report.',
      impact: 'Conversion recovery from the existing lost-deal base, ongoing.',
      metrics: ['Eligible deals triggered', 'Reactivation attempts / reached', 'Reactivated', 'Converted', 'SLA adherence'],
      owner: TBD + ' — proposed: Sales Operations', accountable: TBD, sponsor: HOS,
      start: '2026-11-03', due: '2026-12-12', datesProposed: true,
      status: 'Not Started', priority: 'P1', priorityProposed: true,
      priorityRationale: 'Conversion-recovery process with moderate effort; main dependency is CRM trigger configuration. Proposed P1.',
      valueClass: 'Conversion improvement',
      dependencies: ['CRM triggers (CRM/Tech)'],
      risks: ['Closer capacity for reactivation alongside live deals', 'Overlap with EXP-01 cohort — must exclude experiment cohort'],
      assumptions: ['Lost-deal reasons are captured in CRM (to confirm)'],
      workstreams: [
        { id: 'WS-07A', name: 'Eligibility & ownership' }, { id: 'WS-07B', name: 'CRM triggers' }, { id: 'WS-07C', name: 'Sequences & timelines' }, { id: 'WS-07D', name: 'Reporting (recurring)' }
      ],
      milestones: [
        { id: 'MS-07-1', name: 'Eligible categories and closer ownership defined', due: '2026-11-14', status: 'Pending', ws: 'WS-07A' },
        { id: 'MS-07-2', name: 'CRM triggers live', due: '2026-11-28', status: 'Pending', ws: 'WS-07B' },
        { id: 'MS-07-3', name: 'Reactivation sequences live; closers trained', due: '2026-12-05', status: 'Pending', ws: 'WS-07C' },
        { id: 'MS-07-4', name: 'First weekly reactivation report', due: '2026-12-12', status: 'Pending', ws: 'WS-07D' }
      ],
      raci: [
        { item: 'Process design', R: [SOPS], A: TBD, C: [HOS, CLO], I: [] },
        { item: 'CRM triggers', R: [CRM], A: TBD, C: [SOPS], I: [CLO] },
        { item: 'Reactivation execution', R: [CLO], A: TBD, C: [SOPS], I: [HOS] },
        { item: 'Reporting', R: [SOPS], A: TBD, C: [], I: [HOS] }
      ],
      nextAction: 'Define eligible deal-loss categories (exclude EXP-01 cohort) and closer allocation rules.',
      flags: ['Owner TBD', 'CRM dependency'],
      comments: []
    },
    {
      id: 'PRJ-08', name: 'Observe', category: 'Funnel Conversion & Sales Productivity', type: 'Strategic Project', program: null,
      objective: 'Connect the Observe product journey (teachers record classroom observations, receive AI feedback) to the B2C acquisition funnel and improve SQL quality.',
      problem: 'Observe users are not captured or qualified as leads; the journey is not connected to setters.',
      outcome: 'Observe journey mapped, lead capture and qualification signals defined, funnel integration and setter handover live, adoption→SQL→conversion measured.',
      impact: 'Higher-intent SQLs (conversion quality).',
      metrics: ['Observe adoption', 'Engagement (observations recorded)', 'MQLs from Observe', 'SQLs from Observe', 'Conversions'],
      owner: TBD + ' — proposed: Product', accountable: TBD, sponsor: HOS,
      start: '2026-12-01', due: '2027-03-31', datesProposed: true,
      status: 'Not Started', priority: 'P3', priorityProposed: true,
      priorityRationale: 'Product-dependent, longer horizon; valuable for SQL quality but not immediately executable by Sales. Proposed P3.',
      valueClass: 'Strategic growth',
      dependencies: ['Observe product readiness and data access (Product)', 'CRM integration (CRM/Tech)'],
      risks: ['Product timeline unknown', 'Low adoption → no lead volume'],
      assumptions: ['Observe is live or near-live (to confirm with Product)'],
      workstreams: [
        { id: 'WS-08A', name: 'User journey' }, { id: 'WS-08B', name: 'Lead capture & qualification' }, { id: 'WS-08C', name: 'Funnel integration & setter handover' }, { id: 'WS-08D', name: 'Measurement' }
      ],
      milestones: [
        { id: 'MS-08-1', name: 'Observe user journey and lead-capture points defined', due: '2026-12-19', status: 'Pending', ws: 'WS-08A' },
        { id: 'MS-08-2', name: 'Funnel integration scoped with Product/CRM', due: '2027-01-16', status: 'Pending', ws: 'WS-08C' },
        { id: 'MS-08-3', name: 'Setter handover live', due: '2027-02-13', status: 'Pending', ws: 'WS-08C' },
        { id: 'MS-08-4', name: 'First adoption → SQL → conversion read-out', due: '2027-03-31', status: 'Pending', ws: 'WS-08D' }
      ],
      raci: [
        { item: 'Observe journey & product', R: [PROD], A: TBD, C: [HOS], I: [SOPS] },
        { item: 'Lead qualification & setter handover', R: [SOPS], A: TBD, C: [SET, PROD], I: [HOS] },
        { item: 'Measurement', R: [SOPS], A: TBD, C: [PROD], I: [HOS] }
      ],
      nextAction: 'Confirm Observe product status and assign an owner from Product/Sales Ops.',
      flags: ['Owner TBD', 'Product dependency'],
      comments: []
    },
    {
      id: 'PRJ-09', name: 'Chat Process', category: 'Funnel Conversion & Sales Productivity', type: 'Project → Recurring Ops', program: 'SI-04',
      objective: 'Enable setters to chat directly with live leads under a defined workflow, response SLA, assignment/escalation rules and CRM tracking.',
      problem: 'Live leads are not engaged via chat; no workflow, templates, SLA or tracking exists.',
      outcome: 'Chat workflow live with setter rota, response-time SLA, templates, CRM activity logging and chat→meeting / chat→SQL reporting.',
      impact: 'Faster engagement of live leads (conversion velocity).',
      metrics: ['Chats handled', 'Median first-response time vs SLA', 'Chat → meeting rate', 'Chat → SQL rate'],
      owner: TBD + ' — proposed: Sales Operations', accountable: TBD, sponsor: HOS,
      start: '2026-11-10', due: '2026-12-19', datesProposed: true,
      status: 'Not Started', priority: 'P2', priorityProposed: true,
      priorityRationale: 'Conversion-velocity capability; depends on messaging approval (PRJ-11) and CRM logging. Proposed P2.',
      valueClass: 'Conversion improvement',
      dependencies: ['Approved messaging (PRJ-11)', 'CRM chat activity logging (CRM/Tech)', 'Chat tool availability (to confirm)'],
      risks: ['Setter capacity if chat is added on top of SLA work'],
      assumptions: ['A chat channel/tool exists or is approved (to confirm)'],
      workstreams: [
        { id: 'WS-09A', name: 'Workflow & SLA' }, { id: 'WS-09B', name: 'Templates' }, { id: 'WS-09C', name: 'CRM tracking' }, { id: 'WS-09D', name: 'Go-live & monitoring (recurring)' }
      ],
      milestones: [
        { id: 'MS-09-1', name: 'Chat workflow, ownership and response SLA defined', due: '2026-11-21', status: 'Pending', ws: 'WS-09A' },
        { id: 'MS-09-2', name: 'Chat templates approved', due: '2026-12-05', status: 'Pending', ws: 'WS-09B' },
        { id: 'MS-09-3', name: 'CRM activity logging live', due: '2026-12-12', status: 'Pending', ws: 'WS-09C' },
        { id: 'MS-09-4', name: 'Chat process go-live', due: '2026-12-19', status: 'Pending', ws: 'WS-09D' }
      ],
      raci: [
        { item: 'Chat workflow & SLA', R: [SOPS], A: TBD, C: [HOS, SET], I: [CRM] },
        { item: 'Chat execution', R: [SET], A: TBD, C: [SOPS], I: [HOS] },
        { item: 'CRM tracking', R: [CRM], A: TBD, C: [SOPS], I: [] }
      ],
      nextAction: 'Confirm the chat channel/tool and define the workflow and response SLA.',
      flags: ['Owner TBD', 'Tool TBD', 'Depends on messaging approval'],
      comments: []
    },
    {
      id: 'PRJ-10', name: 'Setter SLA – Three Days (Implementation)', category: 'Funnel Conversion & Sales Productivity', type: 'Project', program: 'SI-04',
      objective: 'Implement a process requiring setters to complete lead engagement within three days, with definitions, escalation rules, CRM tracking and compliance reporting.',
      problem: 'Lead engagement completion time is not governed by an SLA; breaches are not visible or owned.',
      outcome: 'SLA definition approved, CRM tracking live, compliance report running, breach ownership defined; hands over to recurring operation OPS-01.',
      impact: 'Faster lead engagement → higher meeting/SQL rates (conversion velocity).',
      metrics: ['% leads engaged-complete within 3 days', 'Breaches per setter', 'Time to escalation'],
      owner: TBD + ' — proposed: Sales Operations', accountable: TBD, sponsor: HOS,
      start: '2026-11-03', due: '2026-12-08', datesProposed: true,
      status: 'Not Started', priority: 'P1', priorityProposed: true,
      priorityRationale: 'High funnel impact, low cost, fast to implement; CRM tracking is the only material dependency. Proposed P1.',
      valueClass: 'Operational efficiency',
      dependencies: ['CRM SLA tracking (CRM/Tech)'],
      risks: ['Definition of "completion" disputed by setters', 'Breach ownership unassigned'],
      assumptions: ['3 days = calendar days (to confirm; business days alternative)'],
      workstreams: [
        { id: 'WS-10A', name: 'SLA definition & rules' }, { id: 'WS-10B', name: 'CRM tracking' }, { id: 'WS-10C', name: 'Compliance reporting & rollout' }
      ],
      milestones: [
        { id: 'MS-10-1', name: 'SLA definition, follow-up expectations and escalation rules approved', due: '2026-11-14', status: 'Pending', ws: 'WS-10A' },
        { id: 'MS-10-2', name: 'CRM SLA tracking live', due: '2026-11-28', status: 'Pending', ws: 'WS-10B' },
        { id: 'MS-10-3', name: 'Setters trained; SLA go-live', due: '2026-12-01', status: 'Pending', ws: 'WS-10C' },
        { id: 'MS-10-4', name: 'First compliance report (hand over to OPS-01)', due: '2026-12-08', status: 'Pending', ws: 'WS-10C' }
      ],
      raci: [
        { item: 'SLA policy', R: [SOPS], A: HOS, C: [SET], I: [CLO] },
        { item: 'CRM tracking', R: [CRM], A: TBD, C: [SOPS], I: [] },
        { item: 'SLA execution', R: [SET], A: TBD + ' — proposed: Setter team lead', C: [SOPS], I: [HOS] },
        { item: 'Compliance reporting', R: [SOPS], A: TBD, C: [], I: [HOS] }
      ],
      nextAction: 'Draft the "engagement completion" definition and 3-day clock rules for Head of Sales approval.',
      flags: ['Owner TBD', 'Breach ownership TBD'],
      comments: []
    },
    {
      id: 'OPS-01', name: 'Setter SLA – Compliance Operations', category: 'Funnel Conversion & Sales Productivity', type: 'Recurring Operation', program: 'SI-04', parent: 'PRJ-10',
      objective: 'Run the 3-day setter SLA as a standing operation: daily breach review, weekly compliance reporting, escalation of repeat breaches.',
      problem: 'Without a recurring compliance routine the SLA will decay after go-live.',
      outcome: 'Daily breach list actioned; weekly compliance report reviewed; breach ownership enforced.',
      impact: 'Sustains conversion velocity gains from PRJ-10.',
      metrics: ['Daily breaches', 'Weekly compliance %', 'Repeat-breach setters'],
      owner: TBD + ' — proposed: Sales Operations', accountable: TBD + ' — proposed: Setter team lead', sponsor: HOS,
      start: '2026-12-01', due: '', datesProposed: true, cadence: 'Daily breach review; weekly compliance report',
      status: 'Not Started', priority: 'P1', priorityProposed: true,
      priorityRationale: 'Inherits PRJ-10 priority; starts at go-live.',
      valueClass: 'Operational efficiency',
      dependencies: ['PRJ-10 go-live'],
      risks: ['No named breach owner'],
      assumptions: [],
      workstreams: [{ id: 'WS-O1A', name: 'Daily operations' }, { id: 'WS-O1B', name: 'Weekly reporting' }],
      milestones: [{ id: 'MS-O1-1', name: 'First full week of compliance operation', due: '2026-12-08', status: 'Pending', ws: 'WS-O1B' }],
      raci: [
        { item: 'Daily breach review', R: [SOPS], A: TBD + ' — proposed: Setter team lead', C: [], I: [SET] },
        { item: 'Weekly compliance report', R: [SOPS], A: TBD, C: [], I: [HOS] }
      ],
      nextAction: 'Starts after PRJ-10 go-live; name the breach owner now.',
      flags: ['Starts after PRJ-10', 'Breach owner TBD'],
      comments: []
    },
    {
      id: 'OPS-02', name: 'No-Show Reactivation', category: 'Funnel Conversion & Sales Productivity', type: 'Recurring Operation + Experiment', program: 'SI-04',
      objective: 'Reactivate leads who miss counselling sessions; sustain and improve on the current reactivation rate.',
      problem: 'No-shows leak conversion. Baseline reactivation was 4%; after the P-not reactivation approach it is reported at 7%.',
      outcome: 'Documented no-show journey with triggers and cadence; full-funnel tracking (reactivated → rescheduled → attended → converted); next improvement target set and tested.',
      impact: 'Conversion recovery on missed meetings (ongoing).',
      metrics: ['Reactivation rate — baseline 4%, current reported 7% (P-not approach)', 'Rescheduled meetings', 'Attendance of rescheduled', 'Conversion of reactivated leads'],
      baseline: 'Baseline: 4% reactivation (before P-not approach). Current reported: 7%. Source: brief. Next target: TBD.',
      owner: TBD + ' — proposed: Sales Operations', accountable: TBD, sponsor: HOS,
      start: '2026-10-30', due: '', datesProposed: true, cadence: 'Weekly reactivation tracking; next-test review monthly',
      status: 'In Progress', priority: 'P1', priorityProposed: true,
      priorityRationale: 'Live, measured and already improving (4% → 7%); low effort to extend tracking to reschedule/attend/convert. Proposed P1.',
      valueClass: 'Conversion improvement / Experiment',
      dependencies: ['CRM triggers for no-show (to confirm existing)'],
      risks: ['Gain may not persist without cadence discipline', 'Downstream conversion of reactivated leads not yet measured'],
      assumptions: ['"P-not" approach is the current live method (as stated)'],
      workstreams: [{ id: 'WS-O2A', name: 'Journey & triggers' }, { id: 'WS-O2B', name: 'Cadence & execution' }, { id: 'WS-O2C', name: 'Measurement & next test' }],
      milestones: [
        { id: 'MS-O2-1', name: 'No-show journey and P-not approach documented', due: '2026-11-14', status: 'Pending', ws: 'WS-O2A' },
        { id: 'MS-O2-2', name: 'Reschedule → attendance → conversion tracking live', due: '2026-11-28', status: 'Pending', ws: 'WS-O2C' },
        { id: 'MS-O2-3', name: 'Next improvement target and test defined', due: '2026-12-05', status: 'Pending', ws: 'WS-O2C' }
      ],
      raci: [
        { item: 'Reactivation process', R: [SOPS], A: TBD, C: [HOS], I: [SET, CLO] },
        { item: 'Reactivation outreach', R: [SET], A: TBD, C: [SOPS], I: [] },
        { item: 'Tracking & reporting', R: [SOPS], A: TBD, C: [], I: [HOS] }
      ],
      nextAction: 'Document the current journey and extend tracking to reschedule, attendance and conversion.',
      flags: ['Owner TBD', 'Downstream conversion not measured yet'],
      comments: []
    },
    {
      id: 'PRJ-11', name: 'Messaging Optimisation', category: 'Funnel Conversion & Sales Productivity', type: 'Project', program: 'SI-04',
      objective: 'Review, approve, deploy and measure the revised sales messaging across all sales channels; train the team on it.',
      problem: 'Messaging has been revised (by AK, Divya, Atishay) but awaits Head of Sales review; nothing is deployed or trained until approval.',
      outcome: 'Messaging reviewed and approved, gaps closed, deployed to CRM/chat/WhatsApp/email templates, team trained, response/meeting performance tracked.',
      impact: 'Conversion lift across every channel; also unblocks Chat Process templates (PRJ-09).',
      metrics: ['Review completed (yes/no)', 'Channels deployed', 'Team trained %', 'Reply / meeting-booked rate before vs after'],
      owner: TBD + ' — proposed: AK (led revision)', accountable: HOS, sponsor: HOS,
      start: '2026-10-30', due: '2026-12-18', datesProposed: true,
      status: 'In Progress', priority: 'P0', priorityProposed: true,
      priorityRationale: 'The only blocker is a Head of Sales review; the work is done and waiting. Highest urgency, lowest effort, cross-channel impact and unblocks PRJ-09. Proposed P0.',
      valueClass: 'Conversion improvement',
      dependencies: ['Head of Sales review (DEC-01)'],
      risks: ['Review delay stalls deployment and chat templates'],
      assumptions: [],
      workstreams: [{ id: 'WS-11A', name: 'Review & approval' }, { id: 'WS-11B', name: 'Deployment & training' }, { id: 'WS-11C', name: 'Performance tracking' }],
      milestones: [
        { id: 'MS-11-1', name: 'Head of Sales review complete', due: '2026-11-06', status: 'Pending', ws: 'WS-11A' },
        { id: 'MS-11-2', name: 'Final messaging approved', due: '2026-11-13', status: 'Pending', ws: 'WS-11A' },
        { id: 'MS-11-3', name: 'Deployed across sales channels', due: '2026-11-20', status: 'Pending', ws: 'WS-11B' },
        { id: 'MS-11-4', name: 'Sales team trained', due: '2026-11-27', status: 'Pending', ws: 'WS-11B' },
        { id: 'MS-11-5', name: 'First performance read-out', due: '2026-12-18', status: 'Pending', ws: 'WS-11C' }
      ],
      raci: [
        { item: 'Messaging content', R: [AK, 'Divya', 'Atishay'], A: HOS, C: [SET, CLO], I: [SOPS] },
        { item: 'Review & approval', R: [HOS], A: HOS, C: [AK], I: ['Divya', 'Atishay'] },
        { item: 'Deployment to channels', R: [SOPS, CRM], A: TBD, C: [AK], I: [SET, CLO] },
        { item: 'Training', R: [TBD], A: TBD, C: [AK], I: [HOS] }
      ],
      nextAction: 'Head of Sales to review the revised messaging (task T-059, due 6 Nov proposed).',
      flags: ['Awaiting Head of Sales review', 'Deployment owner TBD'],
      comments: []
    },
    {
      id: 'PRJ-12', name: 'Suraasa Hire', category: 'B2B Business Development', type: 'Project', program: 'SI-01',
      objective: 'Partner with schools to supply qualified teacher candidates: acquire schools via HR outreach, secure LOIs, capture hiring requirements and fulfil vacancies through the Career Launchpad supply pipeline.',
      problem: 'No systematic school-side demand capture; HR outreach and LOIs (initiative #18) are not yet running as a managed workstream.',
      outcome: 'School acquisition strategy and target list; HR outreach sequence live; LOIs secured (target TBD); requirement-capture form; fulfilment process linked to Career Launchpad; tracker for schools, vacancies, candidates, placements.',
      impact: 'B2B revenue line plus employment outcomes for teachers.',
      metrics: ['HR leaders contacted', 'Meetings booked', 'LOIs secured (target TBD)', 'Schools onboarded', 'Vacancies captured', 'Candidates supplied', 'Placements'],
      owner: TBD + ' — proposed: B2B Sales', accountable: TBD, sponsor: HOS,
      start: '2026-11-10', due: '2027-02-27', datesProposed: true,
      status: 'Not Started', priority: 'P2', priorityProposed: true,
      priorityRationale: 'B2B revenue with real strategic weight, but requires outreach build-up and a supply process before revenue. Proposed P2; the HR outreach workstream can start immediately.',
      valueClass: 'Revenue-generating / Strategic growth',
      dependencies: ['Career Launchpad supply pipeline (PRJ-06)', 'Collateral/pitch (Marketing)', 'Podcast relationships (OPS-03)'],
      risks: ['Duplicate outreach with Career Launchpad and Suraasa Share', 'LOIs without a fulfilment process'],
      assumptions: ['HR email outreach (#18) is managed here, not as a separate project'],
      workstreams: [
        { id: 'WS-12A', name: 'School acquisition strategy & target list (shared)' }, { id: 'WS-12B', name: 'HR email outreach & LOIs (initiative #18)' },
        { id: 'WS-12C', name: 'Hiring requirement capture' }, { id: 'WS-12D', name: 'Candidate supply & fulfilment (with PRJ-06)' }, { id: 'WS-12E', name: 'Reporting' }
      ],
      milestones: [
        { id: 'MS-12-1', name: 'School acquisition strategy and shared target list ready', due: '2026-11-28', status: 'Pending', ws: 'WS-12A' },
        { id: 'MS-12-2', name: 'HR outreach sequence live', due: '2026-12-05', status: 'Pending', ws: 'WS-12B' },
        { id: 'MS-12-3', name: 'First LOI secured', due: 'TBD', status: 'Pending', ws: 'WS-12B' },
        { id: 'MS-12-4', name: 'Hiring-requirement capture and fulfilment process defined', due: '2027-01-16', status: 'Pending', ws: 'WS-12D' },
        { id: 'MS-12-5', name: 'First placement', due: 'TBD', status: 'Pending', ws: 'WS-12D' }
      ],
      raci: [
        { item: 'Suraasa Hire outcome', R: [B2B], A: TBD, C: [HOS], I: [SOPS] },
        { item: 'HR outreach & LOIs', R: [B2B], A: TBD, C: [MKT], I: [HOS, 'School HR leaders'] },
        { item: 'Shared school target list', R: [B2B, SOPS], A: TBD, C: ['PRJ-06 owner (TBD)', 'PRJ-13 owner (TBD)'], I: [] },
        { item: 'Candidate supply & fulfilment', R: [SOPS], A: TBD, C: ['PRJ-06 owner (TBD)'], I: [HOS] }
      ],
      nextAction: 'Assign B2B owner; build the HR contact list and outreach sequence (can start now).',
      flags: ['Owner TBD', 'LOI target TBD', 'Owns shared school outreach for SI-01'],
      comments: []
    },
    {
      id: 'PRJ-13', name: 'Suraasa Share (product name to confirm)', category: 'B2B Business Development', type: 'Project', program: null,
      objective: 'Sell a B2B product to school principals through institutional selling: defined proposition, target school list, principal outreach, collateral and pipeline tracking.',
      problem: 'The brief names this product only as "Suraasa" (and "Suraasa Share" in the stakeholder context). Product name and proposition must be confirmed before outreach.',
      outcome: 'Confirmed proposition, target principal list (shared with Hire/Launchpad), outreach running, pitch deck and collateral, named sales owner, meetings/opportunities/revenue tracked.',
      impact: 'B2B institutional revenue.',
      metrics: ['Principals contacted', 'Meetings', 'Opportunities', 'Revenue'],
      owner: TBD + ' — proposed: B2B Sales', accountable: TBD, sponsor: HOS,
      start: '2026-11-17', due: '2027-02-27', datesProposed: true,
      status: 'Not Started', priority: 'P3', priorityProposed: true,
      priorityRationale: 'Proposition and even the product name are unconfirmed; institutional sales cycles are long. Proposed P3 until the proposition is confirmed.',
      valueClass: 'Strategic growth',
      dependencies: ['Product name/proposition confirmation (DEC-06)', 'Collateral (Marketing)', 'Shared school list (PRJ-12)'],
      risks: ['Outreach to the same principals from three initiatives'],
      assumptions: ['"Suraasa Share" is the intended product name (to confirm)'],
      clarification: 'FLAG: Initiative #15 has no product name in the brief; stakeholder context refers to "Suraasa Share". Confirm name and proposition.',
      workstreams: [{ id: 'WS-13A', name: 'Proposition & collateral' }, { id: 'WS-13B', name: 'Target list & principal outreach' }, { id: 'WS-13C', name: 'Pipeline tracking' }],
      milestones: [
        { id: 'MS-13-1', name: 'Product name and proposition confirmed', due: '2026-11-28', status: 'Pending', ws: 'WS-13A' },
        { id: 'MS-13-2', name: 'Pitch deck and collateral ready', due: '2026-12-19', status: 'Pending', ws: 'WS-13A' },
        { id: 'MS-13-3', name: 'Principal outreach live', due: '2027-01-09', status: 'Pending', ws: 'WS-13B' },
        { id: 'MS-13-4', name: 'First qualified opportunity', due: 'TBD', status: 'Pending', ws: 'WS-13C' }
      ],
      raci: [
        { item: 'Proposition', R: [TBD], A: HOS, C: [PROD, MKT], I: [B2B] },
        { item: 'Principal outreach & selling', R: [B2B], A: TBD, C: [HOS], I: ['School principals'] },
        { item: 'Collateral', R: [MKT], A: TBD, C: [B2B], I: [] }
      ],
      nextAction: 'Confirm product name and proposition (Decision DEC-06).',
      flags: ['Product name TBD', 'Owner TBD'],
      comments: []
    },
    {
      id: 'OPS-03', name: 'School Leaders Podcast', category: 'B2B Business Development', type: 'Recurring Programme', program: 'SI-01',
      objective: 'Build relationships with school leaders through an ongoing podcast and convert those relationships into B2B opportunities, particularly for Suraasa Hire.',
      problem: 'Episodes are produced, but guest follow-up and B2B pipeline attribution are not systematised.',
      outcome: 'Quarterly episode calendar, per-episode task template running, post-episode follow-up introducing Suraasa Hire, tracker of school relationships and pipeline sourced from the podcast.',
      impact: 'Relationship channel feeding B2B pipeline (PRJ-12, PRJ-13).',
      metrics: ['Episodes published per month', 'School leaders engaged', 'Post-episode meetings', 'B2B opportunities / pipeline sourced'],
      owner: TBD, accountable: TBD, sponsor: HOS,
      start: '2026-10-30', due: '', datesProposed: true, cadence: 'Per episode (frequency TBD); monthly pipeline report',
      status: 'In Progress', priority: 'P3', priorityProposed: true,
      priorityRationale: 'Ongoing relationship programme; value realised through B2B follow-up rather than directly. Proposed P3 with the follow-up process as the one P1 task inside it.',
      valueClass: 'Strategic growth',
      dependencies: ['Suraasa Hire proposition for follow-up (PRJ-12)'],
      risks: ['Guests not followed up → no pipeline'],
      assumptions: ['Episode frequency and production owner exist today (to confirm)'],
      workstreams: [{ id: 'WS-O3A', name: 'Guest pipeline & calendar' }, { id: 'WS-O3B', name: 'Episode production (per episode)' }, { id: 'WS-O3C', name: 'Guest follow-up & B2B pipeline' }],
      milestones: [
        { id: 'MS-O3-1', name: 'Episode calendar for next quarter', due: '2026-11-21', status: 'Pending', ws: 'WS-O3A' },
        { id: 'MS-O3-2', name: 'Guest follow-up process live', due: '2026-11-28', status: 'Pending', ws: 'WS-O3C' },
        { id: 'MS-O3-3', name: 'First monthly podcast-sourced pipeline report', due: '2026-12-31', status: 'Pending', ws: 'WS-O3C' }
      ],
      raci: [
        { item: 'Programme outcome', R: [TBD], A: TBD, C: [HOS], I: [B2B] },
        { item: 'Episode production', R: [TBD + ' — proposed: Content/Production'], A: TBD, C: [], I: [HOS] },
        { item: 'Guest follow-up (B2B)', R: [B2B], A: TBD, C: [HOS], I: ['School leaders (podcast guests)'] }
      ],
      nextAction: 'Confirm programme owner; set the follow-up process so every guest gets a Suraasa Hire conversation.',
      flags: ['Owner TBD', 'Episode cadence TBD'],
      comments: []
    },
    {
      id: 'PRJ-14', name: 'Paid Webinar', category: 'Marketing & Demand Generation', type: 'Project', program: null,
      objective: 'Launch a paid webinar with a finalised concept, content, promotion, pricing, registration/payment journey, delivery plan and follow-up conversion journey.',
      problem: 'Content development is underway but pricing, registration/payment, delivery responsibilities and follow-up journeys are undefined.',
      outcome: 'Webinar delivered on a confirmed date; registrations, attendance, revenue and SQLs measured; follow-up journey converts attendees.',
      impact: 'Direct webinar revenue plus SQL generation.',
      metrics: ['Registrations', 'Paid registrations / revenue', 'Attendance %', 'SQLs generated', 'Post-webinar conversions'],
      owner: TBD + ' — proposed: Marketing', accountable: TBD, sponsor: HOS,
      start: '2026-10-30', due: '2026-12-18', datesProposed: true,
      status: 'In Progress', priority: 'P1', priorityProposed: true,
      priorityRationale: 'Already in motion with direct revenue and SQL impact; remaining work is definitional (pricing, journeys, roles). Proposed P1.',
      valueClass: 'Revenue-generating',
      dependencies: ['Pricing decision (DEC-07)', 'Registration & payment journey (Marketing/Tech)'],
      risks: ['Webinar date not set', 'No follow-up journey → SQLs lost'],
      assumptions: ['Content team exists (to confirm)'],
      workstreams: [{ id: 'WS-14A', name: 'Concept & content' }, { id: 'WS-14B', name: 'Pricing, promotion & registration' }, { id: 'WS-14C', name: 'Delivery' }, { id: 'WS-14D', name: 'Follow-up & measurement' }],
      milestones: [
        { id: 'MS-14-1', name: 'Concept finalised and content complete', due: '2026-11-21', status: 'Pending', ws: 'WS-14A' },
        { id: 'MS-14-2', name: 'Pricing set; registration & payment journey live', due: '2026-12-05', status: 'Pending', ws: 'WS-14B' },
        { id: 'MS-14-3', name: 'Webinar delivered', due: 'TBD', status: 'Pending', ws: 'WS-14C' },
        { id: 'MS-14-4', name: 'Post-webinar report (registrations, attendance, revenue, SQLs)', due: 'TBD', status: 'Pending', ws: 'WS-14D' }
      ],
      raci: [
        { item: 'Webinar outcome', R: [MKT], A: TBD, C: [HOS], I: [SET] },
        { item: 'Content', R: [TBD + ' — proposed: Content team'], A: TBD, C: [HOS], I: [MKT] },
        { item: 'Pricing', R: [MKT], A: HOS, C: [AK], I: [SOPS] },
        { item: 'Follow-up & SQL handover', R: [SOPS, SET], A: TBD, C: [MKT], I: [HOS] }
      ],
      nextAction: 'Set the webinar date and pricing; define the registration/payment journey owner.',
      flags: ['Owner TBD', 'Date TBD', 'Pricing TBD'],
      comments: []
    },
    {
      id: 'DEP-01', name: 'Vouchers, Approvals & Incentives (Dependency Cluster)', category: 'Cross-functional Dependencies', type: 'Dependency Cluster', program: null,
      objective: 'Close all pending voucher requirements, approvals and incentive decisions involving AK and Ankit Khanna, with named approval owners and turnaround times.',
      problem: 'Several projects (EXP-01, PRJ-01, PRJ-02, PRJ-14) are gated on decisions that have no enumerated list, owner-per-item or turnaround time.',
      outcome: 'A complete list of pending items, an approval owner and turnaround time for each, decisions closed or escalated.',
      impact: 'Unblocks offer, ambassador, referral and pricing work.',
      metrics: ['Pending items enumerated', 'Items with named owner', 'Items closed', 'Average turnaround'],
      owner: TBD + ' — proposed: Sales Operations (tracking)', accountable: HOS, sponsor: HOS,
      start: '2026-10-30', due: '2026-11-13', datesProposed: true,
      status: 'In Progress', priority: 'P0', priorityProposed: true,
      priorityRationale: 'Blocks four revenue initiatives; resolution is a decision exercise, not a build. Proposed P0.',
      valueClass: 'Dependency',
      dependencies: ['AK availability', 'Ankit Khanna availability'],
      risks: ['Approval owner per item unclear between AK and Ankit'],
      assumptions: ['Only AK and Ankit Khanna are involved, per brief; no other approvers assumed.'],
      workstreams: [{ id: 'WS-D1A', name: 'Enumerate pending items' }, { id: 'WS-D1B', name: 'Owners & turnaround' }, { id: 'WS-D1C', name: 'Close decisions' }],
      milestones: [
        { id: 'MS-D1-1', name: 'All pending vouchers, approvals and incentive items enumerated', due: '2026-11-04', status: 'Pending', ws: 'WS-D1A' },
        { id: 'MS-D1-2', name: 'Approval owner and turnaround agreed per item', due: '2026-11-06', status: 'Pending', ws: 'WS-D1B' },
        { id: 'MS-D1-3', name: 'Decisions closed or escalated', due: '2026-11-13', status: 'Pending', ws: 'WS-D1C' }
      ],
      raci: [
        { item: 'Pending-items register', R: [SOPS], A: HOS, C: [AK, ANKIT], I: [] },
        { item: 'Voucher decisions', R: [AK, ANKIT], A: TBD + ' — AK or Ankit Khanna (confirm)', C: [HOS], I: [SOPS] },
        { item: 'Incentive decisions', R: [AK, ANKIT], A: TBD + ' — AK or Ankit Khanna (confirm)', C: [HOS], I: [SOPS] }
      ],
      nextAction: 'Enumerate every pending voucher / approval / incentive item and name an owner for each.',
      flags: ['Approval owner per item unconfirmed (AK vs Ankit)'],
      comments: []
    }
  ];

  // ---------- TASKS ----------
  // [id, project, ws, ms, name, description, owner, accountable, start, due, priority, status, deliverable, completionCriteria, dependency, progress, kind, parent]
  const T = [
    // PRJ-01 Ambassador
    ['T-001', 'PRJ-01', 'WS-01A', 'MS-01-1', 'Define the ambassador model', 'Who qualifies as an ambassador, their role, obligations, tiers (if any) and what Suraasa provides them. One-page model for approval.', PM, TBD, '2026-11-10', '2026-11-13', 'P2', 'Not Started', 'Ambassador model one-pager', 'Model approved by Head of Sales', '', 0, 'Task'],
    ['T-002', 'PRJ-01', 'WS-01A', 'MS-01-1', 'Design ambassador incentive structure and submit for approval', 'Per-lead / per-SQL / per-registration incentive proposal with cost cap. Submit through DEP-01.', PM, HOS, '2026-11-13', '2026-11-18', 'P1', 'Not Started', 'Incentive proposal (1 page)', 'Decision recorded in Decision Register', 'DEP-01 incentive decision', 0, 'Task'],
    ['T-003', 'PRJ-01', 'WS-01B', 'MS-01-2', 'Build identification criteria and candidate ambassador shortlist', 'Criteria (e.g., engagement, outcomes, network) and a named shortlist. Target count TBD.', PM, TBD, '2026-11-17', '2026-11-28', 'P2', 'Not Started', 'Shortlist sheet (count TBD)', 'Shortlist reviewed by Head of Sales', '', 0, 'Task'],
    ['T-004', 'PRJ-01', 'WS-01B', 'MS-01-2', 'Create ambassador onboarding kit', 'Brief, talking points, referral links/codes, do/don\'t guide.', PM, TBD, '2026-11-24', '2026-12-05', 'P2', 'Not Started', 'Onboarding kit', 'Kit approved; codes tested in CRM', 'T-008', 0, 'Task'],
    ['T-005', 'PRJ-01', 'WS-01B', 'MS-01-2', 'Onboard first ambassador cohort', 'Run onboarding sessions and activate codes. Cohort size TBD.', PM, TBD, '2026-12-08', '2026-12-12', 'P2', 'Not Started', 'Onboarded cohort list', 'All cohort members have active codes', 'T-004', 0, 'Task'],
    ['T-006', 'PRJ-01', 'WS-01C', 'MS-01-3', 'Create 30-day activation plan', 'Week-by-week actions ambassadors take in their first month, with Suraasa touchpoints.', PM, TBD, '2026-12-08', '2026-12-12', 'P2', 'Not Started', 'Activation plan', 'Plan shared with cohort', '', 0, 'Task'],
    ['T-007', 'PRJ-01', 'WS-01C', 'MS-01-3', 'Define regular ambassador engagement cadence', 'Fortnightly/monthly touchpoint format, owner and content. Becomes recurring.', PM, TBD, '2026-12-12', '2026-12-19', 'P3', 'Not Started', 'Cadence calendar', 'First touchpoint scheduled', '', 0, 'Task'],
    ['T-008', 'PRJ-01', 'WS-01D', 'MS-01-3', 'Configure CRM attribution for ambassador-sourced leads', 'Lead source field / referral code capture so every lead maps to an ambassador.', CRM, TBD, '2026-11-24', '2026-12-05', 'P1', 'Not Started', 'CRM source/code configuration', 'Test lead attributed end-to-end', '', 0, 'Task'],
    ['T-009', 'PRJ-01', 'WS-01D', 'MS-01-4', 'Build ambassador performance tracker', 'Leads, SQLs, registrations and revenue per ambassador.', SOPS, TBD, '2026-12-08', '2026-12-19', 'P2', 'Not Started', 'Tracker (sheet/CRM report)', 'Tracker populated from CRM', 'T-008', 0, 'Task'],
    ['T-010', 'PRJ-01', 'WS-01D', 'MS-01-4', 'Monthly ambassador performance review', 'Recurring monthly review of channel performance with Head of Sales.', PM, TBD, '2027-01-31', '2027-01-31', 'P3', 'Not Started', 'Monthly review note', 'Review held; actions logged', 'T-009', 0, 'Recurring'],
    // PRJ-02 Referral
    ['T-011', 'PRJ-02', 'WS-02A', 'MS-02-1', 'Define referral mechanics', 'Who can refer, what counts as a referral, when the reward is earned, anti-abuse rules.', PM, TBD, '2026-11-10', '2026-11-14', 'P2', 'Not Started', 'Referral mechanics doc', 'Approved by Head of Sales', '', 0, 'Task'],
    ['T-012', 'PRJ-02', 'WS-02A', 'MS-02-1', 'Define referral incentives and submit for approval', 'Reward for referrer and referee; cost per conversion cap. Submit via DEP-01.', PM, HOS, '2026-11-14', '2026-11-18', 'P1', 'Not Started', 'Incentive proposal', 'Decision recorded in Decision Register', 'DEP-01 incentive decision', 0, 'Task'],
    ['T-013', 'PRJ-02', 'WS-02B', 'MS-02-2', 'Map the referral communication journey and cadence', 'Invite → reminder → thank-you → reward notification; timing and channels.', MKT, TBD, '2026-11-17', '2026-11-28', 'P2', 'Not Started', 'Journey map', 'Journey reviewed by Head of Sales', 'T-011', 0, 'Task'],
    ['T-014', 'PRJ-02', 'WS-02B', 'MS-02-2', 'Draft referral communication templates', 'Email / WhatsApp / in-app copy for each journey step, aligned to approved messaging.', MKT, TBD, '2026-11-28', '2026-12-12', 'P2', 'Not Started', 'Template set', 'Templates approved', 'T-013; PRJ-11 approval', 0, 'Task'],
    ['T-015', 'PRJ-02', 'WS-02C', 'MS-02-2', 'Set up referral tracking and attribution in CRM', 'Referral source, referrer link, reward status fields; report.', CRM, TBD, '2026-11-24', '2026-12-12', 'P1', 'Not Started', 'CRM configuration + report', 'Test referral tracked to reward', '', 0, 'Task'],
    ['T-016', 'PRJ-02', 'WS-02D', 'MS-02-3', 'Launch referral programme to eligible base', 'Send launch communication; monitor first week.', PM, TBD, '2026-12-15', '2026-12-19', 'P2', 'Not Started', 'Launch sent', 'Launch comms delivered; tracking confirmed', 'T-014, T-015', 0, 'Task'],
    ['T-017', 'PRJ-02', 'WS-02D', 'MS-02-4', 'Fortnightly referral funnel report', 'Referrals, leads, SQLs, conversions, rewards paid.', SOPS, TBD, '2027-01-02', '2027-01-15', 'P3', 'Not Started', 'Fortnightly report', 'Report issued', 'T-015', 0, 'Recurring'],
    // EXP-01 Deal loss offers
    ['T-018', 'EXP-01', 'WS-E1A', 'MS-E1-1', 'Segment eligible lost deals', 'Define segmentation criteria (loss reason, recency, programme) and pull the cohort with counts. Stated as underway; progress not reported.', SOPS, TBD, '2026-10-30', '2026-11-06', 'P1', 'In Progress', 'Cohort list with counts', 'Cohort frozen and documented', '', 0, 'Task'],
    ['T-019', 'EXP-01', 'WS-E1A', 'MS-E1-1', 'Define offer eligibility rules', 'Which segments receive which offer; exclusions (e.g., deals in PRJ-07 reactivation).', SOPS, TBD, '2026-10-30', '2026-11-06', 'P1', 'In Progress', 'Eligibility rules', 'Rules approved', '', 0, 'Task'],
    ['T-020', 'EXP-01', 'WS-E1A', 'MS-E1-1', 'Record baseline and define success criteria', 'Baseline reactivation/registration rate of comparable lost deals without an offer; target uplift; stop rules.', SOPS, HOS, '2026-10-30', '2026-11-06', 'P0', 'Not Started', 'Experiment one-pager (hypothesis, baseline, criteria)', 'Head of Sales signs off criteria', '', 0, 'Task'],
    ['T-021', 'EXP-01', 'WS-E1B', 'MS-E1-2', 'Create offer communication', 'Message copy and channel for the application-based offer. Needs offer/voucher approval.', SOPS, TBD, '2026-11-03', '2026-11-13', 'P1', 'Not Started', 'Offer comms pack', 'Approved and loaded in CRM', 'DEP-01 offer approval', 0, 'Task'],
    ['T-022', 'EXP-01', 'WS-E1B', 'MS-E1-2', 'Assign outreach ownership', 'Name who sends the offer and follows up (closers proposed). Allocation per cohort segment.', TBD, TBD, '2026-11-06', '2026-11-13', 'P1', 'Not Started', 'Ownership list', 'Each cohort segment has a named owner', '', 0, 'Task'],
    ['T-023', 'EXP-01', 'WS-E1B', 'MS-E1-2', 'Build outreach and response tracker', 'Sent, responded, reactivated, applied, paid — per segment and owner.', SOPS, TBD, '2026-11-06', '2026-11-13', 'P1', 'Not Started', 'Tracker', 'Tracker live before first send', '', 0, 'Task'],
    ['T-024', 'EXP-01', 'WS-E1B', 'MS-E1-3', 'Weekly experiment metrics update', 'Weekly update of reactivation, applications, paid registrations during the test period.', SOPS, TBD, '2026-11-20', '2026-12-11', 'P1', 'Not Started', 'Weekly metrics', 'Posted in Weekly Review each week', 'T-023', 0, 'Recurring'],
    ['T-025', 'EXP-01', 'WS-E1C', 'MS-E1-4', 'Compare results against baseline and recommend scale / iterate / stop', 'Read-out with uplift vs baseline, cost of offers, recommendation.', SOPS, HOS, '2026-12-11', '2026-12-18', 'P1', 'Not Started', 'Experiment read-out', 'Decision recorded in Decision Register', 'T-020, T-024', 0, 'Task'],
    // PRJ-03 MDRPL
    ['T-026', 'PRJ-03', 'WS-03A', 'MS-03-1', 'Confirm MDRPL scope and revenue objective', 'Head of Sales to confirm what MDRPL covers and the revenue objective. Do not assume expansion.', HOS, HOS, '2026-10-30', '2026-11-13', 'P1', 'Not Started', 'Scope & objective note', 'Objective recorded in charter', '', 0, 'Decision'],
    ['T-027', 'PRJ-03', 'WS-03A', 'MS-03-1', 'Define target audience and sales approach', 'Audience definition and the sales motion (setter/closer, channel).', TBD, TBD, '2026-11-06', '2026-11-13', 'P1', 'Not Started', 'Audience & approach doc', 'Approved by Head of Sales', 'T-026', 0, 'Task'],
    ['T-028', 'PRJ-03', 'WS-03B', 'MS-03-2', 'Establish lead and pipeline requirements', 'Leads/pipeline needed to hit the objective at current conversion; sources.', SOPS, TBD, '2026-11-13', '2026-11-20', 'P1', 'Not Started', 'Pipeline requirement sheet', 'Reviewed with Head of Sales', 'T-026', 0, 'Task'],
    ['T-029', 'PRJ-03', 'WS-03B', 'MS-03-2', 'Assign MDRPL ownership', 'Name the revenue owner and executing team.', HOS, HOS, '2026-11-13', '2026-11-20', 'P1', 'Not Started', 'Owner named', 'Owner field updated in charter', 'T-026', 0, 'Decision'],
    ['T-030', 'PRJ-03', 'WS-03C', 'MS-03-3', 'Create execution milestones', 'Monthly milestones to objective with owners.', TBD, TBD, '2026-11-20', '2026-11-27', 'P2', 'Not Started', 'Milestone plan', 'Milestones added to this dashboard', 'T-029', 0, 'Task'],
    ['T-031', 'PRJ-03', 'WS-03C', 'MS-03-4', 'Weekly MDRPL revenue report', 'Revenue vs objective, pipeline, conversion — weekly.', SOPS, TBD, '2026-12-04', '2026-12-04', 'P2', 'Not Started', 'Weekly report', 'First report issued', 'T-030', 0, 'Recurring'],
    // PRJ-04 UAE Leads
    ['T-032', 'PRJ-04', 'WS-04A', 'MS-04-1', 'Set monthly UAE lead and revenue targets', 'Targets by month for the next quarter.', HOS, HOS, '2026-11-03', '2026-11-14', 'P1', 'Not Started', 'Target sheet', 'Targets recorded in charter metrics', '', 0, 'Decision'],
    ['T-033', 'PRJ-04', 'WS-04A', 'MS-04-1', 'Assign UAE sales ownership', 'Setter/closer group with time-zone coverage; named lead.', HOS, HOS, '2026-11-03', '2026-11-14', 'P1', 'Not Started', 'Ownership note', 'Owner field updated', '', 0, 'Decision'],
    ['T-034', 'PRJ-04', 'WS-04B', 'MS-04-2', 'Define UAE follow-up cadence', 'Touchpoints, timing (UAE hours), channels, SLA.', SOPS, TBD, '2026-11-14', '2026-11-21', 'P1', 'Not Started', 'Cadence doc', 'Approved and shared with team', 'T-033', 0, 'Task'],
    ['T-035', 'PRJ-04', 'WS-04C', 'MS-04-2', 'Configure UAE funnel tracking in CRM', 'Segment flag, stage conversion report for UAE leads.', CRM, TBD, '2026-11-14', '2026-11-28', 'P1', 'Not Started', 'CRM report', 'Report shows UAE funnel by stage', '', 0, 'Task'],
    ['T-036', 'PRJ-04', 'WS-04C', 'MS-04-3', 'Weekly UAE funnel and revenue report', 'Leads, meetings, SQLs, paid, revenue vs target.', SOPS, TBD, '2026-12-05', '2026-12-31', 'P2', 'Not Started', 'Weekly report', 'Issued weekly', 'T-035', 0, 'Recurring'],
    // PRJ-05 UAE Campaigns
    ['T-037', 'PRJ-05', 'WS-05A', 'MS-05-1', 'Define UAE campaign objectives and lead volume targets', 'Agree with Marketing: objective per campaign, expected leads, timing.', MKT, TBD, '2026-11-10', '2026-11-21', 'P2', 'Not Started', 'Campaign brief', 'Brief signed off by Head of Sales', 'T-032', 0, 'Task'],
    ['T-038', 'PRJ-05', 'WS-05A', 'MS-05-1', 'Establish campaign-to-sales handover', 'Routing, required fields, handover SLA, feedback loop on lead quality.', SOPS, TBD, '2026-11-14', '2026-11-21', 'P1', 'Not Started', 'Handover SOP', 'SOP agreed by Marketing and Sales', '', 0, 'Task'],
    ['T-039', 'PRJ-05', 'WS-05B', 'MS-05-2', 'Define UAE lead qualification criteria', 'What makes a UAE campaign lead qualified; disqualification rules.', SOPS, TBD, '2026-11-21', '2026-11-28', 'P1', 'Not Started', 'Qualification criteria', 'Loaded into setter guidance', '', 0, 'Task'],
    ['T-040', 'PRJ-05', 'WS-05B', 'MS-05-2', 'Create UAE sales scripts and process', 'Setter and closer scripts adapted for UAE (aligned to approved messaging).', SOPS, TBD, '2026-11-24', '2026-12-05', 'P2', 'Not Started', 'Script pack', 'Scripts approved; team briefed', 'PRJ-11 approval', 0, 'Task'],
    ['T-041', 'PRJ-05', 'WS-05C', 'MS-05-4', 'Track lead quality, SQLs and revenue per campaign', 'Per-campaign report; feeds PRJ-04 revenue.', SOPS, TBD, '2026-12-08', '2027-01-15', 'P2', 'Not Started', 'Campaign report', 'Issued per campaign', 'T-035', 0, 'Recurring'],
    // PRJ-06 Career Launchpad
    ['T-042', 'PRJ-06', 'WS-06A', 'MS-06-1', 'Define the Career Launchpad model', 'Value proposition for teachers and schools; end-to-end flow from teacher readiness to placement.', TBD, TBD, '2026-11-17', '2026-12-05', 'P2', 'Not Started', 'Model document', 'Approved by Head of Sales', '', 0, 'Task'],
    ['T-043', 'PRJ-06', 'WS-06B', 'MS-06-2', 'Agree one shared school acquisition strategy with Suraasa Hire', 'Single outreach plan, single target list, one owner for school contact (proposed: PRJ-12 owner).', TBD, TBD, '2026-11-24', '2026-12-12', 'P1', 'Not Started', 'Joint strategy note', 'Signed by both project owners', 'PRJ-12 T-053', 0, 'Task'],
    ['T-044', 'PRJ-06', 'WS-06B', 'MS-06-2', 'Identify target schools (consume shared list)', 'Flag Launchpad-relevant schools on the shared list; no separate outreach.', TBD, TBD, '2026-12-01', '2026-12-12', 'P2', 'Not Started', 'Tagged target list', 'List tagged; no duplicate contacts', 'T-053', 0, 'Task'],
    ['T-045', 'PRJ-06', 'WS-06C', 'MS-06-3', 'Define the teacher supply pipeline', 'Eligibility, readiness criteria, profile data captured, consent, stages.', SOPS, TBD, '2026-12-01', '2026-12-19', 'P2', 'Not Started', 'Supply pipeline spec', 'Spec reviewed with Closers', 'T-042', 0, 'Task'],
    ['T-046', 'PRJ-06', 'WS-06D', 'MS-06-4', 'Scope integration with the existing job platform', 'What the platform does today, what Launchpad needs, effort estimate.', PROD, TBD, '2026-12-15', '2027-01-16', 'P2', 'Not Started', 'Integration scope + estimate', 'Estimate accepted by Head of Sales', 'T-045', 0, 'Task'],
    ['T-047', 'PRJ-06', 'WS-06E', 'MS-06-3', 'Define success metrics and build pipeline tracker', 'Teachers in pipeline, matches, placements; tracker.', SOPS, TBD, '2026-12-08', '2026-12-19', 'P2', 'Not Started', 'Metrics + tracker', 'Tracker live', 'T-045', 0, 'Task'],
    ['T-048', 'PRJ-06', 'WS-06C', 'MS-06-5', 'Run pilot cohort match', 'Match a first teacher cohort to captured vacancies. Date TBD.', TBD, TBD, '', '', 'P3', 'Not Started', 'Pilot results', 'Placements recorded', 'T-046, PRJ-12 T-058', 0, 'Task'],
    // PRJ-07 Deal loss SLA reactivation
    ['T-049', 'PRJ-07', 'WS-07A', 'MS-07-1', 'Define eligible deal-loss categories', 'Which loss reasons/ages are eligible; exclude EXP-01 cohort.', SOPS, TBD, '2026-11-03', '2026-11-10', 'P1', 'Not Started', 'Eligibility matrix', 'Approved by Head of Sales', '', 0, 'Task'],
    ['T-050', 'PRJ-07', 'WS-07A', 'MS-07-1', 'Define closer ownership and allocation rules', 'Original closer vs pool; load caps.', SOPS, TBD, '2026-11-10', '2026-11-14', 'P1', 'Not Started', 'Allocation rules', 'Agreed with closer leads', 'T-049', 0, 'Task'],
    ['T-051', 'PRJ-07', 'WS-07B', 'MS-07-2', 'Configure CRM triggers for eligible lost deals', 'Trigger creates reactivation task to owning closer with due date.', CRM, TBD, '2026-11-14', '2026-11-28', 'P1', 'Not Started', 'CRM workflow', 'Test deal triggers correctly', 'T-049, T-050', 0, 'Task'],
    ['T-052', 'PRJ-07', 'WS-07C', 'MS-07-3', 'Create reactivation sequences and follow-up timelines', 'Call/WhatsApp/email sequence with day offsets; exit rules.', SOPS, TBD, '2026-11-14', '2026-11-28', 'P1', 'Not Started', 'Sequence doc + templates', 'Approved; loaded in CRM', 'PRJ-11 approval', 0, 'Task'],
    ['T-052a', 'PRJ-07', 'WS-07C', 'MS-07-3', 'Train closers on reactivation sequences', 'Session + quick-reference guide.', TBD, TBD, '2026-12-01', '2026-12-05', 'P2', 'Not Started', 'Training record', 'All closers trained', 'T-052', 0, 'Task'],
    ['T-052b', 'PRJ-07', 'WS-07D', 'MS-07-4', 'Weekly reactivation report', 'Triggered, attempted, reached, reactivated, converted, SLA adherence.', SOPS, TBD, '2026-12-12', '2026-12-12', 'P2', 'Not Started', 'Weekly report', 'Issued weekly', 'T-051', 0, 'Recurring'],
    // PRJ-12 Suraasa Hire (placed before Observe to keep IDs readable)
    ['T-053', 'PRJ-12', 'WS-12A', 'MS-12-1', 'Develop school acquisition strategy and build the shared target school list', 'Segments, geography, ICP; one list shared by PRJ-06, PRJ-12 and PRJ-13 with a contact-owner column.', B2B, TBD, '2026-11-10', '2026-11-28', 'P1', 'Not Started', 'Strategy note + shared target list', 'List has owner per school; no duplicate outreach', '', 0, 'Task'],
    ['T-054', 'PRJ-12', 'WS-12B', 'MS-12-2', 'Build HR leader contact list', 'HR contacts for target schools with source and consent basis.', B2B, TBD, '2026-11-17', '2026-11-28', 'P1', 'Not Started', 'HR contact list', 'Contacts verified', 'T-053', 0, 'Task'],
    ['T-055', 'PRJ-12', 'WS-12B', 'MS-12-2', 'Draft HR outreach email sequence', '3–4 step sequence with LOI ask; aligned to approved messaging.', B2B, TBD, '2026-11-24', '2026-12-05', 'P1', 'Not Started', 'Email sequence', 'Approved by Head of Sales', 'PRJ-11 approval', 0, 'Task'],
    ['T-056', 'PRJ-12', 'WS-12B', 'MS-12-3', 'Run weekly HR outreach batches and follow-ups', 'Send batches, log replies, book meetings. Recurring.', B2B, TBD, '2026-12-08', '2027-02-27', 'P1', 'Not Started', 'Weekly outreach log', 'Batch sent and logged each week', 'T-054, T-055', 0, 'Recurring'],
    ['T-057', 'PRJ-12', 'WS-12B', 'MS-12-3', 'Secure Letters of Intent', 'Negotiate and collect LOIs. Target count TBD.', B2B, TBD, '2026-12-08', '', 'P1', 'Not Started', 'Signed LOIs (target TBD)', 'LOIs filed and counted in tracker', 'T-056', 0, 'Task'],
    ['T-058', 'PRJ-12', 'WS-12C', 'MS-12-4', 'Design hiring-requirement capture form', 'Fields for role, subject, grade, location, start date, salary band; where it lives.', SOPS, TBD, '2026-12-15', '2027-01-09', 'P2', 'Not Started', 'Requirement form', 'Form tested with one school', '', 0, 'Task'],
    ['T-058a', 'PRJ-12', 'WS-12D', 'MS-12-4', 'Define candidate supply and fulfilment process with Career Launchpad', 'From vacancy to shortlisted candidates to placement; SLA; ownership.', SOPS, TBD, '2026-12-15', '2027-01-16', 'P2', 'Not Started', 'Fulfilment SOP', 'Signed by PRJ-06 and PRJ-12 owners', 'PRJ-06 T-045', 0, 'Task'],
    ['T-058b', 'PRJ-12', 'WS-12E', 'MS-12-2', 'Build Suraasa Hire tracker', 'Schools onboarded, vacancies, candidates supplied, placements; weekly report.', SOPS, TBD, '2026-11-24', '2026-12-05', 'P2', 'Not Started', 'Tracker + weekly report', 'Tracker live', '', 0, 'Task'],
    // PRJ-11 Messaging
    ['T-059', 'PRJ-11', 'WS-11A', 'MS-11-1', 'Review the revised sales messaging', 'Head of Sales reviews all revised messaging from AK, Divya and Atishay; notes gaps. PENDING ACTION per brief.', HOS, HOS, '2026-10-30', '2026-11-06', 'P0', 'Not Started', 'Review notes with gaps', 'Review notes shared with AK', '', 0, 'Task'],
    ['T-060', 'PRJ-11', 'WS-11A', 'MS-11-1', 'Revise sales messaging', 'Completed by AK, Divya and Atishay (stated in brief).', 'AK, Divya, Atishay', HOS, '', '', 'P1', 'Completed', 'Revised messaging set', 'Delivered for review', '', 100, 'Task'],
    ['T-061', 'PRJ-11', 'WS-11A', 'MS-11-2', 'Close identified gaps and approve final messaging', 'Incorporate review feedback; Head of Sales approves final set.', 'AK', HOS, '2026-11-06', '2026-11-13', 'P0', 'Not Started', 'Approved messaging set', 'Approval recorded in Decision Register', 'T-059', 0, 'Task'],
    ['T-062', 'PRJ-11', 'WS-11B', 'MS-11-3', 'Deploy messaging across sales channels', 'Load into CRM templates, chat, WhatsApp, email sequences; retire old versions.', SOPS, TBD, '2026-11-13', '2026-11-20', 'P1', 'Not Started', 'Deployment checklist (per channel)', 'All channels show new messaging', 'T-061', 0, 'Task'],
    ['T-063', 'PRJ-11', 'WS-11B', 'MS-11-4', 'Train the sales team on the new messaging', 'Setter and closer sessions; quick-reference cards.', TBD, TBD, '2026-11-20', '2026-11-27', 'P1', 'Not Started', 'Training record', '100% of setters/closers trained', 'T-062', 0, 'Task'],
    ['T-064', 'PRJ-11', 'WS-11C', 'MS-11-5', 'Track messaging performance before vs after', 'Reply rate, meeting-booked rate per channel; baseline from pre-deployment period.', SOPS, TBD, '2026-11-20', '2026-12-18', 'P2', 'Not Started', 'Performance read-out', 'Read-out presented in Weekly Review', 'T-062', 0, 'Task'],
    // PRJ-08 Observe
    ['T-065', 'PRJ-08', 'WS-08A', 'MS-08-1', 'Confirm Observe product status and assign owner', 'Is Observe live? Who owns it? What data is available?', HOS, HOS, '2026-12-01', '2026-12-05', 'P2', 'Not Started', 'Status note', 'Owner field updated', '', 0, 'Decision'],
    ['T-066', 'PRJ-08', 'WS-08A', 'MS-08-1', 'Map the Observe user journey', 'Record → AI feedback → next step; where a sales conversation naturally fits.', PROD, TBD, '2026-12-01', '2026-12-19', 'P2', 'Not Started', 'Journey map', 'Reviewed with Sales Ops', 'T-065', 0, 'Task'],
    ['T-067', 'PRJ-08', 'WS-08B', 'MS-08-1', 'Define lead capture points and qualification signals', 'Which Observe behaviours indicate intent; what data is captured.', SOPS, TBD, '2026-12-08', '2026-12-19', 'P2', 'Not Started', 'Signal definitions', 'Approved by Head of Sales', 'T-066', 0, 'Task'],
    ['T-068', 'PRJ-08', 'WS-08C', 'MS-08-2', 'Integrate Observe leads into the existing sales funnel', 'CRM source, lifecycle stage, routing.', CRM, TBD, '2026-12-19', '2027-01-16', 'P2', 'Not Started', 'Integration scope / build', 'Observe lead appears in CRM with source', 'T-067', 0, 'Task'],
    ['T-069', 'PRJ-08', 'WS-08C', 'MS-08-3', 'Establish setter handover rules and SLA', 'When and how an Observe user is contacted by a setter.', SOPS, TBD, '2027-01-16', '2027-02-13', 'P2', 'Not Started', 'Handover SOP', 'Setters briefed', 'T-068', 0, 'Task'],
    ['T-070', 'PRJ-08', 'WS-08D', 'MS-08-4', 'Measure adoption, engagement, MQLs, SQLs and conversions', 'Monthly Observe funnel report.', SOPS, TBD, '2027-02-13', '2027-03-31', 'P3', 'Not Started', 'Monthly report', 'First report issued', 'T-068', 0, 'Recurring'],
    // PRJ-09 Chat
    ['T-071', 'PRJ-09', 'WS-09A', 'MS-09-1', 'Confirm chat channel/tool and define the chat workflow', 'Channel(s), hours, trigger (which leads get chat), hand-off to call.', SOPS, TBD, '2026-11-10', '2026-11-21', 'P2', 'Not Started', 'Workflow doc', 'Approved by Head of Sales', '', 0, 'Task'],
    ['T-072', 'PRJ-09', 'WS-09A', 'MS-09-1', 'Assign setter ownership and rota', 'Who covers chat and when; backup.', TBD, TBD, '2026-11-14', '2026-11-21', 'P2', 'Not Started', 'Rota', 'Rota published', 'T-071', 0, 'Task'],
    ['T-073', 'PRJ-09', 'WS-09A', 'MS-09-1', 'Set response-time SLA and escalation rules', 'First-response and resolution SLA; escalation when breached or when lead is hot.', SOPS, TBD, '2026-11-14', '2026-11-21', 'P2', 'Not Started', 'SLA + escalation rules', 'Approved', 'T-071', 0, 'Task'],
    ['T-074', 'PRJ-09', 'WS-09B', 'MS-09-2', 'Create chat messaging templates', 'Openers, qualification prompts, meeting-booking, objection responses — from approved messaging.', SOPS, TBD, '2026-11-21', '2026-12-05', 'P2', 'Not Started', 'Template set', 'Approved', 'PRJ-11 T-061', 0, 'Task'],
    ['T-075', 'PRJ-09', 'WS-09C', 'MS-09-3', 'Integrate chat activity tracking into CRM', 'Log chat touches, outcomes, booked meetings against the lead.', CRM, TBD, '2026-11-24', '2026-12-12', 'P2', 'Not Started', 'CRM logging', 'Test chat logged end-to-end', '', 0, 'Task'],
    ['T-076', 'PRJ-09', 'WS-09D', 'MS-09-4', 'Train setters and go live', 'Training on workflow, templates, SLA; go-live.', TBD, TBD, '2026-12-12', '2026-12-19', 'P2', 'Not Started', 'Go-live checklist', 'Chat live with trained setters', 'T-072, T-074, T-075', 0, 'Task'],
    ['T-077', 'PRJ-09', 'WS-09D', 'MS-09-4', 'Weekly chat conversion report', 'Chats, response time vs SLA, chat→meeting, chat→SQL.', SOPS, TBD, '2026-12-26', '2026-12-26', 'P3', 'Not Started', 'Weekly report', 'Issued weekly', 'T-075', 0, 'Recurring'],
    // PRJ-10 Setter SLA
    ['T-078', 'PRJ-10', 'WS-10A', 'MS-10-1', 'Define "engagement completion"', 'Minimum attempts, outcome logged, qualified/disqualified/meeting set — what counts as complete.', SOPS, HOS, '2026-11-03', '2026-11-10', 'P1', 'Not Started', 'Definition doc', 'Approved by Head of Sales', '', 0, 'Task'],
    ['T-079', 'PRJ-10', 'WS-10A', 'MS-10-1', 'Define the three-day SLA clock and follow-up expectations', 'Start trigger, calendar vs business days, required touchpoints within the window.', SOPS, HOS, '2026-11-03', '2026-11-10', 'P1', 'Not Started', 'SLA rules', 'Approved', 'T-078', 0, 'Task'],
    ['T-080', 'PRJ-10', 'WS-10A', 'MS-10-1', 'Define escalation rules and breach ownership', 'What happens on breach; who owns breaches (proposed: setter team lead — TBD).', SOPS, HOS, '2026-11-10', '2026-11-14', 'P1', 'Not Started', 'Escalation + ownership doc', 'Breach owner named', 'T-079', 0, 'Task'],
    ['T-081', 'PRJ-10', 'WS-10B', 'MS-10-2', 'Configure CRM SLA tracking', 'SLA timer, breach flag, setter dashboard view.', CRM, TBD, '2026-11-14', '2026-11-28', 'P1', 'Not Started', 'CRM configuration', 'Breach flag fires on test lead', 'T-079', 0, 'Task'],
    ['T-082', 'PRJ-10', 'WS-10C', 'MS-10-2', 'Build SLA compliance report', '% within SLA by setter, breaches, trend.', SOPS, TBD, '2026-11-21', '2026-11-28', 'P1', 'Not Started', 'Compliance report', 'Report populated from CRM', 'T-081', 0, 'Task'],
    ['T-083', 'PRJ-10', 'WS-10C', 'MS-10-3', 'Communicate SLA to setters and train', 'Briefing session; written policy shared.', TBD, TBD, '2026-11-28', '2026-12-01', 'P1', 'Not Started', 'Briefing record', 'All setters acknowledge policy', 'T-080', 0, 'Task'],
    ['T-084', 'PRJ-10', 'WS-10C', 'MS-10-4', 'Hand over to compliance operation (OPS-01)', 'Confirm daily/weekly routine owners; close project.', SOPS, TBD, '2026-12-05', '2026-12-08', 'P2', 'Not Started', 'Handover note', 'OPS-01 owner confirmed', 'T-082, T-083', 0, 'Task'],
    // OPS-01
    ['T-085', 'OPS-01', 'WS-O1A', 'MS-O1-1', 'Daily SLA breach review', 'Review breach list; assign corrective action; escalate repeat breaches.', SOPS, TBD, '2026-12-01', '2026-12-01', 'P1', 'Not Started', 'Daily breach list actioned', 'Breaches actioned same day', 'PRJ-10 T-084', 0, 'Recurring'],
    ['T-086', 'OPS-01', 'WS-O1B', 'MS-O1-1', 'Weekly SLA compliance report', 'Compliance % by setter, repeat breaches, actions.', SOPS, TBD, '2026-12-08', '2026-12-08', 'P1', 'Not Started', 'Weekly report', 'Reviewed in Weekly Review', 'T-085', 0, 'Recurring'],
    // OPS-02 No-show
    ['T-087', 'OPS-02', 'WS-O2A', 'MS-O2-1', 'Introduce P-not reactivation approach', 'Stated in brief as done; reactivation improved from 4% to 7%.', TBD, TBD, '', '', 'P1', 'Completed', 'P-not approach live', 'Reported 7% reactivation', '', 100, 'Task'],
    ['T-088', 'OPS-02', 'WS-O2A', 'MS-O2-1', 'Document the current no-show journey and P-not approach', 'As-is journey, triggers, scripts, timing.', SOPS, TBD, '2026-11-03', '2026-11-14', 'P1', 'Not Started', 'Journey document', 'Reviewed by Head of Sales', '', 0, 'Task'],
    ['T-089', 'OPS-02', 'WS-O2A', 'MS-O2-1', 'Confirm reactivation triggers in CRM', 'Verify no-show status triggers the reactivation task reliably.', CRM, TBD, '2026-11-03', '2026-11-14', 'P1', 'Not Started', 'Trigger check', 'Test no-show triggers task', '', 0, 'Task'],
    ['T-090', 'OPS-02', 'WS-O2B', 'MS-O2-1', 'Define follow-up cadence', 'Touchpoints and timing after a no-show; exit rules.', SOPS, TBD, '2026-11-10', '2026-11-14', 'P1', 'Not Started', 'Cadence doc', 'Approved', 'T-088', 0, 'Task'],
    ['T-091', 'OPS-02', 'WS-O2C', 'MS-O2-2', 'Track reactivation rate weekly', 'Weekly reactivation % vs 4% baseline and 7% current.', SOPS, TBD, '2026-11-07', '2026-11-07', 'P1', 'Not Started', 'Weekly metric', 'Posted weekly', '', 0, 'Recurring'],
    ['T-092', 'OPS-02', 'WS-O2C', 'MS-O2-2', 'Track rescheduled meetings, attendance and conversion of reactivated leads', 'Extend tracking downstream of reactivation.', SOPS, TBD, '2026-11-14', '2026-11-28', 'P1', 'Not Started', 'Full-funnel report', 'Report shows reschedule→attend→convert', 'T-091', 0, 'Task'],
    ['T-093', 'OPS-02', 'WS-O2C', 'MS-O2-3', 'Set next improvement target and test', 'Propose next target (TBD) and one change to test.', SOPS, HOS, '2026-11-28', '2026-12-05', 'P2', 'Not Started', 'Target + test plan', 'Approved by Head of Sales', 'T-092', 0, 'Task'],
    // PRJ-13 Share
    ['T-094', 'PRJ-13', 'WS-13A', 'MS-13-1', 'Confirm product name and proposition', 'Head of Sales confirms the product (brief says "Suraasa" / "Suraasa Share") and the core proposition.', HOS, HOS, '2026-11-17', '2026-11-28', 'P2', 'Not Started', 'Confirmed name + proposition', 'Charter updated', '', 0, 'Decision'],
    ['T-095', 'PRJ-13', 'WS-13B', 'MS-13-3', 'Build target principal list (from shared school list)', 'Tag principals on the shared list; assign contact owner.', B2B, TBD, '2026-11-28', '2026-12-12', 'P2', 'Not Started', 'Tagged list', 'No duplicate outreach with PRJ-12', 'PRJ-12 T-053', 0, 'Task'],
    ['T-096', 'PRJ-13', 'WS-13A', 'MS-13-2', 'Create pitch deck and sales collateral', 'Deck, one-pager, pricing inputs.', MKT, TBD, '2026-12-01', '2026-12-19', 'P2', 'Not Started', 'Deck + collateral', 'Approved by Head of Sales', 'T-094', 0, 'Task'],
    ['T-097', 'PRJ-13', 'WS-13B', 'MS-13-3', 'Define B2B sales ownership and outreach channel', 'Named seller; channels (podcast guests, referrals, cold).', HOS, HOS, '2026-12-08', '2026-12-19', 'P2', 'Not Started', 'Ownership note', 'Owner field updated', 'T-094', 0, 'Decision'],
    ['T-098', 'PRJ-13', 'WS-13B', 'MS-13-3', 'Launch principal outreach', 'Start outreach with collateral; log meetings.', B2B, TBD, '2027-01-05', '2027-01-09', 'P2', 'Not Started', 'Outreach log', 'First 10 principals contacted', 'T-095, T-096', 0, 'Task'],
    ['T-099', 'PRJ-13', 'WS-13C', 'MS-13-4', 'Track meetings, opportunities and revenue', 'Pipeline report for the product.', SOPS, TBD, '2027-01-09', '2027-02-27', 'P3', 'Not Started', 'Pipeline report', 'Issued fortnightly', 'T-098', 0, 'Recurring'],
    // OPS-03 Podcast
    ['T-100', 'OPS-03', 'WS-O3A', 'MS-O3-1', 'Build school-leader guest pipeline', 'Running list of candidate guests with status.', TBD, TBD, '2026-11-03', '2026-11-21', 'P3', 'Not Started', 'Guest pipeline list', '≥ next quarter of guests identified', '', 0, 'Recurring'],
    ['T-101', 'OPS-03', 'WS-O3A', 'MS-O3-1', 'Plan episode calendar for next quarter', 'Dates, guests, themes.', TBD, TBD, '2026-11-10', '2026-11-21', 'P3', 'Not Started', 'Episode calendar', 'Calendar approved', 'T-100', 0, 'Task'],
    ['T-102', 'OPS-03', 'WS-O3B', 'MS-O3-1', 'Per episode: invite guest and schedule recording', 'Repeat for every episode.', TBD, TBD, '', '', 'P3', 'Not Started', 'Confirmed recording slot', 'Guest confirmed in calendar', 'T-101', 0, 'Recurring'],
    ['T-103', 'OPS-03', 'WS-O3B', 'MS-O3-1', 'Per episode: develop content and questions', 'Repeat for every episode.', TBD, TBD, '', '', 'P3', 'Not Started', 'Episode brief', 'Brief shared with host', 'T-102', 0, 'Recurring'],
    ['T-104', 'OPS-03', 'WS-O3B', 'MS-O3-1', 'Per episode: record and publish', 'Repeat for every episode.', TBD, TBD, '', '', 'P3', 'Not Started', 'Published episode', 'Episode live', 'T-103', 0, 'Recurring'],
    ['T-105', 'OPS-03', 'WS-O3C', 'MS-O3-2', 'Define post-episode guest follow-up process', 'Within N days: thank-you, Suraasa Hire introduction, meeting request; logging.', B2B, TBD, '2026-11-10', '2026-11-28', 'P1', 'Not Started', 'Follow-up SOP', 'Approved', 'PRJ-12 proposition', 0, 'Task'],
    ['T-106', 'OPS-03', 'WS-O3C', 'MS-O3-2', 'Per episode: follow up with guest and log B2B outcome', 'Repeat for every episode.', B2B, TBD, '', '', 'P2', 'Not Started', 'Follow-up logged', 'Outcome recorded in tracker', 'T-105', 0, 'Recurring'],
    ['T-107', 'OPS-03', 'WS-O3C', 'MS-O3-3', 'Monthly podcast-sourced pipeline report', 'School relationships, meetings, B2B opportunities and pipeline from the podcast.', SOPS, TBD, '2026-12-31', '2026-12-31', 'P3', 'Not Started', 'Monthly report', 'Issued monthly', 'T-106', 0, 'Recurring'],
    // PRJ-14 Paid webinar
    ['T-108', 'PRJ-14', 'WS-14A', 'MS-14-1', 'Finalise webinar concept', 'Topic, audience, promise, format. Stated as underway via content development.', TBD, TBD, '2026-10-30', '2026-11-07', 'P1', 'In Progress', 'Concept note', 'Approved by Head of Sales', '', 0, 'Task'],
    ['T-109', 'PRJ-14', 'WS-14A', 'MS-14-1', 'Develop webinar content', 'Slides, script, exercises. Underway per brief; progress not reported.', TBD, TBD, '2026-10-30', '2026-11-21', 'P1', 'In Progress', 'Content deck + script', 'Dry run complete', 'T-108', 0, 'Task'],
    ['T-110', 'PRJ-14', 'WS-14B', 'MS-14-2', 'Define pricing', 'Price point, early-bird, bundling with programmes (if any).', MKT, HOS, '2026-11-10', '2026-11-21', 'P1', 'Not Started', 'Pricing decision', 'Recorded in Decision Register', '', 0, 'Decision'],
    ['T-111', 'PRJ-14', 'WS-14B', 'MS-14-2', 'Create promotional communication', 'Email/WhatsApp/social copy and schedule.', MKT, TBD, '2026-11-21', '2026-12-05', 'P1', 'Not Started', 'Promo pack + schedule', 'Approved; scheduled', 'T-108, T-110', 0, 'Task'],
    ['T-112', 'PRJ-14', 'WS-14B', 'MS-14-2', 'Build registration and payment journey', 'Landing page, payment, confirmation, reminders.', MKT, TBD, '2026-11-21', '2026-12-05', 'P1', 'Not Started', 'Live registration page', 'Test registration + payment succeeds', 'T-110', 0, 'Task'],
    ['T-113', 'PRJ-14', 'WS-14C', 'MS-14-3', 'Define delivery responsibilities', 'Host, moderator, tech, Q&A, backup.', TBD, TBD, '2026-11-21', '2026-12-05', 'P2', 'Not Started', 'Run-of-show with owners', 'All roles named', '', 0, 'Task'],
    ['T-114', 'PRJ-14', 'WS-14C', 'MS-14-3', 'Set webinar date and deliver the webinar', 'Confirm date (TBD); run the session.', TBD, TBD, '', '', 'P1', 'Not Started', 'Delivered webinar', 'Session held; recording saved', 'T-109, T-112, T-113', 0, 'Task'],
    ['T-115', 'PRJ-14', 'WS-14D', 'MS-14-4', 'Build follow-up and conversion journey', 'Post-webinar sequence; SQL handover to setters.', SOPS, TBD, '2026-12-01', '2026-12-12', 'P1', 'Not Started', 'Follow-up sequence', 'Loaded in CRM', 'T-112', 0, 'Task'],
    ['T-116', 'PRJ-14', 'WS-14D', 'MS-14-4', 'Post-webinar report: registrations, attendance, revenue, SQLs', 'Within 7 days of the webinar.', SOPS, TBD, '', '', 'P2', 'Not Started', 'Post-webinar report', 'Presented in Weekly Review', 'T-114', 0, 'Task'],
    // DEP-01
    ['T-117', 'DEP-01', 'WS-D1A', 'MS-D1-1', 'Enumerate pending voucher requirements', 'List each voucher need: project, type, quantity, value, requested by, needed by.', SOPS, HOS, '2026-10-30', '2026-11-04', 'P0', 'Not Started', 'Voucher requirements list', 'Reviewed with AK', '', 0, 'Task'],
    ['T-118', 'DEP-01', 'WS-D1A', 'MS-D1-1', 'Enumerate pending approvals', 'List every approval currently pending (offers, pricing, incentives, other).', SOPS, HOS, '2026-10-30', '2026-11-04', 'P0', 'Not Started', 'Pending approvals list', 'Reviewed with AK and Ankit Khanna', '', 0, 'Task'],
    ['T-119', 'DEP-01', 'WS-D1B', 'MS-D1-2', 'Name approval owner and turnaround time per item', 'Confirm AK vs Ankit Khanna per item; agree TAT (proposed: 3 working days).', HOS, HOS, '2026-11-04', '2026-11-06', 'P0', 'Not Started', 'Owner + TAT per item', 'Decision Register updated', 'T-117, T-118', 0, 'Decision'],
    ['T-120', 'DEP-01', 'WS-D1C', 'MS-D1-3', 'Finalise incentive-related decisions', 'Ambassador, referral and any sales incentives pending.', 'AK, Ankit Khanna', TBD + ' — AK or Ankit Khanna (confirm)', '2026-11-06', '2026-11-13', 'P0', 'Not Started', 'Recorded decisions', 'Decision Register items closed', 'T-119', 0, 'Decision'],
    ['T-121', 'DEP-01', 'WS-D1C', 'MS-D1-3', 'Track pending decisions and escalate overdue items', 'Weekly check of Decision Register; escalate to Head of Sales when TAT breached.', SOPS, HOS, '2026-11-06', '2026-11-13', 'P1', 'Not Started', 'Weekly escalation note', 'Reviewed in Weekly Review', 'T-119', 0, 'Recurring']
  ];
  const tasks = T.map(r => ({
    id: r[0], projectId: r[1], ws: r[2], ms: r[3], name: r[4], desc: r[5], owner: r[6], accountable: r[7],
    start: r[8], due: r[9], priority: r[10], status: r[11], deliverable: r[12], criteria: r[13], dependency: r[14],
    progress: r[15], kind: r[16], parent: r[17] || '', datesProposed: true
  }));

  // ---------- RISKS ----------
  const risks = [
    { id: 'R-01', projectId: 'EXP-01', desc: 'No recorded baseline for lost-deal recovery; experiment results will be uninterpretable.', impact: 'High', probability: 'High', mitigation: 'Record baseline (T-020) before offer outreach scales.', owner: TBD + ' — proposed: Sales Operations', deadline: '2026-11-06', status: 'Open', source: 'Identified during structuring (proposed)' },
    { id: 'R-02', projectId: 'EXP-01', desc: 'Offer/voucher not approved in time; outreach stalls.', impact: 'High', probability: 'Medium', mitigation: 'Enumerate and close via DEP-01 (T-117–T-120).', owner: HOS, deadline: '2026-11-13', status: 'Open', source: 'Identified during structuring (proposed)' },
    { id: 'R-03', projectId: 'PRJ-12', desc: 'Three initiatives (Hire, Career Launchpad, Share) contact the same schools independently.', impact: 'High', probability: 'High', mitigation: 'One shared target list with a contact-owner column (T-053, T-043, T-095).', owner: TBD + ' — proposed: B2B Sales', deadline: '2026-11-28', status: 'Open', source: 'Identified during structuring (proposed)' },
    { id: 'R-04', projectId: 'PRJ-10', desc: 'Setter capacity: 3-day SLA plus live chat plus no-show reactivation land on the same team in the same month.', impact: 'Medium', probability: 'High', mitigation: 'Sequence go-lives (SLA Dec 1, chat Dec 19); size the rota in T-072.', owner: HOS, deadline: '2026-11-21', status: 'Open', source: 'Identified during structuring (proposed)' },
    { id: 'R-05', projectId: 'PRJ-02', desc: 'Attribution conflict between Referral and Ambassador channels (same lead claimed twice).', impact: 'Medium', probability: 'Medium', mitigation: 'Single attribution rule in CRM (first-touch vs code) decided in T-008/T-015.', owner: TBD + ' — proposed: CRM/Tech', deadline: '2026-12-05', status: 'Open', source: 'Identified during structuring (proposed)' },
    { id: 'R-06', projectId: 'PRJ-11', desc: 'Head of Sales review delayed; deployment, training, chat templates and UAE scripts all wait.', impact: 'High', probability: 'Medium', mitigation: 'Time-box review to 1 week (T-059 due 6 Nov proposed).', owner: HOS, deadline: '2026-11-06', status: 'Open', source: 'Identified during structuring (proposed)' },
    { id: 'R-07', projectId: 'PRJ-03', desc: 'MDRPL scope ambiguity leads to work on the wrong thing.', impact: 'Medium', probability: 'Medium', mitigation: 'No work beyond charter until DEC-05 is answered.', owner: HOS, deadline: '2026-11-13', status: 'Open', source: 'Identified during structuring (proposed)' },
    { id: 'R-08', projectId: 'OPS-02', desc: '7% reactivation gain may not persist; downstream conversion of reactivated leads not yet measured.', impact: 'Medium', probability: 'Medium', mitigation: 'Weekly tracking (T-091) and full-funnel report (T-092).', owner: TBD + ' — proposed: Sales Operations', deadline: '2026-11-28', status: 'Open', source: 'Identified during structuring (proposed)' },
    { id: 'R-09', projectId: 'PRJ-14', desc: 'Webinar date not set; promotion and follow-up journeys cannot be scheduled.', impact: 'High', probability: 'Medium', mitigation: 'Set date alongside pricing decision (T-110, T-114).', owner: HOS, deadline: '2026-11-21', status: 'Open', source: 'Identified during structuring (proposed)' },
    { id: 'R-10', projectId: 'PRJ-06', desc: 'Job platform integration effort unknown; may exceed Sales\' control.', impact: 'Medium', probability: 'Medium', mitigation: 'Scope with Product early (T-046).', owner: TBD + ' — proposed: Product', deadline: '2027-01-16', status: 'Open', source: 'Identified during structuring (proposed)' },
    { id: 'R-11', projectId: 'PRJ-08', desc: 'Observe product readiness/timeline unknown.', impact: 'Medium', probability: 'Medium', mitigation: 'Confirm status (T-065) before committing dates.', owner: HOS, deadline: '2026-12-05', status: 'Open', source: 'Identified during structuring (proposed)' },
    { id: 'R-12', projectId: 'DEP-01', desc: 'Unclear whether AK or Ankit Khanna owns each approval; items bounce.', impact: 'High', probability: 'Medium', mitigation: 'Name owner per item (T-119).', owner: HOS, deadline: '2026-11-06', status: 'Open', source: 'Identified during structuring (proposed)' }
  ];

  // ---------- DEPENDENCIES ----------
  const dependencies = [
    { id: 'DP-01', desc: 'Offer / voucher approval for application-based offers', projectId: 'EXP-01', responsible: SOPS, externalOwner: 'AK / Ankit Khanna (confirm)', status: 'Open', requiredBy: '2026-11-13', escalation: 'Yes — to Head of Sales if not closed by 6 Nov' },
    { id: 'DP-02', desc: 'Ambassador and referral incentive decisions', projectId: 'PRJ-01', responsible: PM, externalOwner: 'AK / Ankit Khanna (confirm)', status: 'Open', requiredBy: '2026-11-18', escalation: 'Yes — blocks PRJ-01 and PRJ-02 milestone 1' },
    { id: 'DP-03', desc: 'CRM triggers for lost-deal reactivation', projectId: 'PRJ-07', responsible: SOPS, externalOwner: 'CRM/Tech (TBD)', status: 'Open', requiredBy: '2026-11-28', escalation: 'If CRM capacity is unavailable' },
    { id: 'DP-04', desc: 'CRM SLA tracking (3-day setter SLA)', projectId: 'PRJ-10', responsible: SOPS, externalOwner: 'CRM/Tech (TBD)', status: 'Open', requiredBy: '2026-11-28', escalation: 'If CRM capacity is unavailable' },
    { id: 'DP-05', desc: 'CRM chat activity logging', projectId: 'PRJ-09', responsible: SOPS, externalOwner: 'CRM/Tech (TBD)', status: 'Open', requiredBy: '2026-12-12', escalation: 'No' },
    { id: 'DP-06', desc: 'Job platform integration scope and build', projectId: 'PRJ-06', responsible: TBD, externalOwner: 'Product (TBD)', status: 'Open', requiredBy: '2027-01-16', escalation: 'No' },
    { id: 'DP-07', desc: 'Observe product readiness and lead data access', projectId: 'PRJ-08', responsible: TBD, externalOwner: 'Product (TBD)', status: 'Open', requiredBy: '2026-12-19', escalation: 'No' },
    { id: 'DP-08', desc: 'Registration and payment journey for paid webinar', projectId: 'PRJ-14', responsible: MKT, externalOwner: 'Marketing / Tech (TBD)', status: 'Open', requiredBy: '2026-12-05', escalation: 'If webinar date is set earlier' },
    { id: 'DP-09', desc: 'UAE campaign calendar and campaign-to-sales handover', projectId: 'PRJ-05', responsible: SOPS, externalOwner: 'Marketing (TBD)', status: 'Open', requiredBy: '2026-11-21', escalation: 'No' },
    { id: 'DP-10', desc: 'Approved messaging (needed by chat templates, UAE scripts, reactivation sequences, HR outreach)', projectId: 'PRJ-11', responsible: 'AK', externalOwner: 'Head of Sales (review)', status: 'Open', requiredBy: '2026-11-13', escalation: 'Yes — four projects wait on it' },
    { id: 'DP-11', desc: 'Shared school target list with contact owner (used by PRJ-06, PRJ-12, PRJ-13)', projectId: 'PRJ-12', responsible: B2B, externalOwner: '—', status: 'Open', requiredBy: '2026-11-28', escalation: 'No' },
    { id: 'DP-12', desc: 'Pricing decision for paid webinar', projectId: 'PRJ-14', responsible: MKT, externalOwner: 'Head of Sales (with AK)', status: 'Open', requiredBy: '2026-11-21', escalation: 'No' }
  ];

  // ---------- DECISIONS ----------
  const decisions = [
    { id: 'DEC-01', decision: 'Approve (or return with gaps) the revised sales messaging', projectId: 'PRJ-11', owner: HOS, raised: '2026-10-30', requiredBy: '2026-11-06', impact: 'Deployment, training, chat templates, UAE scripts and reactivation sequences all wait.', status: 'Open', final: '', source: 'Pending action stated in brief' },
    { id: 'DEC-02', decision: 'Pending voucher requirements — approve quantities/values per project', projectId: 'DEP-01', owner: TBD + ' — AK or Ankit Khanna (confirm)', raised: '2026-10-30', requiredBy: '2026-11-13', impact: 'Blocks EXP-01 offer outreach.', status: 'Open', final: '', source: 'Pending dependency stated in brief' },
    { id: 'DEC-03', decision: 'Incentive-related decisions (ambassador, referral, any sales incentives)', projectId: 'DEP-01', owner: TBD + ' — AK or Ankit Khanna (confirm)', raised: '2026-10-30', requiredBy: '2026-11-13', impact: 'Blocks PRJ-01 and PRJ-02 milestone 1.', status: 'Open', final: '', source: 'Pending dependency stated in brief' },
    { id: 'DEC-04', decision: 'Other pending approvals — enumerate and close (list not provided in brief)', projectId: 'DEP-01', owner: HOS, raised: '2026-10-30', requiredBy: '2026-11-04', impact: 'Unknown until enumerated.', status: 'Open', final: '', source: 'Pending dependency stated in brief' },
    { id: 'DEC-05', decision: 'Confirm MDRPL scope, revenue objective and owner (no expansion assumed)', projectId: 'PRJ-03', owner: HOS, raised: '2026-10-30', requiredBy: '2026-11-13', impact: 'No execution plan can be built until answered.', status: 'Open', final: '', source: 'Clarification flagged during structuring' },
    { id: 'DEC-06', decision: 'Confirm product name and proposition for initiative #15 ("Suraasa" / "Suraasa Share")', projectId: 'PRJ-13', owner: HOS, raised: '2026-10-30', requiredBy: '2026-11-28', impact: 'Collateral and outreach cannot start.', status: 'Open', final: '', source: 'Clarification flagged during structuring' },
    { id: 'DEC-07', decision: 'Paid webinar pricing and date', projectId: 'PRJ-14', owner: HOS, raised: '2026-10-30', requiredBy: '2026-11-21', impact: 'Promotion and registration journey cannot be scheduled.', status: 'Open', final: '', source: 'Requirement in brief (pricing); date gap identified' },
    { id: 'DEC-08', decision: 'Approve proposed project priorities (P0–P3) and value classification', projectId: '', owner: HOS, raised: '2026-10-30', requiredBy: '2026-11-06', impact: 'Portfolio sequencing and resource allocation.', status: 'Open', final: '', source: 'Recommendation (proposed)' },
    { id: 'DEC-09', decision: 'Assign project owners and accountable persons for all projects marked TBD', projectId: '', owner: HOS, raised: '2026-10-30', requiredBy: '2026-11-06', impact: 'Nothing moves without an owner; every project record currently has a TBD owner.', status: 'Open', final: '', source: 'Recommendation (proposed)' },
    { id: 'DEC-10', decision: 'Approve EXP-01 hypothesis, baseline and success criteria', projectId: 'EXP-01', owner: HOS, raised: '2026-10-30', requiredBy: '2026-11-06', impact: 'Results cannot be judged without criteria.', status: 'Open', final: '', source: 'Recommendation (proposed)' },
    { id: 'DEC-11', decision: 'Confirm whether a Project Manager / PMO role is created to run this control tower', projectId: '', owner: HOS, raised: '2026-10-30', requiredBy: '2026-11-13', impact: 'Without an operator, weekly updates will lapse.', status: 'Open', final: '', source: 'Recommendation (proposed)' }
  ];

  // ---------- IMMEDIATE ACTION QUEUE (seeded, non-computed) ----------
  const actions = [
    { id: 'A-01', kind: 'Pending action', action: 'Review the revised sales messaging (AK, Divya, Atishay)', why: 'Stated pending action; blocks deployment, training and four dependent projects.', ownerRole: 'Head of Sales', priority: 'P0', output: 'Review notes with gaps; approval or return', dependency: 'None', timeline: 'By 6 Nov 2026 (proposed)', projectId: 'PRJ-11', taskId: 'T-059', bucket: 'Implement immediately' },
    { id: 'A-02', kind: 'Pending action', action: 'Enumerate pending vouchers, approvals and incentive items; name owner per item', why: 'Dependencies with AK and Ankit Khanna are stated as pending but not itemised.', ownerRole: 'Sales Operations (tracking) → Head of Sales (owners)', priority: 'P0', output: 'Itemised register with owner and TAT', dependency: 'AK, Ankit Khanna availability', timeline: 'By 6 Nov 2026 (proposed)', projectId: 'DEP-01', taskId: 'T-117', bucket: 'Requires a decision' },
    { id: 'A-03', kind: 'Pending action', action: 'Record baseline and success criteria for the Deal Loss offer experiment', why: 'Experiment is live; without a baseline the result cannot be read.', ownerRole: 'Sales Operations', priority: 'P0', output: 'Experiment one-pager', dependency: 'None', timeline: 'By 6 Nov 2026 (proposed)', projectId: 'EXP-01', taskId: 'T-020', bucket: 'Implement immediately' },
    { id: 'A-04', kind: 'Pending action', action: 'Confirm MDRPL scope and revenue objective', why: 'Brief flags scope as unclear; no expansion assumed.', ownerRole: 'Head of Sales', priority: 'P1', output: 'Scope note in charter', dependency: 'None', timeline: 'By 13 Nov 2026 (proposed)', projectId: 'PRJ-03', taskId: 'T-026', bucket: 'Requires a decision' },
    { id: 'A-05', kind: 'Pending action', action: 'Confirm product name/proposition for initiative #15', why: 'Product name missing in brief.', ownerRole: 'Head of Sales', priority: 'P2', output: 'Confirmed name + proposition', dependency: 'None', timeline: 'By 28 Nov 2026 (proposed)', projectId: 'PRJ-13', taskId: 'T-094', bucket: 'Requires a decision' },
    { id: 'A-06', kind: 'Recommendation', action: 'Assign a named owner and accountable person to every project', why: '15 of 17 projects have TBD owners; nothing is actionable until owned.', ownerRole: 'Head of Sales', priority: 'P0', output: 'Owner fields updated in this dashboard', dependency: 'None', timeline: 'By 6 Nov 2026 (proposed)', projectId: '', taskId: '', bucket: 'Requires a decision' },
    { id: 'A-07', kind: 'Recommendation', action: 'Draft the 3-day SLA definitions (completion, clock, escalation) for approval', why: 'Highest-leverage, lowest-cost funnel change; definitions need no tech.', ownerRole: 'Sales Operations', priority: 'P1', output: 'SLA policy draft', dependency: 'None (CRM tracking follows)', timeline: 'By 14 Nov 2026 (proposed)', projectId: 'PRJ-10', taskId: 'T-078', bucket: 'Implement immediately' },
    { id: 'A-08', kind: 'Recommendation', action: 'Document the current no-show journey and extend tracking downstream', why: 'Protect the 4%→7% gain and measure whether reactivated leads convert.', ownerRole: 'Sales Operations', priority: 'P1', output: 'Journey doc + full-funnel report', dependency: 'CRM trigger check', timeline: 'By 28 Nov 2026 (proposed)', projectId: 'OPS-02', taskId: 'T-088', bucket: 'Implement immediately' },
    { id: 'A-09', kind: 'Recommendation', action: 'Build one shared school target list with a contact owner per school', why: 'Hire, Career Launchpad and Share would otherwise contact the same schools three times.', ownerRole: 'B2B Sales', priority: 'P1', output: 'Shared target list', dependency: 'None', timeline: 'By 28 Nov 2026 (proposed)', projectId: 'PRJ-12', taskId: 'T-053', bucket: 'Implement immediately' },
    { id: 'A-10', kind: 'Recommendation', action: 'Set webinar date and pricing', why: 'Content is underway but promotion and journeys cannot be scheduled without them.', ownerRole: 'Head of Sales with Marketing', priority: 'P1', output: 'Date + price', dependency: 'None', timeline: 'By 21 Nov 2026 (proposed)', projectId: 'PRJ-14', taskId: 'T-110', bucket: 'Requires a decision' },
    { id: 'A-11', kind: 'Recommendation', action: 'Request CRM/Tech capacity for four configurations (DL triggers, SLA timer, chat logging, UAE segment)', why: 'Four projects depend on CRM changes in Nov–Dec; sequencing needs to be agreed now.', ownerRole: 'Sales Operations → CRM/Tech', priority: 'P1', output: 'CRM change schedule', dependency: 'CRM/Tech capacity', timeline: 'By 14 Nov 2026 (proposed)', projectId: '', taskId: '', bucket: 'Requires technology / CRM support' },
    { id: 'A-12', kind: 'Recommendation', action: 'Confirm Observe and job-platform status with Product before committing dates', why: 'Two strategic projects depend on product readiness that Sales does not control.', ownerRole: 'Head of Sales → Product', priority: 'P2', output: 'Status note per product', dependency: 'Product', timeline: 'By 5 Dec 2026 (proposed)', projectId: 'PRJ-08', taskId: 'T-065', bucket: 'Requires another department' },
    { id: 'A-13', kind: 'Recommendation', action: 'Define the post-episode follow-up process for podcast guests', why: 'Only P1 task in the podcast; converts relationships into Suraasa Hire pipeline.', ownerRole: 'B2B Sales', priority: 'P1', output: 'Follow-up SOP', dependency: 'Suraasa Hire proposition', timeline: 'By 28 Nov 2026 (proposed)', projectId: 'OPS-03', taskId: 'T-105', bucket: 'Implement immediately' },
    { id: 'A-14', kind: 'Recommendation', action: 'Treat Ambassador, Referral, Chat and UAE Campaigns as "plan first" — full charters before execution', why: 'Each needs model/incentive/handover definitions and cross-functional input; no immediate action beyond planning.', ownerRole: 'Project Manager (proposed)', priority: 'P2', output: 'Completed charters', dependency: 'Owners assigned', timeline: 'By 21 Nov 2026 (proposed)', projectId: '', taskId: '', bucket: 'Requires a complete project plan' },
    { id: 'A-15', kind: 'Recommendation', action: 'Run EXP-01 and the no-show next test as time-boxed experiments with written criteria', why: 'Both are experiments; results must be comparable to baseline.', ownerRole: 'Sales Operations', priority: 'P1', output: 'Experiment one-pagers', dependency: 'None', timeline: 'By 6 Nov / 5 Dec 2026 (proposed)', projectId: 'EXP-01', taskId: 'T-020', bucket: 'Requires a pilot / experiment' }
  ];

  const governance = {
    cadence: {
      Daily: ['Critical overdue tasks', 'Blocker resolution', 'Immediate action queue'],
      Weekly: ['Project-owner updates (Weekly Review form)', 'Milestone tracking', 'RAG status review', 'Dependency and risk review', 'Next-week commitments'],
      Monthly: ['Portfolio performance', 'Revenue impact', 'Project prioritisation', 'Resource allocation', 'Continue / pause / stop decisions']
    },
    rag: {
      Green: 'On track — no overdue tasks or milestones, no blocking dependency past its required-by date, owner update within 14 days.',
      Amber: 'At risk — a milestone or task is due within 7 days with low progress, an open dependency is due within 14 days, no owner update for 14+ days on an active project, or no accountable owner.',
      Red: 'Delayed or blocked — any overdue milestone or task, a blocking dependency past its required-by date, or status set to Blocked.',
      Grey: 'Not started — no task has begun.'
    },
    classification: [
      { initiative: '1. Ambassador Program', mapped: 'PRJ-01 — Project (4 workstreams, 4 milestones)', note: 'Monthly review becomes recurring after launch.' },
      { initiative: '2. Referral Plan', mapped: 'PRJ-02 — Project', note: 'Fortnightly report recurring after launch.' },
      { initiative: '3. Deal Loss – Application-Based Offers', mapped: 'EXP-01 — Experiment (hypothesis, 4-week test, criteria)', note: 'In progress. Baseline/criteria TBD.' },
      { initiative: '4. MDRPL', mapped: 'PRJ-03 — Project (scope flagged)', note: 'No expansion assumed; DEC-05.' },
      { initiative: '5. UAE Leads', mapped: 'PRJ-04 — Project (program SI-02)', note: 'Linked to PRJ-05, not merged.' },
      { initiative: '6. UAE Campaigns', mapped: 'PRJ-05 — Project (program SI-02)', note: 'Marketing-led demand; sales handover owned here.' },
      { initiative: '7. Milestone 3 – Career Launchpad', mapped: 'PRJ-06 — Strategic project (program SI-01)', note: 'Consumes shared school outreach from PRJ-12.' },
      { initiative: '8. Deal Loss – SLA Reactivation', mapped: 'PRJ-07 — Project → Recurring ops', note: 'Distinct from EXP-01; cohorts must not overlap.' },
      { initiative: '9. Observe', mapped: 'PRJ-08 — Strategic project', note: 'Product dependency.' },
      { initiative: '10. Chat Process', mapped: 'PRJ-09 — Project → Recurring ops', note: 'Needs approved messaging.' },
      { initiative: '11. Setter SLA – Three Days', mapped: 'PRJ-10 (implementation) + OPS-01 (recurring compliance)', note: 'Split per brief.' },
      { initiative: '12. No-Show Reactivation', mapped: 'OPS-02 — Recurring operation + experiment', note: 'Baseline 4% → current 7% preserved.' },
      { initiative: '13. Messaging Optimisation', mapped: 'PRJ-11 — Project; review = immediate task T-059', note: 'P0 (proposed).' },
      { initiative: '14. Suraasa Hire', mapped: 'PRJ-12 — Project (program SI-01)', note: 'Owns shared school outreach engine.' },
      { initiative: '15. Suraasa (name missing)', mapped: 'PRJ-13 — Project (name to confirm, DEC-06)', note: 'Uses shared list; no separate outreach.' },
      { initiative: '16. School Leaders Podcast', mapped: 'OPS-03 — Recurring programme with per-episode task template', note: 'Follow-up process is the P1 task.' },
      { initiative: '17. Paid Webinar', mapped: 'PRJ-14 — Project', note: 'In progress (content).' },
      { initiative: '18. HR Email Outreach and LOIs', mapped: 'Workstream WS-12B inside PRJ-12 (not a separate project)', note: 'Avoids duplicate outreach.' },
      { initiative: '19. Vouchers, Approvals and Incentives', mapped: 'DEP-01 — Dependency cluster + Decision Register DEC-02/03/04', note: 'Owner per item TBD (AK vs Ankit).' }
    ]
  };

  
  const options = {
    priorities: ['P0', 'P1', 'P2', 'P3'],
    projectStatuses: ['Not Started', 'In Progress', 'On Hold', 'Blocked', 'Completed'],
    taskStatuses: ['Not Started', 'In Progress', 'Awaiting Approval', 'Blocked', 'On Hold', 'Completed'],
    taskKinds: ['Task', 'Subtask', 'Recurring', 'Decision'],
    milestoneStatuses: ['Pending', 'In Progress', 'Completed'],
    categories: [
      'Revenue Generation',
      'Funnel Conversion & Sales Productivity',
      'B2B Business Development',
      'Marketing & Demand Generation',
      'Cross-functional Dependencies'
    ],
    projectTypes: [
      'Project',
      'Strategic Project',
      'Experiment',
      'Recurring Operation',
      'Recurring Programme',
      'Project → Recurring Ops',
      'Dependency Cluster',
      'Recurring Operation + Experiment'
    ],
    valueClasses: [
      'Revenue-generating',
      'Conversion improvement',
      'Operational efficiency',
      'Strategic growth',
      'Experiment',
      'Dependency'
    ],
    riskLevels: ['High', 'Medium', 'Low'],
    riskStatuses: ['Open', 'Mitigated', 'Resolved', 'Escalated', 'Closed'],
    dependencyStatuses: ['Open', 'Escalated', 'Resolved', 'Closed'],
    decisionStatuses: ['Open', 'Pending Ankit Khanna decision', 'Closed', 'Escalated'],
    actionKinds: ['Immediate action', 'Pending action', 'Recommendation'],
    actionBuckets: [
      'Implement immediately',
      'Requires a decision',
      'Requires technology / CRM support',
      'Requires another department',
      'Requires a complete project plan',
      'Requires a pilot / experiment'
    ],
    updateRag: ['Green', 'Amber', 'Red']
  };

  const stamp = new Date().toISOString();
  return {
    meta: {
      app: 'Suraasa Sales Control Tower',
      schema: 2,
      version: 1,
      seeded: stamp,
      savedAt: stamp,
      sync: {
        url: 'https://script.google.com/macros/s/AKfycbxHM02G-PRe0xrkGvMaOej0Fq-uU_pX8AW1EnoTfGGL3bqsmA-fm2Kdz9j8XGUu81Km/exec',
        enabled: true,
        autoSync: true,
        lastSync: null,
        status: 'connected',
        error: null,
        baseVersion: 2
      },
      note: 'Seed built from the Head of Sales brief dated 30 Oct 2026. All dates and owners marked TBD/(proposed) are unconfirmed.'
    },
    roles, programs, projects, tasks, risks, dependencies, decisions, updates: [], actions, governance, options,
    activity: [{ ts: stamp, text: 'Control Tower initialised with seed data from the Head of Sales brief (19 initiatives → 19 project records, ' + tasks.length + ' tasks).' }]
  };
}
