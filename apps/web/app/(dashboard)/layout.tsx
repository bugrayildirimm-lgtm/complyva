import { SignedIn, SignedOut, SignInButton, SignUpButton, UserButton } from "@clerk/nextjs";
import Sidebar from "../Sidebar";
import { ToastProvider } from "./Toast";

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="app-layout">
      <Sidebar />
      <div className="main-content">
        <header className="topbar">
          <div className="topbar-breadcrumb">
            <span>Complyva</span>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
            <SignedOut>
              <SignInButton>
                <button className="btn btn-secondary" style={{ padding: "6px 12px", fontSize: 12 }}>Sign In</button>
              </SignInButton>
              <SignUpButton>
                <button className="btn btn-primary" style={{ padding: "6px 12px", fontSize: 12 }}>Sign Up</button>
              </SignUpButton>
            </SignedOut>
            <SignedIn>
              <UserButton />
            </SignedIn>
          </div>
        </header>
        <div className="page-content"><ToastProvider>{children}</ToastProvider></div>
      </div>
    </div>
  );
}
