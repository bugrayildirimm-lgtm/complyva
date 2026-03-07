import type { FastifyRequest } from "fastify";
import jwt from "jsonwebtoken";

export type Role = "ADMIN" | "AUDITOR" | "VIEWER";

export type AuthContext = {
  orgId: string;
  userId: string;
  role: Role;
};

export function getAuth(req: FastifyRequest): AuthContext {
  const authHeader = String(req.headers["authorization"] ?? "");
  if (!authHeader.startsWith("Bearer ")) throw new Error("No token");
  const token = authHeader.slice(7);
  const JWT_SECRET = process.env.JWT_SECRET!;
  let decoded: { userId: string; orgId: string; role: string };
  try {
    decoded = jwt.verify(token, JWT_SECRET) as { userId: string; orgId: string; role: string };
  } catch {
    throw new Error("Invalid or expired token");
  }
  const { userId, orgId, role } = decoded;
  if (!orgId || !userId) throw new Error("Invalid token payload");
  if (!["ADMIN", "AUDITOR", "VIEWER"].includes(role)) throw new Error("Invalid role in token");
  return { orgId, userId, role: role as Role };
}
