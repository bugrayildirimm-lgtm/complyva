import { getAccount, getMembers, getCurrentRole, updateAccount, updateMemberRole, removeMember, inviteMember, changePassword, uploadOrgLogo, getSessions, revokeSession, revokeAllSessions } from "../../../lib/api";
import AccountClient from "./AccountClient";

export default async function AccountPage() {
  const account = await getAccount();
  const members = await getMembers();
  const currentRole = await getCurrentRole();
  const sessions = await getSessions().catch(() => []);

  return (
    <AccountClient
      account={account}
      members={members}
      currentRole={currentRole}
      updateAccount={updateAccount}
      updateMemberRole={updateMemberRole}
      removeMember={removeMember}
      inviteMember={inviteMember}
      changePassword={changePassword}
      uploadOrgLogo={uploadOrgLogo}
      sessions={sessions}
      revokeSession={revokeSession}
      revokeAllSessions={revokeAllSessions}
    />
  );
}
