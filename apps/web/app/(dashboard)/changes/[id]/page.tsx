import { getChange, getAssets, getEvidence, getEntityActivity, updateChange, deleteChange, uploadEvidence, deleteEvidence } from "../../../../lib/api";
import type { Change, Asset } from "../../../../lib/types";
import ChangeDetailClient from "./ChangeDetailClient";

export default async function ChangeDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const change: Change = await getChange(id);
  const assets: Asset[] = await getAssets();
  const evidence = await getEvidence("CHANGE", id);
  let activity: any[] = [];
  try { activity = await getEntityActivity("CHANGE", id); } catch { activity = []; }

  return (
    <ChangeDetailClient
      change={change}
      assets={assets}
      evidence={evidence}
      activity={activity}
      updateChange={updateChange}
      deleteChange={deleteChange}
      uploadEvidence={uploadEvidence}
      deleteEvidence={deleteEvidence}
    />
  );
}
