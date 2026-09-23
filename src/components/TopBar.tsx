import Link from "next/link";

export function TopBar({
  backHref,
  eyebrow,
  title,
  right,
}: {
  backHref?: string;
  eyebrow?: string;
  title: string;
  right?: React.ReactNode;
}) {
  return (
    <div className="sticky top-0 z-10 flex items-center justify-between gap-3 border-b border-border bg-background/95 px-5 pb-3 pt-5 backdrop-blur">
      <div className="min-w-0">
        {backHref ? (
          <Link
            href={backHref}
            className="mb-1 inline-flex items-center gap-1 text-xs font-medium text-muted"
          >
            ← {eyebrow ?? "Back"}
          </Link>
        ) : eyebrow ? (
          <p className="mb-1 text-xs font-medium text-muted">{eyebrow}</p>
        ) : null}
        <h1 className="truncate text-lg font-semibold text-foreground">{title}</h1>
      </div>
      {right}
    </div>
  );
}
