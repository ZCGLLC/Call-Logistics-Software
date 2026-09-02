import { redirect } from "next/navigation";
import { cookies } from "next/headers";
import { Shell } from "@/components/shell";

const api = process.env.API_PUBLIC_URL ?? "http://localhost:4000";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const jar = await cookies();
  const token = jar.get(process.env.COOKIE_NAME ?? "zcg_session")?.value;
  if (!token) redirect("/login");
  const me = await fetch(`${api}/api/v1/auth/me`, {
    headers: { cookie: `${process.env.COOKIE_NAME ?? "zcg_session"}=${token}` },
    cache: "no-store",
  });
  if (!me.ok) redirect("/login");
  return <Shell>{children}</Shell>;
}
