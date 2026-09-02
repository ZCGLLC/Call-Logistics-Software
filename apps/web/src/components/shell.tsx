"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Activity,
  Building2,
  Command,
  FileBarChart,
  Gauge,
  LayoutDashboard,
  PhoneCall,
  Radio,
  Route,
  Settings,
  Store,
  Table2,
  Users,
  Wallet,
} from "lucide-react";

const nav = [
  { href: "/", label: "Dashboard", icon: LayoutDashboard },
  { href: "/command-center", label: "Command Center", icon: Command },
  { href: "/live", label: "Live Calls", icon: Radio },
  { href: "/calls", label: "Calls", icon: PhoneCall },
  { href: "/campaigns", label: "Campaigns", icon: Store },
  { href: "/publishers", label: "Publishers", icon: Users },
  { href: "/buyers", label: "Buyers", icon: Building2 },
  { href: "/numbers", label: "Numbers", icon: Activity },
  { href: "/operations", label: "Operations", icon: Table2 },
  { href: "/routing", label: "Simulator", icon: Route },
  { href: "/reports", label: "Reports", icon: FileBarChart },
  { href: "/financials", label: "Financials", icon: Wallet },
  { href: "/settings", label: "Settings", icon: Settings },
];

export function Shell({ children }: { children: React.ReactNode }) {
  const path = usePathname();
  return (
    <div className="flex min-h-screen">
      <aside className="w-60 shrink-0 border-r border-ink-600 bg-ink-950">
        <div className="flex items-center gap-2 px-5 py-5">
          <div className="flex h-8 w-8 items-center justify-center rounded-md bg-signal text-ink-950">
            <Gauge className="h-4 w-4" />
          </div>
          <div>
            <div className="text-[11px] uppercase tracking-[0.18em] text-signal">ZCG CI</div>
            <div className="text-sm font-semibold">Call Intelligence</div>
          </div>
        </div>
        <nav className="space-y-0.5 px-3">
          {nav.map((item) => {
            const active = item.href === "/" ? path === "/" : path.startsWith(item.href);
            const Icon = item.icon;
            return (
              <Link
                key={item.href}
                href={item.href}
                className={`flex items-center gap-2 rounded-md px-3 py-2 text-sm ${
                  active
                    ? "bg-ink-700 text-white"
                    : "text-slate-400 hover:bg-ink-800 hover:text-white"
                }`}
              >
                <Icon className="h-4 w-4" />
                {item.label}
              </Link>
            );
          })}
        </nav>
        <div className="absolute bottom-4 left-4 hidden text-[10px] uppercase tracking-widest text-slate-600 lg:block">
          Aperture · internal
        </div>
      </aside>
      <main className="min-w-0 flex-1 bg-ink-900">
        <header className="flex items-center justify-between border-b border-ink-600 px-8 py-4">
          <div className="text-sm text-slate-400">Zaidi Consulting Group · operations</div>
          <button
            className="rounded-md border border-ink-600 px-3 py-1.5 text-xs text-slate-400"
            onClick={async () => {
              await fetch("/api/v1/auth/logout", { method: "POST" });
              window.location.href = "/login";
            }}
          >
            Sign out
          </button>
        </header>
        <div className="px-8 py-6">{children}</div>
      </main>
    </div>
  );
}
