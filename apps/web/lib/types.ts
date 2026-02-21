export type Certification = {
  id: string;
  org_id: string;
  name: string;
  framework_type: string | null;
  issuing_body: string | null;
  issue_date: string | null;
  expiry_date: string | null;
  status: string;
  notes: string | null;
  owner_user_id: string | null;
  created_at: string;
  updated_at: string;
};

export type Risk = {
  id: string;
  org_id: string;
  title: string;
  description: string | null;
  category: string | null;
  likelihood: number;
  impact: number;
  frequency: number | null;
  control_effectiveness: number | null;
  inherent_score: number;
  residual_likelihood: number | null;
  residual_impact: number | null;
  residual_score: number | null;
  status: string;
  treatment_plan: string | null;
  due_date: string | null;
  owner_user_id: string | null;
  created_at: string;
  updated_at: string;
};

export type Audit = {
  id: string;
  org_id: string;
  type: "INTERNAL" | "EXTERNAL" | "CERTIFICATION";
  title: string;
  scope: string | null;
  auditor: string | null;
  start_date: string | null;
  end_date: string | null;
  status: string;
  created_at: string;
  updated_at: string;
};

export type Finding = {
  id: string;
  org_id: string;
  audit_id: string;
  title: string;
  description: string | null;
  severity: "LOW" | "MEDIUM" | "HIGH" | "CRITICAL";
  status: string;
  recommendation: string | null;
  due_date: string | null;
  owner_user_id: string | null;
  created_at: string;
  updated_at: string;
};

export type EvidenceFile = {
  id: string;
  file_name: string;
  mime_type: string;
  file_size: number;
  uploaded_at: string;
};

export type Asset = {
  id: string;
  org_id: string;
  name: string;
  description: string | null;
  category: string | null;
  asset_type: string;
  owner: string | null;
  bia_score: number | null;
  dca_score: number | null;
  combined_classification: number | null;
  status: string;
  review_date: string | null;
  notes: string | null;
  owner_user_id: string | null;
  created_at: string;
  updated_at: string;
};

export type Incident = {
  id: string;
  org_id: string;
  title: string;
  description: string | null;
  incident_date: string | null;
  detected_date: string | null;
  category: string | null;
  severity: string;
  asset_id: string | null;
  asset_name: string | null;
  root_cause: string | null;
  immediate_action: string | null;
  corrective_action: string | null;
  reported_by: string | null;
  assigned_to: string | null;
  status: string;
  resolved_date: string | null;
  owner_user_id: string | null;
  created_at: string;
  updated_at: string;
};

export type Change = {
  id: string;
  org_id: string;
  title: string;
  description: string | null;
  change_type: string;
  priority: string;
  asset_id: string | null;
  asset_name: string | null;
  asset_classification: number | null;
  justification: string | null;
  impact_analysis: string | null;
  rollback_plan: string | null;
  planned_start: string | null;
  planned_end: string | null;
  actual_start: string | null;
  actual_end: string | null;
  requested_by: string | null;
  approved_by: string | null;
  implemented_by: string | null;
  status: string;
  owner_user_id: string | null;
  created_at: string;
  updated_at: string;
};

export type NonConformity = {
  id: string;
  org_id: string;
  title: string;
  description: string | null;
  source_type: string;
  source_ref_id: string | null;
  category: string | null;
  severity: string;
  asset_id: string | null;
  asset_name: string | null;
  root_cause: string | null;
  containment_action: string | null;
  raised_by: string | null;
  assigned_to: string | null;
  due_date: string | null;
  closed_date: string | null;
  status: string;
  owner_user_id: string | null;
  created_at: string;
  updated_at: string;
};

export type CAPA = {
  id: string;
  org_id: string;
  capa_number: number;
  title: string;
  description: string | null;
  capa_type: string;
  source_type: string | null;
  source_ref_id: string | null;
  asset_id: string | null;
  asset_name: string | null;
  root_cause: string | null;
  root_cause_category: string | null;
  analysis_method: string | null;
  action_plan: string | null;
  verification_method: string | null;
  effectiveness_review: string | null;
  effectiveness_status: string | null;
  raised_by: string | null;
  assigned_to: string | null;
  verified_by: string | null;
  closure_approved_by: string | null;
  closure_comments: string | null;
  due_date: string | null;
  completed_date: string | null;
  verified_date: string | null;
  priority: string;
  status: string;
  owner_user_id: string | null;
  created_at: string;
  updated_at: string;
};

export type ActivityLog = {
  id: string;
  action: string;
  entity_type: string;
  entity_id: string;
  meta: Record<string, any>;
  full_name: string | null;
  email: string | null;
  created_at: string;
};

// ========== Phase E: Cross-Links & Enhanced Dashboard ==========

export type CrossLink = {
  id: string;
  org_id: string;
  source_type: string;
  source_id: string;
  source_title: string | null;
  target_type: string;
  target_id: string;
  target_title: string | null;
  link_type: "GENERATED" | "MANUAL";
  created_by: string | null;
  created_at: string;
};

export type TrendPoint = {
  month: string;
  label: string;
  count: number;
};

export type DashboardKPIs = {
  mttr: number | null;
  capaEffectivenessRate: number | null;
  capaEffective: number;
  capaTotal: number;
  totalOverdue: number;
  overdueNCs: number;
  overdueCAPAs: number;
  overdueRisks: number;
  overdueFindings: number;
  riskTreatmentRate: number | null;
  riskTreated: number;
  riskTotal: number;
  auditCompletionRate: number | null;
  auditCompleted: number;
  auditTotal: number;
  ncClosureRate: number | null;
  ncClosed: number;
  ncTotal: number;
};

export type DashboardKRIs = {
  highRisks: number;
  recentCriticalIncidents: number;
  expiredCerts: number;
  weakControls: number;
};

export type DashboardTrends = {
  incidents: TrendPoint[];
  risks: TrendPoint[];
  ncs: TrendPoint[];
  capas: TrendPoint[];
};

export type DashboardEnhanced = {
  kpis: DashboardKPIs;
  kris: DashboardKRIs;
  trends: DashboardTrends;
  recentLinks: CrossLink[];
  recentActivity: ActivityLog[];
};
