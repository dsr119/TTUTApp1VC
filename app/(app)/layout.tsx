import { Nav } from "@/components/Nav";
import { isAdmin, requireUser } from "@/lib/auth";
import { pendingApprovalCount, unreadCount } from "@/lib/counts";
import { signOut } from "../actions/auth";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const user = await requireUser();
  const admin = isAdmin(user.role);
  const [unread, pending] = await Promise.all([unreadCount(user.id), admin ? pendingApprovalCount() : 0]);
  return (
    <div className="min-h-screen md:pl-60">
      <Nav userName={user.name} isAdmin={admin} isOwner={user.role === "OWNER"} unread={unread} pending={pending} signOut={signOut} />
      <main className="mx-auto max-w-5xl px-4 pt-4 pb-24 md:px-8 md:pt-8 md:pb-8">{children}</main>
    </div>
  );
}
