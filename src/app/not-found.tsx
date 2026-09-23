import Link from "next/link";

export default function NotFound() {
  return (
    <div className="flex flex-1 flex-col items-center justify-center gap-4 px-8 text-center">
      <p className="text-sm text-muted">We couldn&apos;t find that page.</p>
      <Link
        href="/"
        className="rounded-xl border border-border px-4 py-2 text-sm font-medium text-foreground"
      >
        Back to subjects
      </Link>
    </div>
  );
}
