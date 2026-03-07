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
            <a href="#modules" className="landing-nav-link">Modules</a>
            <a href="#pricing" className="landing-nav-link">Pricing</a>
            <a href="#security" className="landing-nav-link">Security</a>
            <a href="#about" className="landing-nav-link">About</a>
          </nav>
          <div className="landing-auth-buttons">
            <Link href="/sign-in" className="landing-btn-ghost">Sign In</Link>
            <a href="mailto:sales@complyva.com?subject=Demo%20Request" className="landing-btn-primary">Request a Demo</a>
          </div>
        </div>
      </header>

      {/* ===== HERO ===== */}
      <section className="landing-hero">
        <div className="landing-hero-glow" />
        <div className="landing-container landing-hero-inner">
          <div className="landing-hero-badge">Built for B2B regulated industries</div>
          <h1 className="landing-hero-title">
            Compliance management<br />
            <span className="landing-hero-gradient">your auditors will love.</span>
          </h1>
          <p className="landing-hero-sub">
            Track certifications, manage risks, run audits, handle incidents, and store evidence - all in one secure platform built for iGaming, fintech, and regulated industries.
          </p>
          <div className="landing-hero-cta">
            <a href="mailto:sales@complyva.com?subject=Demo%20Request" className="landing-btn-primary landing-btn-lg">Request a Demo</a>
            <a href="#features" className="landing-btn-outline landing-btn-lg">See Features</a>
          </div>
          <div className="landing-hero-stats">
            <div className="landing-stat">
              <span className="landing-stat-num">10+</span>
              <span className="landing-stat-label">Compliance Modules</span>
            </div>
            <div className="landing-stat-divider" />
            <div className="landing-stat">
              <span className="landing-stat-num">100%</span>
              <span className="landing-stat-label">Audit-Ready</span>
            </div>
            <div className="landing-stat-divider" />
            <div className="landing-stat">
              <span className="landing-stat-num">2FA</span>
              <span className="landing-stat-label">Secure Access</span>
            </div>
            <div className="landing-stat-divider" />
            <div className="landing-stat">
              <span className="landing-stat-num">RBAC</span>
              <span className="landing-stat-label">Role-Based</span>
            </div>
          </div>
        </div>
      </section>

      {/* ===== TRUST BAR ===== */}
      <section className="landing-trust">
        <div className="landing-container">
          <div className="landing-trust-inner">
            <div className="landing-trust-logos">
              {[
                { name: "ISO 27001", full: "Information Security" },
                { name: "GDPR", full: "Data Protection" },
                { name: "Multi-Jurisdiction", full: "Gaming Regulators" },
                { name: "SOC 2", full: "Service Controls" },
                { name: "PCI DSS", full: "Payment Security" },
              ].map((fw) => (
                <div key={fw.name} className="landing-trust-item">
                  <span className="landing-trust-name">{fw.name}</span>
                  <span className="landing-trust-full">{fw.full}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* ===== FEATURES ===== */}
      <section id="features" className="landing-features">
        <div className="landing-container">
          <div className="landing-section-label">Why Complyva</div>
          <h2 className="landing-section-title">Replace your spreadsheets with a single source of truth</h2>
          <p className="landing-section-sub">Stop managing compliance across scattered documents. Complyva gives your entire team real-time visibility into your compliance posture.</p>

          <div className="landing-features-grid">
            <div className="landing-feature-card">
              <div className="landing-feature-icon">
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="3" width="7" height="7" rx="1" /><rect x="14" y="3" width="7" height="7" rx="1" /><rect x="3" y="14" width="7" height="7" rx="1" /><rect x="14" y="14" width="7" height="7" rx="1" /></svg>
              </div>
              <h3 className="landing-feature-title">Real-Time Dashboard</h3>
              <p className="landing-feature-desc">See open risks, pending audits, expiring certifications, and overdue items at a glance. Always know where you stand.</p>
            </div>

            <div className="landing-feature-card">
              <div className="landing-feature-icon">
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M20 21v-2a4 4 0 00-4-4H8a4 4 0 00-4 4v2" /><circle cx="12" cy="7" r="4" /></svg>
              </div>
              <h3 className="landing-feature-title">Role-Based Access</h3>
              <p className="landing-feature-desc">Admins, Auditors, and Viewers - each with the right permissions. Control who can edit, export, and manage your compliance data.</p>
            </div>

            <div className="landing-feature-card">
              <div className="landing-feature-icon">
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z" /><polyline points="14 2 14 8 20 8" /></svg>
              </div>
              <h3 className="landing-feature-title">Evidence Vault</h3>
              <p className="landing-feature-desc">Upload and attach evidence files directly to any register item. When auditors ask for proof, it&apos;s one click away.</p>
            </div>

            <div className="landing-feature-card">
              <div className="landing-feature-icon">
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><polyline points="22 12 18 12 15 21 9 3 6 12 2 12" /></svg>
              </div>
              <h3 className="landing-feature-title">Full Audit Trail</h3>
              <p className="landing-feature-desc">Every action logged with who did it and when. Complete transparency for regulators, internal governance, and ISO audits.</p>
            </div>

            <div className="landing-feature-card">
              <div className="landing-feature-icon">
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M12 2v4m0 12v4M4.93 4.93l2.83 2.83m8.48 8.48l2.83 2.83M2 12h4m12 0h4M4.93 19.07l2.83-2.83m8.48-8.48l2.83-2.83" /></svg>
              </div>
              <h3 className="landing-feature-title">Cross-Linking</h3>
              <p className="landing-feature-desc">Link risks to audits, findings to CAPAs, incidents to changes. See the full chain of compliance actions across registers.</p>
            </div>

            <div className="landing-feature-card">
              <div className="landing-feature-icon">
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4" /><polyline points="7 10 12 15 17 10" /><line x1="12" y1="15" x2="12" y2="3" /></svg>
              </div>
              <h3 className="landing-feature-title">Export Anywhere</h3>
              <p className="landing-feature-desc">Generate professional Excel reports and PDF compliance summaries. Ready for board meetings, auditors, or regulators.</p>
            </div>
          </div>
        </div>
      </section>

      {/* ===== MODULES ===== */}
      <section id="modules" className="landing-modules">
        <div className="landing-container">
          <div className="landing-section-label">Modules</div>
          <h2 className="landing-section-title">Everything you need. Nothing you don&apos;t.</h2>
          <p className="landing-section-sub">Each module is purpose-built for compliance professionals. No bloat, no learning curve.</p>
          
          <div className="landing-modules-grid">
            {[
              { name: "Certifications", desc: "Track ISO, SOC2, MGA, and other certifications with expiry alerts", icon: <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg> },
              { name: "Risk Register", desc: "Likelihood × impact scoring with treatment plans and residual risk", icon: <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><path d="M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg> },
              { name: "Audit Management", desc: "Plan audits, track findings by severity, assign remediation owners", icon: <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><path d="M16 4h2a2 2 0 012 2v14a2 2 0 01-2 2H6a2 2 0 01-2-2V6a2 2 0 012-2h2"/><rect x="8" y="2" width="8" height="4" rx="1"/></svg> },
              { name: "Asset Register", desc: "Hardware, software, and data assets with classification levels", icon: <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><rect x="2" y="7" width="20" height="14" rx="2"/><path d="M16 7V5a2 2 0 00-2-2h-4a2 2 0 00-2 2v2"/></svg> },
              { name: "Incident Management", desc: "Log, categorise, and track security and compliance incidents", icon: <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg> },
              { name: "Change Management", desc: "RFC tracking with risk assessment and approval workflows", icon: <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><path d="M12 2v4m0 12v4M4.93 4.93l2.83 2.83m8.48 8.48l2.83 2.83M2 12h4m12 0h4M4.93 19.07l2.83-2.83m8.48-8.48l2.83-2.83"/></svg> },
              { name: "Non-Conformities", desc: "Track NCs with root cause analysis and corrective actions", icon: <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><circle cx="12" cy="12" r="10"/><line x1="15" y1="9" x2="9" y2="15"/><line x1="9" y1="9" x2="15" y2="15"/></svg> },
              { name: "CAPAs", desc: "Corrective and preventive actions linked to findings and NCs", icon: <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="12" y1="18" x2="12" y2="12"/><line x1="9" y1="15" x2="15" y2="15"/></svg> },
              { name: "Evidence Vault", desc: "File uploads attached to any register item, always audit-ready", icon: <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><path d="M21.44 11.05l-9.19 9.19a6 6 0 01-8.49-8.49l9.19-9.19a4 4 0 015.66 5.66l-9.2 9.19a2 2 0 01-2.83-2.83l8.49-8.48"/></svg> },
              { name: "Dashboard & Reports", desc: "Real-time compliance posture with Excel and PDF exports", icon: <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><path d="M18 20V10"/><path d="M12 20V4"/><path d="M6 20v-6"/></svg> },
            ].map((mod) => (
              <div key={mod.name} className="landing-module-item">
                <span className="landing-module-icon">{mod.icon}</span>
                <div>
                  <div className="landing-module-name">{mod.name}</div>
                  <div className="landing-module-desc">{mod.desc}</div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ===== PRICING ===== */}
      <section id="pricing" className="landing-pricing">
        <div className="landing-container">
          <div className="landing-section-label">Pricing</div>
          <h2 className="landing-section-title">Simple, transparent pricing</h2>
          <p className="landing-section-sub">No hidden fees. No per-module charges. Full access on every plan.</p>

          <div className="landing-pricing-grid">
            <div className="landing-price-card">
              <div className="landing-price-tier">Trial</div>
              <div className="landing-price-amount">Free</div>
              <div className="landing-price-period">1 month, full access</div>
              <div className="landing-price-seats">Up to 5 users</div>
              <ul className="landing-price-features">
                <li>All 10+ modules included</li>
                <li>Excel &amp; PDF exports</li>
                <li>Email 2FA security</li>
                <li>Evidence file uploads</li>
                <li>Full audit trail</li>
              </ul>
              <a href="mailto:sales@complyva.com?subject=Start%20Free%20Trial" className="landing-price-btn">Start Free Trial</a>
            </div>

            <div className="landing-price-card landing-price-featured">
              <div className="landing-price-badge">Most Popular</div>
              <div className="landing-price-tier">Pro</div>
              <div className="landing-price-amount">€99<span className="landing-price-mo">/month</span></div>
              <div className="landing-price-period">or €990/year (save 17%)</div>
              <div className="landing-price-seats">5 users included, then €19/user</div>
              <ul className="landing-price-features">
                <li>Everything in Trial</li>
                <li>Priority email support</li>
                <li>Custom organisation branding</li>
                <li>Data export controls</li>
                <li>Unlimited registers</li>
              </ul>
              <a href="mailto:sales@complyva.com?subject=Upgrade%20to%20Pro" className="landing-price-btn landing-price-btn-primary">Get Started</a>
            </div>

            <div className="landing-price-card">
              <div className="landing-price-tier">Enterprise</div>
              <div className="landing-price-amount">Custom</div>
              <div className="landing-price-period">Tailored to your needs</div>
              <div className="landing-price-seats">Unlimited users</div>
              <ul className="landing-price-features">
                <li>Everything in Pro</li>
                <li>Dedicated account manager</li>
                <li>SLA guarantee</li>
                <li>Custom integrations</li>
                <li>On-boarding &amp; training</li>
              </ul>
              <a href="mailto:sales@complyva.com?subject=Enterprise%20Inquiry" className="landing-price-btn">Contact Sales</a>
            </div>
          </div>
        </div>
      </section>

      {/* ===== SECURITY ===== */}
      <section id="security" className="landing-security">
        <div className="landing-container">
          <div className="landing-section-label">Security</div>
          <h2 className="landing-section-title">Enterprise-grade security, built in</h2>
          <div className="landing-security-grid">
            {[
              { title: "Email-Based 2FA", desc: "Every login verified with a one-time code. Trusted devices remembered for 30 days.", icon: <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><rect x="3" y="11" width="18" height="11" rx="2"/><path d="M7 11V7a5 5 0 0110 0v4"/></svg> },
              { title: "Role-Based Access", desc: "Admin, Auditor, and Viewer roles with granular permission control per organisation.", icon: <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><path d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 00-3-3.87"/><path d="M16 3.13a4 4 0 010 7.75"/></svg> },
              { title: "Encrypted in Transit", desc: "All data encrypted with TLS 1.3 and hosted on AWS EU infrastructure.", icon: <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg> },
              { title: "Full Audit Trail", desc: "Every action logged with user, timestamp, and details. Tamper-proof activity history.", icon: <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><polyline points="22 12 18 12 15 21 9 3 6 12 2 12"/></svg> },
              { title: "Account Protection", desc: "Automatic lockout after 5 failed attempts. IP-based rate limiting on all endpoints.", icon: <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><circle cx="12" cy="12" r="10"/><line x1="4.93" y1="4.93" x2="19.07" y2="19.07"/></svg> },
              { title: "Multi-Tenancy", desc: "Complete data isolation between organisations. No cross-tenant data access possible.", icon: <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><path d="M3 9l9-7 9 7v11a2 2 0 01-2 2H5a2 2 0 01-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/></svg> },
            ].map((item) => (
              <div key={item.title} className="landing-security-item">
                <span className="landing-security-icon">{item.icon}</span>
                <h3 className="landing-security-title">{item.title}</h3>
                <p className="landing-security-desc">{item.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ===== ABOUT ===== */}
      <section id="about" className="landing-security">
        <div className="landing-container">
          <div className="landing-section-label">About</div>
          <h2 style={{ fontSize: 36, fontWeight: 700, color: "#fff", textAlign: "center", marginBottom: 16, lineHeight: 1.3 }}>Built by a compliance professional,<br />for compliance professionals</h2>
          <div style={{ maxWidth: 720, margin: "0 auto", textAlign: "center" }}>
            <p style={{ fontSize: 16, color: "#4b5563", lineHeight: 1.8, marginBottom: 24 }}>
              Complyva was created by <strong>Bugra Yildirim</strong>, a Technical Compliance Officer with hands-on experience across iGaming, live casino, and regulated fintech environments. With a background in IT auditing, technical compliance, and multi-jurisdictional licensing across MGA, ISO 27001, and GDPR frameworks, Bugra built Complyva to solve the compliance challenges he faced daily.
            </p>
            <p style={{ fontSize: 16, color: "#4b5563", lineHeight: 1.8, marginBottom: 32 }}>
              No more scattered spreadsheets, missing evidence files, or last-minute audit scrambles. Complyva is the tool that should have existed, purpose-built by someone who has sat on both sides of the audit table.
            </p>
            <a href="https://www.linkedin.com/in/bugra-yildirim-a60302143/" target="_blank" rel="noopener noreferrer" style={{ display: "inline-flex", alignItems: "center", gap: 8, padding: "10px 20px", borderRadius: 8, fontSize: 14, fontWeight: 600, background: "#0a66c2", color: "#fff", textDecoration: "none" }}>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor"><path d="M16 8a6 6 0 016 6v7h-4v-7a2 2 0 00-2-2 2 2 0 00-2 2v7h-4v-7a6 6 0 016-6zM2 9h4v12H2z"/><circle cx="4" cy="4" r="2"/></svg>
              Connect on LinkedIn
            </a>
          </div>
          {/* Product Video */}
          <div style={{ maxWidth: 800, margin: "48px auto 0", borderRadius: 16, overflow: "hidden", boxShadow: "0 25px 60px rgba(0,0,0,0.4)", border: "1px solid rgba(255,255,255,0.08)" }}>
            <div style={{ position: "relative", paddingBottom: "56.25%", height: 0 }}>
              <iframe
                src="https://www.youtube.com/embed/90_1EwTBlRw"
                title="Complyva Product Demo"
                allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                allowFullScreen
                style={{ position: "absolute", top: 0, left: 0, width: "100%", height: "100%", border: "none" }}
              />
            </div>
          </div>
        </div>
      </section>

      {/* ===== CTA ===== */}
      <section className="landing-cta">
        <div className="landing-container landing-cta-inner">
          <div className="landing-cta-glow" />
          <h2 className="landing-cta-title">Ready to simplify your compliance?</h2>
          <p className="landing-cta-sub">Join compliance teams using Complyva to stay audit-ready, every day.</p>
          <div style={{ display: "flex", alignItems: "center", gap: 16, justifyContent: "center", flexWrap: "wrap" }}>
            <a href="mailto:sales@complyva.com?subject=Get%20Started%20with%20Complyva" className="landing-btn-primary landing-btn-lg">Contact Sales</a>
            <a href="tel:+35699941578" className="landing-btn-outline landing-btn-lg" style={{ display: "inline-flex", alignItems: "center", gap: 8 }}>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M22 16.92v3a2 2 0 01-2.18 2 19.79 19.79 0 01-8.63-3.07A19.5 19.5 0 013.07 9.81a19.79 19.79 0 01-3.07-8.67A2 2 0 012 2h3a2 2 0 012 1.72c.127.96.361 1.903.7 2.81a2 2 0 01-.45 2.11L6.91 7.91a16 16 0 006.72 6.72l1.27-.34a2 2 0 012.11.45c.907.339 1.85.573 2.81.7A2 2 0 0122 16.92z"/></svg>
              Call Us
            </a>
          </div>
        </div>
      </section>

      {/* ===== FOOTER ===== */}
      <footer className="landing-footer">
        <div className="landing-container landing-footer-inner">
          <div className="landing-footer-brand">
            <img src="/logo.png" alt="Complyva" style={{ height: 24, width: "auto" }} />
            <p className="landing-footer-tagline">Compliance management platform for regulated industries. Built in the EU.</p>
          </div>
          <div className="landing-footer-links">
            <div className="landing-footer-col">
              <h4 className="landing-footer-heading">Product</h4>
              <a href="#features">Features</a>
              <a href="#modules">Modules</a>
              <a href="#pricing">Pricing</a>
              <a href="#security">Security</a>
            </div>
            <div className="landing-footer-col">
              <h4 className="landing-footer-heading">Legal</h4>
              <a href="/privacy-policy">Privacy Policy</a>
              <a href="#">Terms of Service</a>
            </div>
            <div className="landing-footer-col">
              <h4 className="landing-footer-heading">Contact</h4>
              <a href="mailto:sales@complyva.com">sales@complyva.com</a>
              <a href="tel:+35699941578">Call Us</a>
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
