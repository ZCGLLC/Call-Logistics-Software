import { NextRequest, NextResponse } from "next/server";

const api = process.env.API_PUBLIC_URL ?? "http://localhost:4000";

async function proxy(req: NextRequest, path: string[]) {
  const search = req.nextUrl.search;
  const url = `${api}/api/v1/${path.join("/")}${search}`;
  const headers = new Headers();
  req.headers.forEach((value, key) => {
    if (["host", "connection", "content-length"].includes(key.toLowerCase())) return;
    headers.set(key, value);
  });
  headers.set("x-forwarded-proto", req.nextUrl.protocol.replace(":", "") || "https");
  headers.set("x-forwarded-host", req.headers.get("host") ?? "");

  const body = req.method === "GET" || req.method === "HEAD" ? undefined : await req.arrayBuffer();
  const upstream = await fetch(url, {
    method: req.method,
    headers,
    body,
    redirect: "manual",
  });

  const resHeaders = new Headers(upstream.headers);
  resHeaders.delete("content-encoding");
  resHeaders.delete("transfer-encoding");
  const res = new NextResponse(upstream.body, {
    status: upstream.status,
    headers: resHeaders,
  });
  return res;
}

export async function GET(req: NextRequest, ctx: { params: Promise<{ path: string[] }> }) {
  const { path } = await ctx.params;
  return proxy(req, path);
}
export async function POST(req: NextRequest, ctx: { params: Promise<{ path: string[] }> }) {
  const { path } = await ctx.params;
  return proxy(req, path);
}
export async function PATCH(req: NextRequest, ctx: { params: Promise<{ path: string[] }> }) {
  const { path } = await ctx.params;
  return proxy(req, path);
}
export async function PUT(req: NextRequest, ctx: { params: Promise<{ path: string[] }> }) {
  const { path } = await ctx.params;
  return proxy(req, path);
}
export async function DELETE(req: NextRequest, ctx: { params: Promise<{ path: string[] }> }) {
  const { path } = await ctx.params;
  return proxy(req, path);
}
