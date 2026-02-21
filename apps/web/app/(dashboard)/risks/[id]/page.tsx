import { getRisk, getEvidence, getEntityActivity, getEntityCrossLinks, updateRisk, deleteRisk, uploadEvidence, deleteEvidence, getCurrentRole } from "../../../../lib/api";
import type { Risk } from "../../../../lib/types";
import RiskDetailClient from "./RiskDetailClient";

export default async function RiskDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const risk: Risk = await getRisk(id);
  const evidence = await getEvidence("RISK", id);
  let activity: any[] = [];
  try { activity = await getEntityActivity("RISK", id); } catch { activity = []; }
  let crossLinks: any[] = [];
  try { crossLinks = await getEntityCrossLinks("RISK", id); } catch { crossLinks = []; }

  const role = await getCurrentRole();
  return (
    <RiskDetailClient
      risk={risk}
      evidence={evidence}
      activity={activity}
      crossLinks={crossLinks}
      updateRisk={updateRisk}
      deleteRisk={deleteRisk}
      uploadEvidence={uploadEvidence}
      deleteEvidence={deleteEvidence}
      role={role}
    />
  );
}
