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
    <div className="sticky top-0 z-10 border-b border-border bg-background/95 backdrop-blur lg:bg-card/95">
      <div className="page-wrap flex items-center justify-between gap-3 pb-3 pt-5 lg:py-4">
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
        <h1 className="truncate text-lg font-semibold text-foreground lg:text-2xl">{title}</h1>
      </div>
      {right}
      </div>
    </div>
  );
}
