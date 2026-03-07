import { NextResponse, type NextRequest } from "next/server";

const protectedPaths = [
  "/dashboard",
  "/certifications",
  "/risks",
  "/audits",
  "/assets",
  "/incidents",
  "/changes",
  "/nonconformities",
  "/capas",
  "/approvals",
  "/documents",
  "/account",
  "/activity",
];

const authPaths = ["/sign-in", "/sign-up", "/forgot-password", "/reset-password"];

export function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;
  const token = req.cookies.get("token")?.value;

  // Protected routes — redirect to sign-in if no token
  const isProtected = protectedPaths.some((p) => pathname.startsWith(p));
  if (isProtected && !token) {
    return NextResponse.redirect(new URL("/sign-in", req.url));
  }

  // Auth pages — redirect to dashboard if already signed in
  const isAuthPage = authPaths.some((p) => pathname.startsWith(p));
  if (isAuthPage && token) {
    return NextResponse.redirect(new URL("/dashboard", req.url));
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    "/((?!_next|[^?]*\\.(?:html?|css|js(?!on)|jpe?g|webp|png|gif|svg|ttf|woff2?|ico|csv|docx?|xlsx?|zip|webmanifest)).*)",
    "/(api|trpc)(.*)",
  ],
};
