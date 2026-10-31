import { deleteAnnouncement, postAnnouncement } from "@/app/actions/comms";
import { ActionForm } from "@/components/ActionForm";
import { Avatar } from "@/components/Avatar";
import { requireUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { formatDateTime } from "@/lib/time";

export default async function UpdatesPage() {
  const user = await requireUser();
  const posts = await db.announcement.findMany({ orderBy: { createdAt: "desc" }, take: 100, include: { author: { select: { id: true, name: true, title: true } } } });

  return (
    <div className="max-w-2xl space-y-4">
      <h1 className="page-title">Updates</h1>
      <details className="card">
        <summary className="cursor-pointer font-medium text-brand-700">Post an update</summary>
        <ActionForm action={postAnnouncement} className="mt-3 space-y-3" resetOnSuccess>
          <input className="input" name="title" maxLength={120} required placeholder="Title" aria-label="Title" />
          <textarea className="input" name="body" rows={4} maxLength={5000} required placeholder="What does the team need to know?" aria-label="Update" />
          <p className="text-xs text-slate-500">Everyone at the clinic sees updates. Don't include client details.</p>
          <button className="btn-primary">Post</button>
        </ActionForm>
      </details>
      {posts.length === 0 && <p className="text-sm text-slate-500">No updates yet.</p>}
      {posts.map((p) => (
        <article key={p.id} className="card">
          <header className="mb-2 flex items-center gap-3">
            <Avatar name={p.author.name} size="sm" />
            <div className="flex-1">
              <div className="text-sm font-medium">{p.author.name}</div>
              <div className="text-xs text-slate-500">{formatDateTime(p.createdAt)}</div>
            </div>
            {(p.author.id === user.id || user.role !== "STAFF") && (
              <form action={deleteAnnouncement}>
                <input type="hidden" name="id" value={p.id} />
                <button className="text-xs text-slate-400 hover:text-rose-600">Delete</button>
              </form>
            )}
          </header>
          <h2 className="font-semibold">{p.title}</h2>
          <p className="mt-1 text-sm whitespace-pre-wrap text-slate-700">{p.body}</p>
        </article>
      ))}
    </div>
  );
}
