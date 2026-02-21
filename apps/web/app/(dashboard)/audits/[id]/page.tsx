import { getAudit, getFindings, getEvidence, getEntityActivity, updateAudit, deleteAudit, createFinding, updateFinding, deleteFinding, sendFindingToRisk, uploadEvidence, deleteEvidence, getCurrentRole } from "../../../../lib/api";
import type { Audit, Finding } from "../../../../lib/types";
import AuditDetailClient from "./AuditDetailClient";

export default async function AuditDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const audit: Audit = await getAudit(id);
  const findings: Finding[] = await getFindings(id);
  const evidence = await getEvidence("AUDIT", id);
 let activity: any[] = [];
try { activity = await getEntityActivity("AUDIT", id); } catch { activity = []; }

  const role = await getCurrentRole();
  return (
    <AuditDetailClient
      audit={audit}
      findings={findings}
      evidence={evidence}
      activity={activity}
      updateAudit={updateAudit}
      deleteAudit={deleteAudit}
      createFinding={createFinding}
      updateFinding={updateFinding}
      deleteFinding={deleteFinding}
      sendFindingToRisk={sendFindingToRisk}
      uploadEvidence={uploadEvidence}
      deleteEvidence={deleteEvidence}
      role={role}
    />
  );
}
