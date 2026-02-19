import { ClerkProvider } from "@clerk/nextjs";
import AppShell from "./AppShell";
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
          <AppShell>{children}</AppShell>
        </body>
      </html>
    </ClerkProvider>
  );
}
