import "server-only";
import { createHash, randomBytes } from "node:crypto";
import { cache } from "react";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import bcrypt from "bcryptjs";
import type { Role, User } from "@prisma/client";
import { db } from "./db";

// Local sign-in for development and review. Production will sign in through
// Amazon Cognito (HIPAA eligible) and then create the same kind of session.

export const SESSION_COOKIE = "ct_session";
const SESSION_HOURS = Number(process.env.SESSION_HOURS ?? 12);

export type SessionUser = Pick<User, "id" | "name" | "email" | "role" | "title">;

function hashToken(token: string) {
  return createHash("sha256").update(token).digest("hex");
}

export async function hashPassword(password: string) {
  return bcrypt.hash(password, 12);
}

export async function verifyPassword(email: string, password: string) {
  const user = await db.user.findUnique({ where: { email: email.trim().toLowerCase() } });
  // Compare even when the user is missing so timing does not reveal which emails exist.
  const hash = user?.passwordHash ?? "$2a$12$invalidinvalidinvalidinvalidinvalidinvalidinvalidinva";
  const ok = await bcrypt.compare(password, hash);
  return ok && user?.active ? user : null;
}

export async function createSession(userId: string) {
  const token = randomBytes(32).toString("base64url");
  const expiresAt = new Date(Date.now() + SESSION_HOURS * 3600_000);
  await db.session.create({ data: { tokenHash: hashToken(token), userId, expiresAt } });
  const jar = await cookies();
  jar.set(SESSION_COOKIE, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    expires: expiresAt,
  });
}

export async function destroySession() {
  const jar = await cookies();
  const token = jar.get(SESSION_COOKIE)?.value;
  if (token) await db.session.deleteMany({ where: { tokenHash: hashToken(token) } });
  jar.delete(SESSION_COOKIE);
}

export const getCurrentUser = cache(async (): Promise<SessionUser | null> => {
  const token = (await cookies()).get(SESSION_COOKIE)?.value;
  if (!token) return null;
  const session = await db.session.findUnique({
    where: { tokenHash: hashToken(token) },
    include: { user: { select: { id: true, name: true, email: true, role: true, title: true, active: true } } },
  });
  if (!session || session.expiresAt < new Date() || !session.user.active) return null;
  const { active: _active, ...user } = session.user;
  return user;
});

export async function requireUser() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  return user;
}

export function isAdmin(role: Role) {
  return role === "ADMIN" || role === "OWNER";
}

export async function requireAdmin() {
  const user = await requireUser();
  if (!isAdmin(user.role)) redirect("/");
  return user;
}

export async function requireOwner() {
  const user = await requireUser();
  if (user.role !== "OWNER") redirect("/");
  return user;
}
