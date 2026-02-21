import { getCertification, getEvidence, getEntityActivity, updateCertification, deleteCertification, uploadEvidence, deleteEvidence, getCurrentRole } from "../../../../lib/api";
import type { Certification } from "../../../../lib/types";
import CertDetailClient from "./CertDetailClient";

export default async function CertDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const cert: Certification = await getCertification(id);
  const evidence = await getEvidence("CERTIFICATION", id);
  let activity: any[] = [];
  try { activity = await getEntityActivity("CERTIFICATION", id); } catch { activity = []; }

  const role = await getCurrentRole();
  return (
    <CertDetailClient
      cert={cert}
      evidence={evidence}
      activity={activity}
      updateCertification={updateCertification}
      deleteCertification={deleteCertification}
      uploadEvidence={uploadEvidence}
      deleteEvidence={deleteEvidence}
      role={role}
    />
  );
}
