import { redirect } from "next/navigation";
import { ActionForm } from "@/components/ActionForm";
import { getCurrentUser } from "@/lib/auth";
import { signIn } from "../actions/auth";

export default async function LoginPage() {
  if (await getCurrentUser()) redirect("/");
  return (
    <main className="flex min-h-screen items-center justify-center p-4">
      <div className="card w-full max-w-sm p-6">
        <div className="mb-6 flex flex-col items-center gap-2">
          <img src="/icon.svg" alt="" className="h-12 w-12" />
          <h1 className="text-xl font-semibold text-slate-900">Connect Team</h1>
          <p className="text-sm text-slate-500">True To You Therapy</p>
        </div>
        <ActionForm action={signIn} className="space-y-4">
          <div>
            <label className="label" htmlFor="email">Email</label>
            <input className="input" id="email" name="email" type="email" autoComplete="username" required />
          </div>
          <div>
            <label className="label" htmlFor="password">Password</label>
            <input className="input" id="password" name="password" type="password" autoComplete="current-password" required />
          </div>
          <button className="btn-primary w-full">Sign in</button>
        </ActionForm>
        {process.env.NODE_ENV !== "production" && (
          <p className="mt-4 text-center text-xs text-slate-400">Demo: owner@, admin@ or staff@example.com / Password123!</p>
        )}
      </div>
    </main>
  );
}
