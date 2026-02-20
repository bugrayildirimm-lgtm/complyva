import { getRisk, getEvidence, getEntityActivity, updateRisk, deleteRisk, uploadEvidence, deleteEvidence } from "../../../../lib/api";
import type { Risk } from "../../../../lib/types";
import RiskDetailClient from "./RiskDetailClient";

export default async function RiskDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const risk: Risk = await getRisk(id);
  const evidence = await getEvidence("RISK", id);
  let activity: any[] = [];
  try { activity = await getEntityActivity("RISK", id); } catch { activity = []; }

  return (
    <RiskDetailClient
      risk={risk}
      evidence={evidence}
      activity={activity}
      updateRisk={updateRisk}
      deleteRisk={deleteRisk}
      uploadEvidence={uploadEvidence}
      deleteEvidence={deleteEvidence}
    />
  );
}
