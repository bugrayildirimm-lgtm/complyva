import { getChanges, getAssets } from "../../../lib/api";
import type { Change } from "../../../lib/types";
import ApprovalsClient from "./ApprovalsClient";

export default async function ApprovalsPage() {
  const allChanges: Change[] = await getChanges();

  const pending = allChanges.filter((c) => ["DRAFT", "SUBMITTED"].includes(c.status));
  const recentlyReviewed = allChanges
    .filter((c) => ["APPROVED", "REJECTED"].includes(c.status))
    .slice(0, 10);

  return (
    <ApprovalsClient
      pending={pending}
      recentlyReviewed={recentlyReviewed}
      totalChanges={allChanges.length}
    />
  );
}
