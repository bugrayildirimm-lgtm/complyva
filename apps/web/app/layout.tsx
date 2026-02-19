import "./landing.css";
import "./styles.css";
import { ClerkProvider } from "@clerk/nextjs";

export const metadata = {
  title: "Complyva",
  description: "B2B Compliance SaaS",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <ClerkProvider>
      <html lang="en">
        <body>{children}</body>
      </html>
    </ClerkProvider>
  );
}