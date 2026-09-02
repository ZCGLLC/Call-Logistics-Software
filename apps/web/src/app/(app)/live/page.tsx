import { serverApi } from "@/lib/server";
import { LiveCallsClient } from "@/components/live-calls";

export default async function LivePage() {
  const { data } = await serverApi<{ data: Parameters<typeof LiveCallsClient>[0]["initial"] }>("/api/v1/live");
  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-semibold">Live calls</h1>
      <p className="text-sm text-slate-400">
        In-flight plus the last five minutes. The table refreshes on a short poll so hosted previews work without a
        separate WebSocket proxy.
      </p>
      <LiveCallsClient initial={data ?? []} />
    </div>
  );
}
