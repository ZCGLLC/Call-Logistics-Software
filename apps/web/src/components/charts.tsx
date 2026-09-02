"use client";

import { Area, AreaChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";

export function DashboardCharts({
  data,
}: {
  data: { day: string; revenue: string; profit: string; calls: number }[];
}) {
  const rows = data.map((d) => ({
    day: new Date(d.day).toLocaleDateString("en-US", { month: "short", day: "numeric" }),
    revenue: Number(d.revenue),
    profit: Number(d.profit),
  }));
  return (
    <div className="h-72">
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart data={rows}>
          <CartesianGrid stroke="#243049" strokeDasharray="3 3" />
          <XAxis dataKey="day" stroke="#8b97ad" fontSize={11} />
          <YAxis stroke="#8b97ad" fontSize={11} />
          <Tooltip
            contentStyle={{ background: "#121826", border: "1px solid #243049", borderRadius: 8 }}
          />
          <Area type="monotone" dataKey="revenue" stroke="#6ea8fe" fill="#6ea8fe" fillOpacity={0.15} />
          <Area type="monotone" dataKey="profit" stroke="#3ddc97" fill="#3ddc97" fillOpacity={0.2} />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}
