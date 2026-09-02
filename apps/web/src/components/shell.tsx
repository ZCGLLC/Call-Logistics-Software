"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import {
  Activity,
  Bell,
  Building2,
  Command,
  FileBarChart,
  Gauge,
  KeyRound,
  LayoutDashboard,
  PhoneCall,
  Radio,
  Route,
  ScrollText,
  Settings,
  ShieldAlert,
  Store,
  Table2,
  Tags,
  Users,
  Wallet,
  Webhook,
  HeartPulse,
  Upload,
} from "lucide-react";
import { api } from "@/lib/api";
import { CommandPalette } from "./command-palette";

export type ShellUser = {
  name: string;
  email: string;
  role: string;
  publisherId?: string | null;
  buyerId?: string | null;
};

type NavItem = { href: string; label: string; icon: typeof LayoutDashboard; roles?: "all" | "internal" | "publisher" | "buyer" };

const allNav: NavItem[] = [
  { href: "/", label: "Dashboard", icon: LayoutDashboard, roles: "all" },
  { href: "/command-center", label: "Command Center", icon: Command, roles: "internal" },
  { href: "/live", label: "Live Calls", icon: Radio, roles: "all" },
  { href: "/calls", label: "Calls", icon: PhoneCall, roles: "all" },
  { href: "/leads", label: "Leads", icon: ScrollText, roles: "all" },
  { href: "/campaigns", label: "Campaigns", icon: Store, roles: "all" },
  { href: "/publishers", label: "Publishers", icon: Users, roles: "internal" },
  { href: "/buyers", label: "Buyers", icon: Building2, roles: "internal" },
  { href: "/numbers", label: "Numbers", icon: Activity, roles: "all" },
  { href: "/operations", label: "Operations", icon: Table2, roles: "internal" },
  { href: "/routing", label: "Simulator", icon: Route, roles: "internal" },
  { href: "/reports", label: "Reports", icon: FileBarChart, roles: "all" },
  { href: "/invoices", label: "Invoices", icon: Wallet, roles: "buyer" },
  { href: "/statements", label: "Statements", icon: Wallet, roles: "publisher" },
  { href: "/financials", label: "Financials", icon: Wallet, roles: "internal" },
  { href: "/disputes", label: "Disputes", icon: ShieldAlert, roles: "all" },
  { href: "/webhooks", label: "Webhooks", icon: Webhook, roles: "all" },
  { href: "/keys", label: "API keys", icon: KeyRound, roles: "all" },
  { href: "/health", label: "Health", icon: HeartPulse, roles: "internal" },
  { href: "/compliance", label: "Compliance", icon: Tags, roles: "internal" },
  { href: "/import", label: "Import", icon: Upload, roles: "internal" },
  { href: "/settings", label: "Settings", icon: Settings, roles: "all" },
];

function portalOf(role: string): "internal" | "publisher" | "buyer" {
  if (role === "PUBLISHER_ADMIN" || role === "PUBLISHER_USER") return "publisher";
  if (role === "BUYER_ADMIN" || role === "BUYER_USER") return "buyer";
  return "internal";
}

export function Shell({ children, user }: { children: React.ReactNode; user: ShellUser }) {
  const path = usePathname();
  const portal = portalOf(user.role);
  const nav = useMemo(
    () => allNav.filter((i) => i.roles === "all" || i.roles === portal || (portal === "internal" && i.roles === "internal")),
    [portal],
  );
  const [palette, setPalette] = useState(false);
  const [notes, setNotes] = useState<{ id: string; title: string; body: string; readAt: string | null }[]>([]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setPalette((v) => !v);
      }
    };
    window.addEventListener("keydown", onKey);
    api<{ data: typeof notes }>("/api/v1/ops/notifications")
      .then((r) => setNotes(r.data ?? []))
      .catch(() => undefined);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  const unread = notes.filter((n) => !n.readAt).length;

  return (
    <div className="flex min-h-screen">
      <aside className="relative w-60 shrink-0 border-r border-ink-600 bg-ink-950">
        <div className="flex items-center gap-2 px-5 py-5">
          <div className="flex h-8 w-8 items-center justify-center rounded-md bg-signal text-ink-950">
            <Gauge className="h-4 w-4" />
          </div>
          <div>
            <div className="text-[11px] uppercase tracking-[0.18em] text-signal">ZCG CI</div>
            <div className="text-sm font-semibold">
              {portal === "publisher" ? "Publisher portal" : portal === "buyer" ? "Buyer portal" : "Call Intelligence"}
            </div>
          </div>
        </div>
        <nav className="space-y-0.5 px-3 pb-16">
          {nav.map((item) => {
            const active = item.href === "/" ? path === "/" : path.startsWith(item.href);
            const Icon = item.icon;
            return (
              <Link
                key={item.href}
                href={item.href}
                className={`flex items-center gap-2 rounded-md px-3 py-2 text-sm ${
                  active ? "bg-ink-700 text-white" : "text-slate-400 hover:bg-ink-800 hover:text-white"
                }`}
              >
                <Icon className="h-4 w-4" />
                {item.label}
              </Link>
            );
          })}
        </nav>
        <div className="absolute bottom-4 left-4 text-[10px] uppercase tracking-widest text-slate-600">Aperture · {portal}</div>
      </aside>
      <main className="min-w-0 flex-1 bg-ink-900">
        <header className="flex items-center justify-between border-b border-ink-600 px-8 py-4">
          <button
            className="rounded-md border border-ink-600 px-3 py-1.5 text-xs text-slate-400"
            onClick={() => setPalette(true)}
          >
            Search ⌘K
          </button>
          <div className="flex items-center gap-3">
            <div className="relative" title={notes[0]?.title ?? "Notifications"}>
              <Bell className="h-4 w-4 text-slate-400" />
              {unread > 0 && (
                <span className="absolute -right-1 -top-1 h-2 w-2 rounded-full bg-signal" />
              )}
            </div>
            <div className="text-xs text-slate-400">
              {user.name} · {user.role.replaceAll("_", " ")}
            </div>
            <button
              className="rounded-md border border-ink-600 px-3 py-1.5 text-xs text-slate-400"
              onClick={async () => {
                await fetch("/api/v1/auth/logout", { method: "POST" });
                window.location.href = "/login";
              }}
            >
              Sign out
            </button>
          </div>
        </header>
        <div className="px-8 py-6">{children}</div>
      </main>
      {palette && <CommandPalette onClose={() => setPalette(false)} />}
    </div>
  );
}
