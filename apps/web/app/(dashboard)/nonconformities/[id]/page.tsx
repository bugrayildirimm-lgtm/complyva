import { getNonConformity, getAssets, getEvidence, getEntityActivity, getEntityCrossLinks, updateNonConformity, deleteNonConformity, sendNCToCAPA, uploadEvidence, deleteEvidence } from "../../../../lib/api";
import type { NonConformity, Asset } from "../../../../lib/types";
import NCDetailClient from "./NCDetailClient";

export default async function NCDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const nc: NonConformity = await getNonConformity(id);
  const assets: Asset[] = await getAssets();
  const evidence = await getEvidence("NC", id);
  let activity: any[] = [];
  try { activity = await getEntityActivity("NC", id); } catch { activity = []; }
  let crossLinks: any[] = [];
  try { crossLinks = await getEntityCrossLinks("NC", id); } catch { crossLinks = []; }

  return (
    <NCDetailClient
      nc={nc}
      assets={assets}
      evidence={evidence}
      activity={activity}
      crossLinks={crossLinks}
      updateNC={updateNonConformity}
      deleteNC={deleteNonConformity}
      sendNCToCAPA={sendNCToCAPA}
      uploadEvidence={uploadEvidence}
      deleteEvidence={deleteEvidence}
    />
  );
}
