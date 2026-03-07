import { getDocument, getDocumentVersions, getEntityActivity, updateDocument, deleteDocument, getCurrentRole } from "../../../../lib/api";
import type { Document, DocumentVersion } from "../../../../lib/types";
import DocumentDetailClient from "./DocumentDetailClient";

export default async function DocumentDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const doc: Document = await getDocument(id);
  const versions: DocumentVersion[] = await getDocumentVersions(id);
  let activity: any[] = [];
  try { activity = await getEntityActivity("DOCUMENT", id); } catch { activity = []; }
  const role = await getCurrentRole();
  return (
    <DocumentDetailClient
      doc={doc}
      versions={versions}
      activity={activity}
      updateDocument={updateDocument}
      deleteDocument={deleteDocument}
      role={role}
    />
  );
}
