import { cookies } from "next/headers";
import { BuyerDesk, type BuyerRow } from "@/components/buyer-desk";

const api = process.env.API_PUBLIC_URL ?? "http://localhost:4000";

export default async function BuyersPage() {
  const jar = await cookies();
  const token = jar.get(process.env.COOKIE_NAME ?? "zcg_session")?.value;
  const res = await fetch(`${api}/api/v1/buyers`, {
    headers: { cookie: `${process.env.COOKIE_NAME ?? "zcg_session"}=${token}` },
    cache: "no-store",
  });
  const { data } = (await res.json()) as { data?: BuyerRow[] };
  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-semibold">Buyers</h1>
        <p className="mt-1 text-sm text-slate-400">
          Add call buyers and destination DIDs. Partners with call history are terminated instead of deleted.
        </p>
      </div>
      <BuyerDesk initial={data ?? []} />
    </div>
  );
}
