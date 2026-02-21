import { createChange, getChanges, getAssets , getCurrentRole } from "../../../lib/api";
import type { Change, Asset } from "../../../lib/types";
import ExportButton from "../ExportButton";
import ChangeListClient from "./ChangeListClient";

export default async function ChangesPage() {
  const rows: Change[] = await getChanges();
  const assets: Asset[] = await getAssets();

  const role = await getCurrentRole();
  return (
    <>
      <div className="page-header">
        <div>
          <h1 className="page-title">Change Management</h1>
          <p className="page-subtitle">Request, approve, and track changes to assets and systems</p>
        </div>
        <ExportButton type="changes" />
      </div>

      {role !== "VIEWER" && (
      <div className="card" style={{ marginBottom: 16 }}>
        <div style={{ fontSize: 14, fontWeight: 600, marginBottom: 14, color: "#111" }}>Request Change</div>
        <form action={createChange} className="form-grid">
          <div className="form-group form-full">
            <label className="form-label">Change Title</label>
            <input name="title" className="form-input" placeholder="Upgrade production database to PostgreSQL 16" required />
          </div>
          <div className="form-group">
            <label className="form-label">Change Type</label>
            <select name="changeType" className="form-select" defaultValue="STANDARD">
              <option value="STANDARD">Standard</option>
              <option value="NORMAL">Normal</option>
              <option value="EMERGENCY">Emergency</option>
              <option value="EXPEDITED">Expedited</option>
            </select>
          </div>
          <div className="form-group">
            <label className="form-label">Priority</label>
            <select name="priority" className="form-select" defaultValue="MEDIUM">
              <option value="LOW">Low</option>
              <option value="MEDIUM">Medium</option>
              <option value="HIGH">High</option>
              <option value="CRITICAL">Critical</option>
            </select>
          </div>
          <div className="form-group">
            <label className="form-label">Affected Asset</label>
            <select name="assetId" className="form-select" defaultValue="">
              <option value="">None</option>
              {assets.map((a) => (
                <option key={a.id} value={a.id}>{a.name} ({a.asset_type})</option>
              ))}
            </select>
          </div>
          <div className="form-group">
            <label className="form-label">Requested By</label>
            <input name="requestedBy" className="form-input" placeholder="Name or team" />
          </div>
          <div className="form-group">
            <label className="form-label">Planned Start</label>
            <input name="plannedStart" type="date" className="form-input" />
          </div>
          <div className="form-group">
            <label className="form-label">Planned End</label>
            <input name="plannedEnd" type="date" className="form-input" />
          </div>
          <div className="form-group form-full">
            <label className="form-label">Justification</label>
            <textarea name="justification" className="form-textarea" placeholder="Why is this change needed?" />
          </div>
          <div className="form-group form-full">
            <label className="form-label">Description</label>
            <textarea name="description" className="form-textarea" placeholder="What exactly will be changed?" />
          </div>
          <div className="form-full">
            <button type="submit" className="btn btn-primary">Submit Change Request</button>
          </div>
        </form>
      </div>
      )}

      <ChangeListClient changes={rows} />
    </>
  );
}
