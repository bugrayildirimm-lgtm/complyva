import Sidebar from "../Sidebar";
import { ToastProvider } from "./Toast";
import UserMenu from "./UserMenu";
import SearchBar from "./SearchBar";

export const dynamic = "force-dynamic";

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="app-layout">
      <Sidebar />
      <div className="main-content">
        <header className="topbar">
          <SearchBar />
          <UserMenu />
        </header>
        <div className="page-content">
          <ToastProvider>{children}</ToastProvider>
        </div>
      </div>
    </div>
  );
}
