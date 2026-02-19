import Link from "next/link";

export default function Home() {
  return (
    <>
      <section className="marketing-hero card">
        <div className="marketing-kicker">Compliance Operations Platform</div>
        <h1 className="marketing-title">Complyva</h1>
        <p className="marketing-subtitle">
          Simplify certifications, risk tracking, audits, and evidence management in one secure workspace.
        </p>
        <div className="marketing-actions">
          <Link href="/product" className="btn btn-primary">Explore Product</Link>
          <a href="/sign-up" className="btn btn-secondary">Start Free</a>
        </div>
      </section>

      <section className="grid-3">
        <div className="card">
          <h3 className="feature-title">Track Certifications</h3>
          <p className="feature-copy">Stay ahead of expiry deadlines and maintain complete certification visibility.</p>
        </div>
        <div className="card">
          <h3 className="feature-title">Manage Risks</h3>
          <p className="feature-copy">Prioritize open risks using clear scoring and treatment timelines.</p>
        </div>
        <div className="card">
          <h3 className="feature-title">Audit-Ready Evidence</h3>
          <p className="feature-copy">Attach and retrieve evidence quickly for audits and findings.</p>
        </div>
      </section>
    </>
  );
}
