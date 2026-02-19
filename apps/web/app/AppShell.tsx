"use client";

import Link from "next/link";
import { SignedIn, SignedOut, UserButton } from "@clerk/nextjs";
import { usePathname } from "next/navigation";
import Sidebar from "./Sidebar";

const APP_ROUTE_PREFIXES = ["/dashboard", "/certifications", "/risks", "/audits", "/activity"];

function isAppRoute(pathname: string | null) {
  if (!pathname) return false;
  return APP_ROUTE_PREFIXES.some((prefix) => pathname === prefix || pathname.startsWith(prefix + "/"));
}

function PublicHeader() {
  const pathname = usePathname();

  function navClass(href: string) {
    const active = pathname === href;
    return `public-nav-link ${active ? "active" : ""}`;
  }

  return (
    <header className="public-header">
      <div className="public-header-inner">
        <Link href="/" className="public-logo-link">
          <img src="/logo.png" alt="Complyva" className="public-logo" />
        </Link>

        <nav className="public-nav">
          <Link href="/" className={navClass("/")}>Home</Link>
          <Link href="/product" className={navClass("/product")}>Product</Link>
          <Link href="/contact" className={navClass("/contact")}>Contact</Link>
        </nav>

        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <SignedOut>
            <Link href="/sign-in" className="btn btn-secondary">Sign In</Link>
            <Link href="/sign-up" className="btn btn-primary">Sign Up</Link>
          </SignedOut>
          <SignedIn>
            <Link href="/dashboard" className="btn btn-secondary">Dashboard</Link>
            <UserButton />
          </SignedIn>
        </div>
      </div>
    </header>
  );
}

export default function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const appRoute = isAppRoute(pathname);

  if (!appRoute) {
    return (
      <div className="public-layout">
        <PublicHeader />
        <main className="public-main">{children}</main>
      </div>
    );
  }

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
              <Link href="/sign-in" className="btn btn-secondary" style={{ padding: "6px 12px", fontSize: 12 }}>
                Sign In
              </Link>
              <Link href="/sign-up" className="btn btn-primary" style={{ padding: "6px 12px", fontSize: 12 }}>
                Sign Up
              </Link>
            </SignedOut>
            <SignedIn>
              <UserButton />
            </SignedIn>
          </div>
        </header>

        <div className="page-content">{children}</div>
      </div>
    </div>
  );
}
