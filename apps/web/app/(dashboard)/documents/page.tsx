import { getDocuments, getCurrentRole } from "../../../lib/api";
import type { Document } from "../../../lib/types";
import DocumentsClient from "./DocumentsClient";

export default async function DocumentsPage() {
  const rows: Document[] = await getDocuments();
  const role = await getCurrentRole();
  return <DocumentsClient documents={rows} role={role} />;
}
