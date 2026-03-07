import "./landing.css";
import "./styles.css";
import { AuthProvider } from "../lib/auth-context";

export const metadata = {
  title: "Complyva",
  description: "B2B Compliance SaaS",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>
        <AuthProvider>{children}</AuthProvider>
      </body>
    </html>
  );
}
