"use server";

import { redirect } from "next/navigation";
import { z } from "zod";
import { audit } from "@/lib/audit";
import { createSession, destroySession, getCurrentUser, verifyPassword } from "@/lib/auth";
import type { ActionResult } from "@/components/ActionForm";

const schema = z.object({ email: z.string().email(), password: z.string().min(1) });

export async function signIn(_prev: ActionResult, formData: FormData): Promise<ActionResult> {
  const parsed = schema.safeParse({ email: formData.get("email"), password: formData.get("password") });
  if (!parsed.success) return { error: "Enter your email and password." };
  const user = await verifyPassword(parsed.data.email, parsed.data.password);
  if (!user) {
    await audit(null, "auth.sign_in_failed", "User", null);
    return { error: "That email and password don't match." };
  }
  await createSession(user.id);
  await audit(user.id, "auth.sign_in", "User", user.id);
  redirect("/");
}

export async function signOut() {
  const user = await getCurrentUser();
  await destroySession();
  if (user) await audit(user.id, "auth.sign_out", "User", user.id);
  redirect("/login");
}
