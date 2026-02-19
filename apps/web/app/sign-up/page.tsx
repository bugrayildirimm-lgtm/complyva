import { SignUp } from "@clerk/nextjs";

export default function SignUpPage() {
  return (
    <div className="landing" style={{
      minHeight: "100vh",
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      background: "#050a0e",
    }}>
      <div style={{ textAlign: "center" }}>
        <a href="/" style={{ display: "inline-block", marginBottom: 32 }}>
          <img src="/logo.png" alt="Complyva" style={{ height: 28 }} />
        </a>
        <SignUp afterSignUpUrl="/dashboard" />
      </div>
    </div>
  );
}
