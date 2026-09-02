export async function api<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(path, {
    ...init,
    headers: {
      "Content-Type": "application/json",
      ...(init?.headers ?? {}),
    },
    credentials: "include",
    cache: "no-store",
  });
  if (res.status === 401 && typeof window !== "undefined") {
    window.location.href = "/login";
  }
  if (!res.ok) {
    const text = await res.text();
    throw new Error(messageFromBody(text, res.statusText));
  }
  return res.json() as Promise<T>;
}

function messageFromBody(text: string, fallback: string): string {
  try {
    const j = JSON.parse(text) as { message?: unknown; error?: string };
    if (typeof j.message === "string" && j.message) return j.message;
    if (Array.isArray(j.message)) return j.message.map(String).join("; ");
    if (typeof j.error === "string" && j.error) return j.error;
  } catch {
    /* raw body */
  }
  return text || fallback;
}

export function usd(value: string | number | null | undefined): string {
  if (value === null || value === undefined || value === "") return "—";
  const n = Number(value);
  if (Number.isNaN(n)) return "—";
  return n.toLocaleString("en-US", { style: "currency", currency: "USD" });
}

export function pct(value: number | null | undefined): string {
  if (value === null || value === undefined || Number.isNaN(Number(value))) return "—";
  return `${(Number(value) * 100).toFixed(1)}%`;
}
