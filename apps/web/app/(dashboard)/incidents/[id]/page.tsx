import { getIncident, getAssets, getEvidence, getEntityActivity, getEntityCrossLinks, updateIncident, deleteIncident, sendIncidentToRisk, sendIncidentToNC, uploadEvidence, deleteEvidence, getCurrentRole } from "../../../../lib/api";
import type { Incident, Asset } from "../../../../lib/types";
import IncidentDetailClient from "./IncidentDetailClient";

export default async function IncidentDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const incident: Incident = await getIncident(id);
  const assets: Asset[] = await getAssets();
  const evidence = await getEvidence("INCIDENT", id);
  let activity: any[] = [];
  try { activity = await getEntityActivity("INCIDENT", id); } catch { activity = []; }
  let crossLinks: any[] = [];
  try { crossLinks = await getEntityCrossLinks("INCIDENT", id); } catch { crossLinks = []; }

  const role = await getCurrentRole();
  return (
    <IncidentDetailClient
      incident={incident}
      assets={assets}
      evidence={evidence}
      activity={activity}
      crossLinks={crossLinks}
      updateIncident={updateIncident}
      deleteIncident={deleteIncident}
      sendIncidentToRisk={sendIncidentToRisk}
      sendIncidentToNC={sendIncidentToNC}
      uploadEvidence={uploadEvidence}
      deleteEvidence={deleteEvidence}
      role={role}
    />
  );
}
