import { getCAPA, getAssets, getEvidence, getEntityActivity, updateCAPA, deleteCAPA, uploadEvidence, deleteEvidence } from "../../../../lib/api";
import type { CAPA, Asset } from "../../../../lib/types";
import CAPADetailClient from "./CAPADetailClient";

export default async function CAPADetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const capa: CAPA = await getCAPA(id);
  const assets: Asset[] = await getAssets();
  const evidence = await getEvidence("CAPA", id);
  let activity: any[] = [];
  try { activity = await getEntityActivity("CAPA", id); } catch { activity = []; }

  return (
    <CAPADetailClient
      capa={capa}
      assets={assets}
      evidence={evidence}
      activity={activity}
      updateCAPA={updateCAPA}
      deleteCAPA={deleteCAPA}
      uploadEvidence={uploadEvidence}
      deleteEvidence={deleteEvidence}
    />
  );
}
