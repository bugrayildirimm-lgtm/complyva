export default function ContactPage() {
  return (
    <>
      <div className="page-header">
        <div>
          <h1 className="page-title">Contact</h1>
          <p className="page-subtitle">Contact form coming soon.</p>
        </div>
      </div>

      <div className="card" style={{ maxWidth: 720 }}>
        <div style={{ fontSize: 14, fontWeight: 600, marginBottom: 14, color: "#111" }}>Get in touch</div>
        <form className="form-grid">
          <div className="form-group">
            <label className="form-label">Name</label>
            <input className="form-input" placeholder="Your name" disabled />
          </div>
          <div className="form-group">
            <label className="form-label">Email</label>
            <input className="form-input" placeholder="you@company.com" disabled />
          </div>
          <div className="form-group form-full">
            <label className="form-label">Message</label>
            <textarea className="form-textarea" placeholder="Tell us what you need..." disabled />
          </div>
          <div className="form-full">
            <button type="button" className="btn btn-primary" disabled>Coming Soon</button>
          </div>
        </form>
      </div>
    </>
  );
}
