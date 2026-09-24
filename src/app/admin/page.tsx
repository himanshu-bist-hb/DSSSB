import { notFound } from "next/navigation";
import { auth } from "@/lib/auth";
import { getAdminOverview } from "@/lib/queries";
import { TopBar } from "@/components/TopBar";

export const dynamic = "force-dynamic";

function StatTile({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="flex flex-1 flex-col items-center gap-0.5 rounded-2xl border border-border bg-card px-3 py-3.5">
      <p className="text-xl font-semibold text-foreground">{value}</p>
      <p className="text-center text-[11px] font-medium text-muted">{label}</p>
    </div>
  );
}

const fmt = new Intl.DateTimeFormat("en-IN", {
  dateStyle: "medium",
  timeStyle: "short",
  timeZone: "Asia/Kolkata",
});

function timeAgo(d: Date) {
  const mins = Math.floor((Date.now() - d.getTime()) / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  return `${Math.floor(hrs / 24)}d ago`;
}

export default async function AdminPage() {
  const session = await auth();
  if (!session?.user.isAdmin) notFound();

  const o = await getAdminOverview();

  return (
    <div className="flex flex-1 flex-col">
      <TopBar backHref="/" eyebrow="Home" title="Admin" />

      <div className="flex flex-1 flex-col gap-6 px-5 py-4">
        <div className="grid grid-cols-3 gap-2.5">
          <StatTile label="Total users" value={o.totalUsers} />
          <StatTile label="Active (7d)" value={o.active7d} />
          <StatTile label="New (7d)" value={o.newUsers7d} />
          <StatTile label="Answered" value={o.totalAnswered} />
          <StatTile label="Correct" value={o.totalCorrect} />
          <StatTile label="Accuracy" value={`${o.accuracy}%`} />
        </div>

        <section className="flex flex-col gap-2.5">
          <p className="px-1 text-xs font-medium text-muted">Users (most recently active first)</p>
          {o.users.map((u) => (
            <div
              key={u.id}
              className="flex flex-col gap-2 rounded-2xl border border-border bg-card px-4 py-3.5"
            >
              <div className="flex items-center justify-between gap-3">
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium text-foreground">{u.name ?? "—"}</p>
                  <p className="truncate text-xs text-muted">{u.email}</p>
                </div>
                <p className="shrink-0 text-sm font-semibold text-foreground">
                  {u.answered > 0 ? `${u.accuracy}%` : "—"}
                </p>
              </div>
              <p className="text-xs text-muted">
                {u.answered} attempted · {u.correct} correct · {u.answered - u.correct} wrong
                {u.revealed > 0 ? ` · ${u.revealed} revealed` : ""}
              </p>
              <p className="text-[11px] text-muted">
                Last active {timeAgo(u.lastActiveAt)} ({fmt.format(u.lastActiveAt)}) · Joined{" "}
                {fmt.format(u.signedUpAt)}
              </p>
            </div>
          ))}
        </section>
      </div>
    </div>
  );
}
