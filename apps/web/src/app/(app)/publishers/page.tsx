import { cookies } from "next/headers";
import { PublisherDesk, type PublisherRow } from "@/components/publisher-desk";

const api = process.env.API_PUBLIC_URL ?? "http://localhost:4000";

export default async function PublishersPage() {
  const jar = await cookies();
  const token = jar.get(process.env.COOKIE_NAME ?? "zcg_session")?.value;
  const res = await fetch(`${api}/api/v1/publishers`, {
    headers: { cookie: `${process.env.COOKIE_NAME ?? "zcg_session"}=${token}` },
    cache: "no-store",
  });
  const { data } = (await res.json()) as { data?: PublisherRow[] };
  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-semibold">Publishers</h1>
        <p className="mt-1 text-sm text-slate-400">
          Add traffic sources, remove unused partners, then generate tracking DIDs from Numbers to send out.
        </p>
      </div>
      <PublisherDesk initial={data ?? []} />
    </div>
  );
}
