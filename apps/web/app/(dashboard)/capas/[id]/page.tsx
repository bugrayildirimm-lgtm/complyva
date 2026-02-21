import { getCAPA, getAssets, getEvidence, getEntityActivity, getEntityCrossLinks, updateCAPA, deleteCAPA, uploadEvidence, deleteEvidence } from "../../../../lib/api";
import type { CAPA, Asset } from "../../../../lib/types";
import CAPADetailClient from "./CAPADetailClient";

export default async function CAPADetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const capa: CAPA = await getCAPA(id);
  const assets: Asset[] = await getAssets();
  const evidence = await getEvidence("CAPA", id);
  let activity: any[] = [];
  try { activity = await getEntityActivity("CAPA", id); } catch { activity = []; }
  let crossLinks: any[] = [];
  try { crossLinks = await getEntityCrossLinks("CAPA", id); } catch { crossLinks = []; }

  return (
    <CAPADetailClient
      capa={capa}
      assets={assets}
      evidence={evidence}
      activity={activity}
      crossLinks={crossLinks}
      updateCAPA={updateCAPA}
      deleteCAPA={deleteCAPA}
      uploadEvidence={uploadEvidence}
      deleteEvidence={deleteEvidence}
    />
  );
}
