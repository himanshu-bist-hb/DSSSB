export function ProgressBadge({
  attempted,
  total,
}: {
  attempted: number;
  total: number;
}) {
  if (total === 0) {
    return (
      <span className="rounded-md bg-[#efece3] px-2 py-1 text-[11px] font-medium text-muted">
        Empty
      </span>
    );
  }
  if (attempted === 0) {
    return (
      <span className="rounded-md bg-accent-soft px-2 py-1 text-[11px] font-medium text-accent">
        New
      </span>
    );
  }
  const pct = Math.round((attempted / total) * 100);
  const done = attempted >= total;
  return (
    <span
      className={`rounded-md px-2 py-1 text-[11px] font-medium ${
        done ? "bg-[#e7f2ea] text-[#3f7a53]" : "bg-[#f8ecdd] text-[#a3672b]"
      }`}
    >
      {done ? "Done" : `${pct}%`}
    </span>
  );
}
