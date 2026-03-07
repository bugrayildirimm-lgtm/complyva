import { getRisk, getEvidence, getEntityActivity, getEntityCrossLinks, updateRisk, deleteRisk, uploadEvidence, deleteEvidence, getCurrentRole, getRiskScoreHistory } from "../../../../lib/api";
import type { Risk } from "../../../../lib/types";
import RiskDetailClient from "./RiskDetailClient";

export default async function RiskDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  let risk: Risk;
  let evidence: any[] = [];
  let activity: any[] = [];
  let crossLinks: any[] = [];
  let role = "VIEWER";
  try {
    risk = await getRisk(id);
  } catch (err: any) {
    throw new Error(`Risk load failed: ${err?.message || err}`);
  }
  try { evidence = await getEvidence("RISK", id); } catch { evidence = []; }
  try { activity = await getEntityActivity("RISK", id); } catch { activity = []; }
  try { crossLinks = await getEntityCrossLinks("RISK", id); } catch { crossLinks = []; }
  try { role = await getCurrentRole(); } catch { role = "VIEWER"; }
  let scoreHistory: any[] = [];
  try { scoreHistory = await getRiskScoreHistory(id); } catch { scoreHistory = []; }
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
      scoreHistory={scoreHistory}
    />
  );
}
