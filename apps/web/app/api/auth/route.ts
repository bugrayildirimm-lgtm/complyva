import { NextRequest, NextResponse } from "next/server";

export async function POST(req: NextRequest) {
  const { token, refreshToken } = await req.json();

  const res = NextResponse.json({ ok: true });

  if (token) {
    res.cookies.set("token", token, {
      path: "/",
      maxAge: 60 * 60 * 24 * 30, // 30 days
      sameSite: "lax",
      httpOnly: false,
    });
  }

  if (refreshToken) {
    res.cookies.set("refreshToken", refreshToken, {
      path: "/",
      maxAge: 60 * 60 * 24 * 30,
      sameSite: "lax",
      httpOnly: false,
    });
  }

  return res;
}

export async function DELETE() {
  const res = NextResponse.json({ ok: true });
  res.cookies.set("token", "", { path: "/", maxAge: 0 });
  res.cookies.set("refreshToken", "", { path: "/", maxAge: 0 });
  return res;
}
