"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { Tabs, InlineEdit, DeleteButton, StatusDropdown } from "../../ActionComponents";
import EvidencePanel from "../../EvidencePanel";
import type { Asset } from "../../../../lib/types";

const BIA_LABELS: Record<number, string> = { 1: "Supporting", 2: "Significant", 3: "Critical", 4: "Highly Critical" };
const DCA_LABELS: Record<number, string> = { 1: "Public", 2: "Internal", 3: "Confidential", 4: "Highly Confidential" };
const CLASS_COLORS: Record<number, string> = { 1: "#22c55e", 2: "#3b82f6", 3: "#f59e0b", 4: "#ef4444" };
const CLASS_BG: Record<number, string> = { 1: "#f0fdf4", 2: "#eff6ff", 3: "#fffbeb", 4: "#fef2f2" };

export default function AssetDetailClient({
  asset,
  evidence,
  activity,
  updateAsset,
  deleteAsset,
  uploadEvidence,
  deleteEvidence,
  role,
}: {
  asset: Asset;
  evidence: any[];
  activity: any[];
  updateAsset: (id: string, data: Record<string, any>) => Promise<void>;
  deleteAsset: (id: string) => Promise<void>;
  uploadEvidence: (entityType: string, entityId: string, formData: FormData) => Promise<any>;
  deleteEvidence: (fileId: string) => Promise<any>;
  role: string;
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const canEdit = role !== "VIEWER";

  const handleSaveField = async (name: string, value: string) => {
    const numericFields = ["biaScore", "dcaScore"];
    await updateAsset(asset.id, { [name]: numericFields.includes(name) ? Number(value) : value });
    router.refresh();
  };

  const handleStatusChange = async (newStatus: string) => {
    await updateAsset(asset.id, { status: newStatus });
    router.refresh();
  };

  const handleDelete = async () => {
    await deleteAsset(asset.id);
    router.push("/assets");
  };

  const combined = asset.combined_classification;

  return (
    <>
      {/* Header */}
      <div className="page-header">
        <div>
          <a href="/assets" style={{ fontSize: 12, color: "#6b7280", textDecoration: "none" }}>← Back to Asset Register</a>
          <h1 className="page-title" style={{ marginTop: 4 }}>{asset.name}</h1>
          <p className="page-subtitle">
            {asset.asset_type} · {asset.category || "Uncategorized"} · {asset.owner || "No owner"}
          </p>
        </div>
        <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
          <StatusDropdown
            currentStatus={asset.status}
            options={["ACTIVE", "UNDER_REVIEW", "DECOMMISSIONED"]}
            onStatusChange={handleStatusChange}
          />
          {canEdit && <DeleteButton onDelete={handleDelete} />}
        </div>
      </div>

      {/* Classification Cards */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 16, marginBottom: 20 }}>
        {/* BIA */}
        <div className="card" style={{
          padding: "20px",
          borderLeft: `4px solid ${asset.bia_score ? CLASS_COLORS[asset.bia_score] : "#d1d5db"}`,
          background: asset.bia_score ? CLASS_BG[asset.bia_score] : "#fff",
        }}>
          <div style={{ fontSize: 11, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.05em", color: "#9ca3af", marginBottom: 8 }}>
            Business Impact Analysis
          </div>
          {asset.bia_score ? (
            <>
              <div style={{ fontSize: 32, fontWeight: 700, color: CLASS_COLORS[asset.bia_score] }}>{asset.bia_score}</div>
              <div style={{ fontSize: 14, fontWeight: 600, color: CLASS_COLORS[asset.bia_score], marginTop: 2 }}>
                {BIA_LABELS[asset.bia_score]}
              </div>
            </>
          ) : (
            <div style={{ fontSize: 14, color: "#9ca3af", padding: "8px 0" }}>Not assessed</div>
          )}
        </div>

        {/* DCA */}
        <div className="card" style={{
          padding: "20px",
          borderLeft: `4px solid ${asset.dca_score ? CLASS_COLORS[asset.dca_score] : "#d1d5db"}`,
          background: asset.dca_score ? CLASS_BG[asset.dca_score] : "#fff",
        }}>
          <div style={{ fontSize: 11, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.05em", color: "#9ca3af", marginBottom: 8 }}>
            Data Classification Assessment
          </div>
          {asset.dca_score ? (
            <>
              <div style={{ fontSize: 32, fontWeight: 700, color: CLASS_COLORS[asset.dca_score] }}>{asset.dca_score}</div>
              <div style={{ fontSize: 14, fontWeight: 600, color: CLASS_COLORS[asset.dca_score], marginTop: 2 }}>
                {DCA_LABELS[asset.dca_score]}
              </div>
            </>
          ) : (
            <div style={{ fontSize: 14, color: "#9ca3af", padding: "8px 0" }}>Not assessed</div>
          )}
        </div>

        {/* Combined */}
        <div className="card" style={{
          padding: "20px",
          borderLeft: `4px solid ${combined ? CLASS_COLORS[combined] : "#d1d5db"}`,
          background: combined ? CLASS_BG[combined] : "#fff",
        }}>
          <div style={{ fontSize: 11, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.05em", color: "#9ca3af", marginBottom: 8 }}>
            Combined Classification
          </div>
          {combined ? (
            <>
              <div style={{ fontSize: 32, fontWeight: 700, color: CLASS_COLORS[combined] }}>LEVEL {combined}</div>
              <div style={{ fontSize: 12, color: "#6b7280", marginTop: 4 }}>
                max(BIA={asset.bia_score}, DCA={asset.dca_score}) = {combined}
              </div>
              <div style={{ fontSize: 11, color: "#9ca3af", marginTop: 2 }}>
                Controls incident priority, change approval level
              </div>
            </>
          ) : (
            <div style={{ fontSize: 14, color: "#9ca3af", padding: "8px 0" }}>Complete BIA and DCA to calculate</div>
          )}
        </div>
      </div>

      {/* Tabs */}
      <div className="card">
        <Tabs tabs={["Details", "Classification", "Evidence", "Activity"]}>
          {/* Details Tab */}
          <div>
            <InlineEdit label="Name" name="name" value={asset.name} onSave={handleSaveField} />
            <InlineEdit label="Description" name="description" value={asset.description || ""} type="textarea" onSave={handleSaveField} />
            <InlineEdit label="Asset Type" name="assetType" value={asset.asset_type} type="select"
              options={["PRODUCT", "SYSTEM", "STUDIO", "DATA", "PEOPLE", "FACILITY"]} onSave={handleSaveField} />
            <InlineEdit label="Category" name="category" value={asset.category || ""} onSave={handleSaveField} />
            <InlineEdit label="Owner" name="owner" value={asset.owner || ""} onSave={handleSaveField} />
            <InlineEdit label="Review Date" name="reviewDate" value={asset.review_date ? String(asset.review_date).slice(0, 10) : ""} type="date" onSave={handleSaveField} />
            <InlineEdit label="Notes" name="notes" value={asset.notes || ""} type="textarea" onSave={handleSaveField} />
          </div>

          {/* Classification Tab */}
          <div>
            <div style={{ marginBottom: 24 }}>
              <div style={{ fontSize: 13, fontWeight: 600, color: "#111", marginBottom: 6 }}>
                Business Impact Analysis (BIA)
              </div>
              <div style={{ fontSize: 12, color: "#6b7280", marginBottom: 12 }}>
                How critical is this asset to our operations?
              </div>
              <InlineEdit
                label="BIA Score (1-4)"
                name="biaScore"
                value={asset.bia_score ? String(asset.bia_score) : ""}
                type="select"
                options={["1", "2", "3", "4"]}
                onSave={handleSaveField}
              />
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8, marginTop: 8 }}>
                {[
                  { score: 4, label: "Highly Critical", desc: "Immediate halt of regulated operations" },
                  { score: 3, label: "Critical", desc: "Severe degradation, major revenue loss" },
                  { score: 2, label: "Significant", desc: "Disrupts non-core processes" },
                  { score: 1, label: "Supporting", desc: "Minimal business impact" },
                ].map((item) => (
                  <div key={item.score} style={{
                    padding: "8px 12px",
                    borderRadius: 6,
                    border: `1px solid ${asset.bia_score === item.score ? CLASS_COLORS[item.score] : "#e5e7eb"}`,
                    background: asset.bia_score === item.score ? CLASS_BG[item.score] : "#fff",
                    fontSize: 12,
                  }}>
                    <span style={{ fontWeight: 600, color: CLASS_COLORS[item.score] }}>{item.score}</span>
                    <span style={{ fontWeight: 600, marginLeft: 6 }}>{item.label}</span>
                    <div style={{ fontSize: 11, color: "#6b7280", marginTop: 2 }}>{item.desc}</div>
                  </div>
                ))}
              </div>
            </div>

            <div style={{ borderTop: "1px solid #f3f4f6", paddingTop: 24 }}>
              <div style={{ fontSize: 13, fontWeight: 600, color: "#111", marginBottom: 6 }}>
                Data Classification Assessment (DCA)
              </div>
              <div style={{ fontSize: 12, color: "#6b7280", marginBottom: 12 }}>
                How sensitive is the data this asset processes?
              </div>
              <InlineEdit
                label="DCA Score (1-4)"
                name="dcaScore"
                value={asset.dca_score ? String(asset.dca_score) : ""}
                type="select"
                options={["1", "2", "3", "4"]}
                onSave={handleSaveField}
              />
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8, marginTop: 8 }}>
                {[
                  { score: 4, label: "Highly Confidential", desc: "PII, trade secrets, security-sensitive" },
                  { score: 3, label: "Confidential", desc: "Business-sensitive, commercial value" },
                  { score: 2, label: "Internal", desc: "General internal business information" },
                  { score: 1, label: "Public", desc: "Approved for public release" },
                ].map((item) => (
                  <div key={item.score} style={{
                    padding: "8px 12px",
                    borderRadius: 6,
                    border: `1px solid ${asset.dca_score === item.score ? CLASS_COLORS[item.score] : "#e5e7eb"}`,
                    background: asset.dca_score === item.score ? CLASS_BG[item.score] : "#fff",
                    fontSize: 12,
                  }}>
                    <span style={{ fontWeight: 600, color: CLASS_COLORS[item.score] }}>{item.score}</span>
                    <span style={{ fontWeight: 600, marginLeft: 6 }}>{item.label}</span>
                    <div style={{ fontSize: 11, color: "#6b7280", marginTop: 2 }}>{item.desc}</div>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Evidence Tab */}
          <div>
            <EvidencePanel
              entityType="ASSET"
              entityId={asset.id}
              files={evidence}
              uploadAction={uploadEvidence}
              deleteAction={deleteEvidence}
              readOnly={!canEdit}
            />
          </div>

          {/* Activity Tab */}
          <div>
            {activity.map((a: any) => (
              <div key={a.id} style={{
                padding: "10px 0",
                borderBottom: "1px solid #f3f4f6",
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
              }}>
                <div>
                  <span style={{ fontSize: 13, fontWeight: 500, color: "#111" }}>{a.action}</span>
                  <span style={{ fontSize: 12, color: "#6b7280", marginLeft: 8 }}>by {a.full_name || a.email || "System"}</span>
                </div>
                <span style={{ fontSize: 12, color: "#9ca3af" }}>{new Date(a.created_at).toLocaleString()}</span>
              </div>
            ))}
            {activity.length === 0 && (
              <div style={{ textAlign: "center", padding: 24, color: "#9ca3af", fontSize: 13 }}>No activity yet.</div>
            )}
          </div>
        </Tabs>
      </div>
    </>
  );
}
