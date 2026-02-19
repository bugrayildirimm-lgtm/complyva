import { SignIn } from "@clerk/nextjs";

export default function SignInPage() {
  return (
    <div style={{
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
        <SignIn
          path="/sign-in"
          routing="path"
          signUpUrl="/sign-up"
          afterSignInUrl="/dashboard"
        />
      </div>
    </div>
  );
}