import { getIncident, getAssets, getEvidence, getEntityActivity, updateIncident, deleteIncident, sendIncidentToRisk, sendIncidentToNC, uploadEvidence, deleteEvidence } from "../../../../lib/api";
import type { Incident, Asset } from "../../../../lib/types";
import IncidentDetailClient from "./IncidentDetailClient";

export default async function IncidentDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const incident: Incident = await getIncident(id);
  const assets: Asset[] = await getAssets();
  const evidence = await getEvidence("INCIDENT", id);
  let activity: any[] = [];
  try { activity = await getEntityActivity("INCIDENT", id); } catch { activity = []; }

  return (
    <IncidentDetailClient
      incident={incident}
      assets={assets}
      evidence={evidence}
      activity={activity}
      updateIncident={updateIncident}
      deleteIncident={deleteIncident}
      sendIncidentToRisk={sendIncidentToRisk}
      sendIncidentToNC={sendIncidentToNC}
      uploadEvidence={uploadEvidence}
      deleteEvidence={deleteEvidence}
    />
  );
}
