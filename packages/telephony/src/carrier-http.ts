export async function basicForm(
  url: string,
  user: string,
  pass: string,
  body: Record<string, string>,
): Promise<Record<string, unknown>> {
  const auth = Buffer.from(`${user}:${pass}`).toString("base64");
  const res = await fetch(url, {
    method: "POST",
    headers: {
      Authorization: `Basic ${auth}`,
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: new URLSearchParams(body),
  });
  const json = (await res.json().catch(() => ({}))) as Record<string, unknown>;
  if (!res.ok) {
    throw new Error(`Carrier POST ${url} failed ${res.status}: ${JSON.stringify(json)}`);
  }
  return json;
}

export async function basicGet(
  url: string,
  user: string,
  pass: string,
): Promise<Record<string, unknown>> {
  const auth = Buffer.from(`${user}:${pass}`).toString("base64");
  const res = await fetch(url, { headers: { Authorization: `Basic ${auth}` } });
  const json = (await res.json().catch(() => ({}))) as Record<string, unknown>;
  if (!res.ok) {
    throw new Error(`Carrier GET ${url} failed ${res.status}: ${JSON.stringify(json)}`);
  }
  return json;
}

export async function bearerJson(
  url: string,
  token: string,
  init?: { method?: string; body?: unknown },
): Promise<Record<string, unknown>> {
  const res = await fetch(url, {
    method: init?.method ?? "GET",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: init?.body === undefined ? undefined : JSON.stringify(init.body),
  });
  const json = (await res.json().catch(() => ({}))) as Record<string, unknown>;
  if (!res.ok) {
    throw new Error(`Carrier ${init?.method ?? "GET"} ${url} failed ${res.status}: ${JSON.stringify(json)}`);
  }
  return json;
}
