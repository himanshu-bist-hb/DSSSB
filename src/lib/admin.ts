// Admin accounts are identified by verified Google email. Extra admins can be
// added via the ADMIN_EMAILS env var (comma-separated).
const ADMIN_EMAILS = new Set(
  [
    "himanshubisht858@gmail.com",
    ...(process.env.ADMIN_EMAILS?.split(",") ?? []),
  ]
    .map((e) => e.trim().toLowerCase())
    .filter(Boolean),
);

export function isAdminEmail(email?: string | null): boolean {
  return !!email && ADMIN_EMAILS.has(email.toLowerCase());
}
