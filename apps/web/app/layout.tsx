import {
  ClerkProvider,
  SignInButton,
  SignUpButton,
  SignedIn,
  SignedOut,
  UserButton,
} from "@clerk/nextjs";
import Sidebar from "./Sidebar";
import "./styles.css";

export const metadata = {
  title: "Complyva",
  description: "B2B Compliance SaaS"
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <ClerkProvider>
      <html lang="en">
        <body>
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
                      <button className="btn btn-secondary" style={{ padding: "6px 12px", fontSize: 12 }}>
                        Sign In
                      </button>
                    </SignInButton>
                    <SignUpButton>
                      <button className="btn btn-primary" style={{ padding: "6px 12px", fontSize: 12 }}>
                        Sign Up
                      </button>
                    </SignUpButton>
                  </SignedOut>
                  <SignedIn>
                    <UserButton />
                  </SignedIn>
                </div>
              </header>

              <div className="page-content">
                {children}
              </div>
            </div>
          </div>
        </body>
      </html>
    </ClerkProvider>
  );
}