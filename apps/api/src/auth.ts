import type { FastifyRequest } from "fastify";

export type Role = "ADMIN" | "AUDITOR" | "VIEWER";

export type AuthContext = {
  orgId: string;
  userId: string;
  role: Role;
};

export function getAuth(req: FastifyRequest): AuthContext {
  const orgId = String(req.headers["x-org-id"] ?? "");
  const userId = String(req.headers["x-user-id"] ?? "");
  const role = String(req.headers["x-role"] ?? "VIEWER") as Role;

  if (!orgId || !userId) throw new Error("Missing x-org-id or x-user-id");
  if (!["ADMIN", "AUDITOR", "VIEWER"].includes(role)) throw new Error("Invalid x-role");

  return { orgId, userId, role };
}
