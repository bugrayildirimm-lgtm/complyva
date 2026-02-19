import Link from "next/link";

export default function LandingPage() {
  return (
    <div className="landing">
      {/* ===== HEADER ===== */}
      <header className="landing-header">
        <div className="landing-container landing-header-inner">
          <Link href="/" className="landing-logo-link">
            <img src="/logo.png" alt="Complyva" className="landing-logo-img" />
          </Link>
          <nav className="landing-nav">
            <a href="#features" className="landing-nav-link">Features</a>
            <a href="#how" className="landing-nav-link">How It Works</a>
            <a href="#pricing" className="landing-nav-link">Pricing</a>
          </nav>
          <div className="landing-auth-buttons">
            <Link href="/sign-in" className="landing-btn-ghost">Sign In</Link>
            <Link href="/sign-up" className="landing-btn-primary">Start Free</Link>
          </div>
        </div>
      </header>

      {/* ===== HERO ===== */}
      <section className="landing-hero">
        <div className="landing-hero-glow" />
        <div className="landing-container landing-hero-inner">
          <div className="landing-hero-badge">Trusted by compliance teams across Europe</div>
          <h1 className="landing-hero-title">
            Compliance operations,<br />
            <span className="landing-hero-gradient">simplified.</span>
          </h1>
          <p className="landing-hero-sub">
            Track certifications, manage risks, run audits, and store evidence — all in one secure workspace built for regulated industries.
          </p>
          <div className="landing-hero-cta">
            <Link href="/sign-up" className="landing-btn-primary landing-btn-lg">Get Started Free</Link>
            <Link href="/sign-in" className="landing-btn-outline landing-btn-lg">Sign In</Link>
          </div>
          <div className="landing-hero-stats">
            <div className="landing-stat">
              <span className="landing-stat-num">5</span>
              <span className="landing-stat-label">Core Modules</span>
            </div>
            <div className="landing-stat-divider" />
            <div className="landing-stat">
              <span className="landing-stat-num">100%</span>
              <span className="landing-stat-label">Audit-Ready</span>
            </div>
            <div className="landing-stat-divider" />
            <div className="landing-stat">
              <span className="landing-stat-num">24h</span>
              <span className="landing-stat-label">Email Alerts</span>
            </div>
          </div>
        </div>
      </section>

      {/* ===== FEATURES ===== */}
      <section id="features" className="landing-features">
        <div className="landing-container">
          <div className="landing-section-label">Features</div>
          <h2 className="landing-section-title">Everything you need for compliance</h2>
          <p className="landing-section-sub">From certification tracking to audit evidence — one platform, zero spreadsheets.</p>

          <div className="landing-features-grid">
            <div className="landing-feature-card">
              <div className="landing-feature-icon">
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg>
              </div>
              <h3 className="landing-feature-title">Certification Tracker</h3>
              <p className="landing-feature-desc">Monitor ISO, SOC2, PCI-DSS and other certifications. Get alerted 60 days before expiry so renewals never slip.</p>
            </div>

            <div className="landing-feature-card">
              <div className="landing-feature-icon">
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>
              </div>
              <h3 className="landing-feature-title">Risk Register</h3>
              <p className="landing-feature-desc">Score risks with likelihood × impact matrices. Track treatment plans and due dates with automatic status updates.</p>
            </div>

            <div className="landing-feature-card">
              <div className="landing-feature-icon">
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M16 4h2a2 2 0 012 2v14a2 2 0 01-2 2H6a2 2 0 01-2-2V6a2 2 0 012-2h2"/><rect x="8" y="2" width="8" height="4" rx="1" ry="1"/></svg>
              </div>
              <h3 className="landing-feature-title">Audit Management</h3>
              <p className="landing-feature-desc">Plan internal and external audits. Track findings by severity, assign remediation owners, and monitor resolution progress.</p>
            </div>

            <div className="landing-feature-card">
              <div className="landing-feature-icon">
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z"/><polyline points="14 2 14 8 20 8"/></svg>
              </div>
              <h3 className="landing-feature-title">Evidence Vault</h3>
              <p className="landing-feature-desc">Upload and attach evidence files directly to certifications, risks, audits, and findings. Always audit-ready.</p>
            </div>

            <div className="landing-feature-card">
              <div className="landing-feature-icon">
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><polyline points="22 12 18 12 15 21 9 3 6 12 2 12"/></svg>
              </div>
              <h3 className="landing-feature-title">Activity Audit Trail</h3>
              <p className="landing-feature-desc">Every action logged with user attribution and timestamps. Full transparency for regulators and internal governance.</p>
            </div>

            <div className="landing-feature-card">
              <div className="landing-feature-icon">
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"/><polyline points="22,6 12,13 2,6"/></svg>
              </div>
              <h3 className="landing-feature-title">Smart Email Alerts</h3>
              <p className="landing-feature-desc">Automated reminders for expiring certs, approaching due dates, upcoming audits, and weekly compliance digests.</p>
            </div>
          </div>
        </div>
      </section>

      {/* ===== HOW IT WORKS ===== */}
      <section id="how" className="landing-how">
        <div className="landing-container">
          <div className="landing-section-label">How It Works</div>
          <h2 className="landing-section-title">Up and running in minutes</h2>
          <div className="landing-steps">
            <div className="landing-step">
              <div className="landing-step-num">1</div>
              <h3 className="landing-step-title">Create your workspace</h3>
              <p className="landing-step-desc">Sign up and your secure organisation workspace is created instantly. Invite team members with role-based access.</p>
            </div>
            <div className="landing-step-arrow">→</div>
            <div className="landing-step">
              <div className="landing-step-num">2</div>
              <h3 className="landing-step-title">Add your compliance data</h3>
              <p className="landing-step-desc">Log certifications, register risks, schedule audits, and upload existing evidence. Everything in one place.</p>
            </div>
            <div className="landing-step-arrow">→</div>
            <div className="landing-step">
              <div className="landing-step-num">3</div>
              <h3 className="landing-step-title">Stay compliant, automatically</h3>
              <p className="landing-step-desc">Get email alerts for expiring certs and due dates. Monitor your compliance posture from a real-time dashboard.</p>
            </div>
          </div>
        </div>
      </section>

      {/* ===== CTA ===== */}
      <section className="landing-cta">
        <div className="landing-container landing-cta-inner">
          <div className="landing-cta-glow" />
          <h2 className="landing-cta-title">Ready to simplify compliance?</h2>
          <p className="landing-cta-sub">Join teams using Complyva to manage their compliance operations with confidence.</p>
          <Link href="/sign-up" className="landing-btn-primary landing-btn-lg">Start Free Today</Link>
        </div>
      </section>

      {/* ===== FOOTER ===== */}
      <footer className="landing-footer">
        <div className="landing-container landing-footer-inner">
          <div className="landing-footer-brand">
            <img src="/logo.png" alt="Complyva" style={{ height: 24, width: "auto" }} />
            <p className="landing-footer-tagline">Compliance operations platform for regulated industries.</p>
          </div>
          <div className="landing-footer-links">
            <div className="landing-footer-col">
              <h4 className="landing-footer-heading">Product</h4>
              <a href="#features">Features</a>
              <a href="#how">How It Works</a>
              <a href="#pricing">Pricing</a>
            </div>
            <div className="landing-footer-col">
              <h4 className="landing-footer-heading">Legal</h4>
              <a href="#">Privacy Policy</a>
              <a href="#">Terms of Service</a>
            </div>
            <div className="landing-footer-col">
              <h4 className="landing-footer-heading">Contact</h4>
              <a href="mailto:hello@complyva.com">hello@complyva.com</a>
            </div>
          </div>
        </div>
        <div className="landing-container">
          <div className="landing-footer-bottom">
            © 2026 Complyva. All rights reserved.
          </div>
        </div>
      </footer>
    </div>
  );
}
