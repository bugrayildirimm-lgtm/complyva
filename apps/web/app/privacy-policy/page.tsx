import Link from "next/link";

export default function PrivacyPolicyPage() {
  return (
    <div className="landing">
      <header className="landing-header">
        <div className="landing-container landing-header-inner">
          <Link href="/" className="landing-logo-link">
            <img src="/logo.png" alt="Complyva" className="landing-logo-img" />
          </Link>
          <div className="landing-auth-buttons">
            <Link href="/sign-in" className="landing-btn-ghost">Sign In</Link>
          </div>
        </div>
      </header>

      <section style={{ paddingTop: 120, paddingBottom: 80 }}>
        <div className="landing-container" style={{ maxWidth: 720 }}>
          <h1 style={{ fontSize: 32, fontWeight: 800, color: "#f1f5f9", marginBottom: 8, letterSpacing: "-0.03em" }}>Privacy Policy</h1>
          <p style={{ fontSize: 13, color: "#5a6a78", marginBottom: 40 }}>Last updated: 1 March 2026</p>

          <div style={{ fontSize: 15, lineHeight: 1.8, color: "#8899a6" }}>
            <h2 style={{ fontSize: 18, fontWeight: 700, color: "#e2e8f0", marginTop: 32, marginBottom: 12 }}>1. Introduction</h2>
            <p>Complyva (&quot;we&quot;, &quot;our&quot;, &quot;us&quot;) is a compliance management platform. This Privacy Policy explains how we collect, use, and protect your personal data when you use our services at complyva.com.</p>

            <h2 style={{ fontSize: 18, fontWeight: 700, color: "#e2e8f0", marginTop: 32, marginBottom: 12 }}>2. Data We Collect</h2>
            <p>We collect the following types of data:</p>
            <p><strong style={{ color: "#e2e8f0" }}>Account information:</strong> Name, email address, and organisation name provided during registration.</p>
            <p><strong style={{ color: "#e2e8f0" }}>Usage data:</strong> Actions performed within the platform (audit trail), login timestamps, and IP addresses for security purposes.</p>
            <p><strong style={{ color: "#e2e8f0" }}>Compliance data:</strong> Data you enter into the platform including certifications, risks, audits, incidents, and uploaded evidence files. This data belongs to your organisation.</p>

            <h2 style={{ fontSize: 18, fontWeight: 700, color: "#e2e8f0", marginTop: 32, marginBottom: 12 }}>3. How We Use Your Data</h2>
            <p>We use your data to:</p>
            <p>Provide and maintain the Complyva platform and its features. Authenticate your identity and secure your account with two-factor authentication. Send transactional emails such as login codes, password resets, and invitation notifications. Monitor platform security and prevent unauthorised access.</p>

            <h2 style={{ fontSize: 18, fontWeight: 700, color: "#e2e8f0", marginTop: 32, marginBottom: 12 }}>4. Data Storage and Security</h2>
            <p>All data is stored on secure infrastructure within the European Union. We use encryption in transit (TLS 1.3), role-based access controls, email-based two-factor authentication, IP rate limiting, and account lockout protections to safeguard your data.</p>

            <h2 style={{ fontSize: 18, fontWeight: 700, color: "#e2e8f0", marginTop: 32, marginBottom: 12 }}>5. Data Sharing</h2>
            <p>We do not sell, rent, or share your personal data with third parties for marketing purposes. We may share data with service providers who assist in operating the platform (e.g. email delivery, hosting), but only to the extent necessary to provide our services.</p>

            <h2 style={{ fontSize: 18, fontWeight: 700, color: "#e2e8f0", marginTop: 32, marginBottom: 12 }}>6. Data Retention</h2>
            <p>We retain your data for as long as your account is active or as needed to provide our services. If you request account deletion, we will remove your personal data and organisation data within 30 days.</p>

            <h2 style={{ fontSize: 18, fontWeight: 700, color: "#e2e8f0", marginTop: 32, marginBottom: 12 }}>7. Your Rights</h2>
            <p>Under GDPR, you have the right to access, correct, delete, or export your personal data. You also have the right to object to or restrict processing. To exercise any of these rights, contact us at sales@complyva.com.</p>

            <h2 style={{ fontSize: 18, fontWeight: 700, color: "#e2e8f0", marginTop: 32, marginBottom: 12 }}>8. Cookies</h2>
            <p>We use essential cookies only for authentication (session tokens). We do not use tracking cookies, analytics cookies, or advertising cookies.</p>

            <h2 style={{ fontSize: 18, fontWeight: 700, color: "#e2e8f0", marginTop: 32, marginBottom: 12 }}>9. Changes to This Policy</h2>
            <p>We may update this Privacy Policy from time to time. We will notify users of any material changes via email or a notice on the platform.</p>

            <h2 style={{ fontSize: 18, fontWeight: 700, color: "#e2e8f0", marginTop: 32, marginBottom: 12 }}>10. Contact</h2>
            <p>For any questions about this Privacy Policy or your data, contact us at <a href="mailto:sales@complyva.com" style={{ color: "#22d3ee" }}>sales@complyva.com</a>.</p>
          </div>
        </div>
      </section>

      <footer className="landing-footer">
        <div className="landing-container">
          <div className="landing-footer-bottom">
            © 2026 Complyva. All rights reserved.
          </div>
        </div>
      </footer>
    </div>
  );
}
