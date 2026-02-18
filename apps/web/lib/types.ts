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
  created_at: string;
};

export type Risk = {
  id: string;
  org_id: string;
  title: string;
  category: string | null;
  likelihood: number;
  impact: number;
  inherent_score: number;
  status: string;
  treatment_plan: string | null;
  due_date: string | null;
  created_at: string;
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
};

export type Finding = {
  id: string;
  org_id: string;
  audit_id: string;
  title: string;
  severity: "LOW" | "MEDIUM" | "HIGH" | "CRITICAL";
  status: string;
  due_date: string | null;
  recommendation: string | null;
  created_at: string;
};
