import { cookies } from "next/headers";
import { NumberDesk, type NumberRow } from "@/components/number-desk";

const api = process.env.API_PUBLIC_URL ?? "http://localhost:4000";

async function list(path: string, token: string | undefined) {
  const res = await fetch(`${api}${path}`, {
    headers: { cookie: `${process.env.COOKIE_NAME ?? "zcg_session"}=${token}` },
    cache: "no-store",
  });
  return res.json();
}

export default async function NumbersPage() {
  const jar = await cookies();
  const token = jar.get(process.env.COOKIE_NAME ?? "zcg_session")?.value;
  const [numbers, publishers, campaigns] = await Promise.all([
    list("/api/v1/numbers", token),
    list("/api/v1/publishers", token),
    list("/api/v1/campaigns", token),
  ]);
  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-semibold">Number inventory</h1>
        <p className="mt-1 text-sm text-slate-400">
          Generate unique tracking DIDs, assign them to a publisher, copy the list, and send it out.
        </p>
      </div>
      <NumberDesk
        initial={(numbers.data ?? []) as NumberRow[]}
        publishers={(publishers.data ?? []).map((p: { publicId: string; company: string }) => ({
          publicId: p.publicId,
          company: p.company,
        }))}
        campaigns={(campaigns.data ?? []).map(
          (c: { publicId: string; name: string; publisher?: { publicId?: string } }) => ({
            publicId: c.publicId,
            name: c.name,
            publisher: c.publisher,
          }),
        )}
      />
    </div>
  );
}
