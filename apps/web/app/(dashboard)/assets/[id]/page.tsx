import { getAsset, getEvidence, getEntityActivity, updateAsset, deleteAsset, uploadEvidence, deleteEvidence, getCurrentRole } from "../../../../lib/api";
import type { Asset } from "../../../../lib/types";
import AssetDetailClient from "./AssetDetailClient";

export default async function AssetDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const asset: Asset = await getAsset(id);
  const evidence = await getEvidence("ASSET", id);
  let activity: any[] = [];
  try { activity = await getEntityActivity("ASSET", id); } catch { activity = []; }

  const role = await getCurrentRole();
  return (
    <AssetDetailClient
      asset={asset}
      evidence={evidence}
      activity={activity}
      updateAsset={updateAsset}
      deleteAsset={deleteAsset}
      uploadEvidence={uploadEvidence}
      deleteEvidence={deleteEvidence}
      role={role}
    />
  );
}
