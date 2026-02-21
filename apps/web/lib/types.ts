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
