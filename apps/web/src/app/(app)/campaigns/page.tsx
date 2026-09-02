import { cookies } from "next/headers";
import { CampaignDesk, type CampaignRow } from "@/components/campaign-desk";

const api = process.env.API_PUBLIC_URL ?? "http://localhost:4000";

async function list(path: string, token: string | undefined) {
  const res = await fetch(`${api}${path}`, {
    headers: { cookie: `${process.env.COOKIE_NAME ?? "zcg_session"}=${token}` },
    cache: "no-store",
  });
  return res.json();
}

export default async function CampaignsPage() {
  const jar = await cookies();
  const token = jar.get(process.env.COOKIE_NAME ?? "zcg_session")?.value;
  const [campaigns, publishers, buyers, verticals] = await Promise.all([
    list("/api/v1/campaigns", token),
    list("/api/v1/publishers", token),
    list("/api/v1/buyers", token),
    list("/api/v1/verticals", token),
  ]);
  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-semibold">Campaigns</h1>
        <p className="mt-1 text-sm text-slate-400">
          Wire a publisher to one or more buyers, then generate tracking DIDs from Numbers.
        </p>
      </div>
      <CampaignDesk
        initial={(campaigns.data ?? []) as CampaignRow[]}
        publishers={(publishers.data ?? []).map((p: { publicId: string; company: string }) => ({
          publicId: p.publicId,
          company: p.company,
        }))}
        buyers={(buyers.data ?? []).map((b: { publicId: string; company: string }) => ({
          publicId: b.publicId,
          company: b.company,
        }))}
        verticals={(verticals.data ?? []) as { id: string; slug: string; name: string }[]}
      />
    </div>
  );
}
