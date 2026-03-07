import { createAsset, getAssets , getCurrentRole } from "../../../lib/api";
import type { Asset } from "../../../lib/types";
import ExportButton from "../ExportButton";

const BIA_LABELS: Record<number, string> = { 1: "Supporting", 2: "Significant", 3: "Critical", 4: "Highly Critical" };
const DCA_LABELS: Record<number, string> = { 1: "Public", 2: "Internal", 3: "Confidential", 4: "Highly Confidential" };
const CLASS_COLORS: Record<number, string> = { 1: "#22c55e", 2: "#3b82f6", 3: "#f59e0b", 4: "#ef4444" };

export default async function AssetsPage() {
  const rows: Asset[] = await getAssets();

  const role = await getCurrentRole();
  return (
    <>
      <div className="page-header">
        <div>
          <h1 className="page-title">Asset Register</h1>
          <p className="page-subtitle">Business Impact Analysis & Data Classification — the foundation of the ISMS</p>
        </div>
        <ExportButton type="assets" />
      </div>

      {role !== "VIEWER" && (
      <div className="card" style={{ marginBottom: 16 }}>
        <div style={{ fontSize: 14, fontWeight: 600, marginBottom: 14, color: "#111" }}>Register New Asset</div>
        <form action={createAsset} className="form-grid">
          <div className="form-group form-full">
            <label className="form-label">Asset Name / ID</label>
<input name="name" className="form-input" placeholder="SRV-001 / Production Database Server" required />
          </div>
          <div className="form-group">
            <label className="form-label">Asset Type</label>
            <select name="assetType" className="form-select" defaultValue="SYSTEM">
              <option value="PRODUCT">Product</option>
              <option value="SYSTEM">System</option>
              <option value="STUDIO">Studio</option>
              <option value="DATA">Data</option>
              <option value="PEOPLE">People</option>
              <option value="FACILITY">Facility</option>
            </select>
          </div>
          <div className="form-group">
            <label className="form-label">Category</label>
            <input name="category" className="form-input" placeholder="Infrastructure / Application / ..." />
          </div>
          <div className="form-group">
            <label className="form-label">Owner</label>
            <input name="owner" className="form-input" placeholder="Team or person responsible" />
          </div>
          <div className="form-group">
            <label className="form-label">Review Date</label>
            <input name="reviewDate" type="date" className="form-input" />
          </div>
          <div className="form-group">
            <label className="form-label">BIA — Business Impact (1-4)</label>
            <select name="biaScore" className="form-select" defaultValue="">
              <option value="">Not assessed</option>
              <option value="1">1 — Supporting</option>
              <option value="2">2 — Significant</option>
              <option value="3">3 — Critical</option>
              <option value="4">4 — Highly Critical</option>
            </select>
          </div>
          <div className="form-group">
            <label className="form-label">DCA — Data Classification (1-4)</label>
            <select name="dcaScore" className="form-select" defaultValue="">
              <option value="">Not assessed</option>
              <option value="1">1 — Public</option>
              <option value="2">2 — Internal</option>
              <option value="3">3 — Confidential</option>
              <option value="4">4 — Highly Confidential</option>
            </select>
          </div>
          <div className="form-group form-full">
            <label className="form-label">Description</label>
            <textarea name="description" className="form-textarea" placeholder="What this asset is and what it does..." />
          </div>
          <div className="form-full">
            <button type="submit" className="btn btn-primary">Register Asset</button>
          </div>
        </form>
      </div>
      )}

      {/* Summary Stats */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 12, marginBottom: 16 }}>
        {[4, 3, 2, 1].map((level) => {
          const count = rows.filter((a) => a.combined_classification === level).length;
          const labels: Record<number, string> = { 4: "Highly Critical", 3: "Critical", 2: "Significant", 1: "Supporting" };
          return (
            <div key={level} className="card" style={{ padding: "12px 16px", textAlign: "center", borderLeft: `3px solid ${CLASS_COLORS[level]}` }}>
              <div style={{ fontSize: 24, fontWeight: 700, color: CLASS_COLORS[level] }}>{count}</div>
              <div style={{ fontSize: 11, color: "#6b7280", textTransform: "uppercase", fontWeight: 600 }}>{labels[level]}</div>
            </div>
          );
        })}
      </div>

      <div className="table-card">
        <table className="table">
          <thead>
            <tr>
              <th>Asset Name</th>
              <th>Type</th>
              <th>Owner</th>
              <th>BIA</th>
              <th>DCA</th>
              <th>Classification</th>
              <th>Status</th>
              <th style={{ width: 80 }}></th>
            </tr>
          </thead>
          <tbody>
            {rows.map((a) => (
              <tr key={a.id}>
                <td>
                  <a href={`/assets/${a.id}`} style={{ fontWeight: 550, color: "#111", textDecoration: "none" }}>
                    {a.name}
                  </a>
                  {a.category && <div style={{ fontSize: 11, color: "#6b7280" }}>{a.category}</div>}
                </td>
                <td><span className={`badge badge-${a.asset_type.toLowerCase()}`}>{a.asset_type}</span></td>
                <td style={{ fontSize: 13 }}>{a.owner || "—"}</td>
                <td>
                  {a.bia_score ? (
                    <span style={{ fontSize: 12, fontWeight: 600, color: CLASS_COLORS[a.bia_score] }}>
                      {a.bia_score} — {BIA_LABELS[a.bia_score]}
                    </span>
                  ) : <span style={{ fontSize: 12, color: "#d1d5db" }}>Not assessed</span>}
                </td>
                <td>
                  {a.dca_score ? (
                    <span style={{ fontSize: 12, fontWeight: 600, color: CLASS_COLORS[a.dca_score] }}>
                      {a.dca_score} — {DCA_LABELS[a.dca_score]}
                    </span>
                  ) : <span style={{ fontSize: 12, color: "#d1d5db" }}>Not assessed</span>}
                </td>
                <td>
                  {a.combined_classification ? (
                    <span style={{
                      display: "inline-block",
                      padding: "2px 10px",
                      borderRadius: 4,
                      fontSize: 11,
                      fontWeight: 700,
                      color: "#fff",
                      background: CLASS_COLORS[a.combined_classification],
                    }}>
                      LEVEL {a.combined_classification}
                    </span>
                  ) : <span style={{ fontSize: 12, color: "#d1d5db" }}>—</span>}
                </td>
                <td><span className={`badge badge-${a.status.toLowerCase()}`}>{a.status.replace(/_/g, " ")}</span></td>
                <td>
                  <a href={`/assets/${a.id}`} className="btn btn-secondary" style={{ padding: "4px 10px", fontSize: 12 }}>Open →</a>
                </td>
              </tr>
            ))}
            {rows.length === 0 && (
              <tr><td colSpan={8} style={{ textAlign: "center", padding: "48px 24px" }}>
                <div style={{ fontSize: 36, marginBottom: 8 }}>🖥️</div>
                <div style={{ fontSize: 15, fontWeight: 600, color: "#4b5563", marginBottom: 4 }}>No assets registered yet</div>
                <div style={{ fontSize: 13, color: "#6b7280" }}>Register your first asset above. Assets are the foundation for incident priority, change approval levels, and risk context.</div>
              </td></tr>
            )}
          </tbody>
        </table>
      </div>
    </>
  );
}
