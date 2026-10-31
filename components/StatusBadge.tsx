import type { ApprovalStatus } from "@prisma/client";

const styles: Record<ApprovalStatus, string> = {
  PENDING: "bg-amber-100 text-amber-800",
  APPROVED: "bg-emerald-100 text-emerald-800",
  DENIED: "bg-rose-100 text-rose-800",
};

export function StatusBadge({ status }: { status: ApprovalStatus }) {
  return <span className={`badge ${styles[status]}`}>{status.charAt(0) + status.slice(1).toLowerCase()}</span>;
}
