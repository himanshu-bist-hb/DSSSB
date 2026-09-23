import { signOut } from "@/lib/auth";

export function SignOutButton() {
  return (
    <form
      action={async () => {
        "use server";
        await signOut({ redirectTo: "/login" });
      }}
    >
      <button
        type="submit"
        className="rounded-lg border border-border px-2.5 py-1.5 text-xs font-medium text-muted transition hover:bg-[#f5f3ec]"
      >
        Sign out
      </button>
    </form>
  );
}
