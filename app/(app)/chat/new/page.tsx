import Link from "next/link";
import { createGroup } from "@/app/actions/comms";
import { ActionForm } from "@/components/ActionForm";
import { PeoplePicker } from "@/components/PeoplePicker";
import { requireUser } from "@/lib/auth";
import { db } from "@/lib/db";

export default async function NewGroupPage() {
  const user = await requireUser();
  const people = await db.user.findMany({
    where: { active: true, id: { not: user.id } },
    orderBy: { name: "asc" },
    select: { id: true, name: true, title: true },
  });
  return (
    <div className="max-w-xl space-y-4">
      <Link href="/chat" className="text-sm text-brand-700 hover:underline">Back to chat</Link>
      <h1 className="page-title">New group</h1>
      <ActionForm action={createGroup} className="card space-y-3">
        <div>
          <label className="label" htmlFor="name">Group name</label>
          <input className="input" id="name" name="name" maxLength={80} required placeholder="e.g. Tuesday group team" />
        </div>
        <div>
          <span className="label">Members</span>
          <PeoplePicker people={people} />
        </div>
        <button className="btn-primary w-full">Create group</button>
      </ActionForm>
    </div>
  );
}
