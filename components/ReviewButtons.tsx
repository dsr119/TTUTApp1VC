import type { Decision } from "@/app/actions/admin";

// Approve / deny controls posting to a review server action.
export function ReviewButtons({ id, action }: { id: string; action: (decision: Decision, formData: FormData) => Promise<void> }) {
  return (
    <form className="flex flex-wrap items-center gap-2">
      <input type="hidden" name="id" value={id} />
      <input className="input max-w-56 py-1.5" name="reviewNote" placeholder="Note (optional)" maxLength={500} aria-label="Review note" />
      <button formAction={action.bind(null, "APPROVED")} className="btn-primary py-1.5">Approve</button>
      <button formAction={action.bind(null, "DENIED")} className="btn-secondary py-1.5">Deny</button>
    </form>
  );
}
