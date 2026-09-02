import { cookies } from "next/headers";

const api = process.env.API_PUBLIC_URL ?? "http://localhost:4000";

export async function serverApi<T>(path: string, init?: RequestInit): Promise<T> {
  const jar = await cookies();
  const token = jar.get(process.env.COOKIE_NAME ?? "zcg_session")?.value;
  const res = await fetch(`${api}${path}`, {
    ...init,
    headers: {
      "Content-Type": "application/json",
      cookie: `${process.env.COOKIE_NAME ?? "zcg_session"}=${token}`,
      ...(init?.headers ?? {}),
    },
    cache: "no-store",
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(text || res.statusText);
  }
  if (res.headers.get("content-type")?.includes("text/csv")) {
    return (await res.text()) as T;
  }
  return res.json() as Promise<T>;
}
