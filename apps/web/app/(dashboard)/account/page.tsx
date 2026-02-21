import { getAccount, getMembers, getCurrentRole, updateAccount, updateMemberRole, removeMember, inviteMember } from "../../../lib/api";
import AccountClient from "./AccountClient";

export default async function AccountPage() {
  const account = await getAccount();
  const members = await getMembers();
  const currentRole = await getCurrentRole();

  return (
    <AccountClient
      account={account}
      members={members}
      currentRole={currentRole}
      updateAccount={updateAccount}
      updateMemberRole={updateMemberRole}
      removeMember={removeMember}
      inviteMember={inviteMember}
    />
  );
}
