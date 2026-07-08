import { useEffect, useState } from "react";
import { apiAdmin } from "@/lib/api";
import { statusLabel } from "@/pages/customer/OrderSuccessPage";

export default function DashboardPage() {
  const [stats, setStats] = useState(null);

  useEffect(() => {
    const load = () => apiAdmin.get("/dashboard/stats").then(({ data }) => setStats(data)).catch(() => {});
    load();
    const t = setInterval(load, 5000);
    return () => clearInterval(t);
  }, []);

  if (!stats) return <div className="text-muted-foreground">Loading…</div>;

  const cards = [
    { label: "Today's Sales", value: `₹${stats.todays_sales.toLocaleString()}`, testid: "stat-todays-sales" },
    { label: "Orders Today", value: stats.orders_today, testid: "stat-orders-today" },
    { label: "Monthly Sales", value: `₹${stats.monthly_sales.toLocaleString()}`, testid: "stat-monthly-sales" },
    { label: "Pending Orders", value: stats.pending_orders, testid: "stat-pending" },
    { label: "Completed Today", value: stats.completed_today, testid: "stat-completed" },
  ];

  return (
    <div className="space-y-6">
      <div>
        <div className="text-[10px] font-mono uppercase tracking-[0.2em] text-primary">Overview</div>
        <h1 className="text-3xl font-heading">Dashboard</h1>
      </div>
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-3">
        {cards.map((c) => (
          <div key={c.label} data-testid={c.testid} className="bg-card border border-border rounded-xl p-4">
            <div className="text-[10px] font-mono uppercase tracking-[0.15em] text-muted-foreground">{c.label}</div>
            <div className="mt-1 text-2xl font-heading">{c.value}</div>
          </div>
        ))}
      </div>

      <div className="bg-card border border-border rounded-xl">
        <div className="p-4 border-b border-border font-heading text-lg">Recent orders</div>
        <div className="divide-y divide-border">
          {stats.recent_orders.map((o) => (
            <div key={o.id} data-testid={`recent-order-${o.id}`} className="p-3 flex items-center justify-between gap-3 text-sm">
              <div className="flex-1 min-w-0">
                <div className="font-medium">#{o.order_number} · {o.customer_name}</div>
                <div className="text-xs text-muted-foreground">Table {o.table_number} · {new Date(o.created_at).toLocaleTimeString()}</div>
              </div>
              <div className="font-mono">₹{o.total_amount.toFixed(0)}</div>
              <div className="text-xs px-2 py-1 rounded-md bg-secondary">{statusLabel(o.order_status)}</div>
            </div>
          ))}
          {stats.recent_orders.length === 0 && <div className="p-6 text-muted-foreground text-sm">No orders yet.</div>}
        </div>
      </div>
    </div>
  );
}
