import { AppShell } from "@/components/app-shell";
import { requireUser } from "@/lib/auth";
import { getUiMode } from "@/lib/preferences";

export const dynamic = "force-dynamic";

export default async function WorkspaceLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  const [user, uiMode] = await Promise.all([requireUser(), getUiMode()]);
  return <AppShell userEmail={user.email ?? "Curiosity member"} uiMode={uiMode}>{children}</AppShell>;
}
