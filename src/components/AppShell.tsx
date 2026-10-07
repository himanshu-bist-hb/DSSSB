import { auth, signOut } from "@/lib/auth";
import { SidebarNav, type NavItem } from "@/components/SidebarNav";

// Mobile: the narrow single-column app. Desktop (lg+): a full-width workspace
// with a persistent left sidebar, like a professional test-prep platform.
export async function AppShell({ children }: { children: React.ReactNode }) {
  const session = await auth();
  const user = session?.user;

  const baseClass =
    "mx-auto flex min-h-dvh w-full max-w-[430px] flex-col bg-background shadow-[0_0_40px_rgba(0,0,0,0.06)] lg:max-w-none lg:shadow-none";

  if (!user) {
    return <div className={baseClass}>{children}</div>;
  }

  const items: NavItem[] = [
    { href: "/", label: "Dashboard", icon: "🏠" },
    { href: "/practice", label: "Question Practice", icon: "📝" },
    { href: "/tutor", label: "AI Tutor", icon: "🎧" },
    { href: "/doubt", label: "AI Doubt Solver", icon: "📷" },
    { href: "/stats", label: "Performance", icon: "📊" },
    ...(user.isAdmin ? [{ href: "/admin", label: "Admin", icon: "🛡️" }] : []),
  ];

  return (
    <div className={`${baseClass} lg:flex-row`}>
      <aside className="sticky top-0 hidden h-dvh w-64 shrink-0 flex-col justify-between bg-[#5a1620] px-4 py-6 lg:flex xl:w-72">
        <div className="flex flex-col gap-8">
          <div className="flex items-center gap-3 px-2">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-white text-sm font-bold text-accent">
              SS
            </div>
            <div>
              <p className="text-sm font-semibold leading-tight text-white">DSSSB TGT S.St</p>
              <p className="text-[11px] leading-tight text-white/60">Exam Practice Portal</p>
            </div>
          </div>
          <SidebarNav items={items} />
        </div>

        <div className="flex flex-col gap-3 border-t border-white/15 pt-4">
          <div className="flex items-center gap-3 px-2">
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-white/15 text-sm font-semibold text-white">
              {(user.name ?? user.email ?? "U").charAt(0).toUpperCase()}
            </div>
            <div className="min-w-0">
              <p className="truncate text-sm font-medium text-white">{user.name ?? "Student"}</p>
              <p className="truncate text-[11px] text-white/60">{user.email}</p>
            </div>
          </div>
          <form
            action={async () => {
              "use server";
              await signOut({ redirectTo: "/login" });
            }}
          >
            <button
              type="submit"
              className="w-full rounded-lg border border-white/25 px-3 py-2 text-xs font-medium text-white/80 transition hover:bg-white/10 hover:text-white"
            >
              Sign out
            </button>
          </form>
        </div>
      </aside>

      <main className="flex min-w-0 flex-1 flex-col">{children}</main>
    </div>
  );
}
