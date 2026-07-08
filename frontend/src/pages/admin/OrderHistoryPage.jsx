import { useEffect, useMemo, useState } from "react";
import { apiAdmin } from "@/lib/api";
import { statusLabel } from "@/pages/customer/OrderSuccessPage";

const RANGES = ["today", "yesterday", "7d", "30d", "month", "all"];

function rangeToDates(r) {
  const now = new Date();
  const start = new Date(); const end = new Date();
  end.setHours(23, 59, 59, 999);
  if (r === "today") { start.setHours(0, 0, 0, 0); }
  else if (r === "yesterday") { start.setDate(now.getDate() - 1); start.setHours(0, 0, 0, 0); end.setDate(now.getDate() - 1); }
  else if (r === "7d") { start.setDate(now.getDate() - 6); start.setHours(0, 0, 0, 0); }
  else if (r === "30d") { start.setDate(now.getDate() - 29); start.setHours(0, 0, 0, 0); }
  else if (r === "month") { start.setDate(1); start.setHours(0, 0, 0, 0); }
  else { return { start: null, end: null }; }
  return { start: start.toISOString(), end: end.toISOString() };
}

export default function OrderHistoryPage() {
  const [orders, setOrders] = useState([]);
  const [range, setRange] = useState("30d");
  const [search, setSearch] = useState("");

  useEffect(() => {
    const params = new URLSearchParams();
    params.set("status_group", "history");
    const { start, end } = rangeToDates(range);
    if (start) params.set("start_date", start);
    if (end) params.set("end_date", end);
    if (search.trim()) params.set("search", search.trim());
    apiAdmin.get(`/orders?${params.toString()}`).then(({ data }) => setOrders(data));
  }, [range, search]);

  const total = useMemo(() => orders.reduce((s, o) => s + (o.order_status === "completed" ? o.total_amount : 0), 0), [orders]);

  return (
    <div className="space-y-4">
      <div>
        <div className="text-[10px] font-mono uppercase tracking-[0.2em] text-primary">Archive</div>
        <h1 className="text-3xl font-heading">Order history</h1>
      </div>

      <div className="flex flex-wrap gap-2 items-center">
        {RANGES.map((r) => (
          <button
            key={r}
            data-testid={`range-${r}`}
            onClick={() => setRange(r)}
            className={`h-9 px-3 rounded-md text-sm ${range === r ? "bg-primary text-primary-foreground" : "border border-border hover:bg-secondary"}`}
          >{r === "7d" ? "Last 7 Days" : r === "30d" ? "Last 30 Days" : r === "month" ? "This Month" : r[0].toUpperCase() + r.slice(1)}</button>
        ))}
        <input
          data-testid="history-search"
          placeholder="Search order#, name, mobile, table…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="ml-auto h-9 px-3 rounded-md border border-border bg-background text-sm min-w-[240px]"
        />
      </div>

      <div className="bg-card border border-border rounded-xl">
        <div className="p-3 border-b border-border flex justify-between text-sm">
          <span>{orders.length} orders</span>
          <span className="font-mono">Revenue: ₹{total.toFixed(2)}</span>
        </div>
        <div className="divide-y divide-border">
          {orders.map((o) => (
            <div key={o.id} data-testid={`history-order-${o.id}`} className="p-3 flex flex-wrap items-center justify-between gap-3 text-sm">
              <div className="flex-1 min-w-[200px]">
                <div className="font-medium">#{o.order_number} · {o.customer_name}</div>
                <div className="text-xs text-muted-foreground">Table {o.table_number} · {o.mobile_number} · {new Date(o.created_at).toLocaleString()}</div>
              </div>
              <div className="text-xs px-2 py-1 rounded-md bg-secondary">{statusLabel(o.order_status)}</div>
              <div className="font-mono w-20 text-right">₹{o.total_amount.toFixed(0)}</div>
            </div>
          ))}
          {orders.length === 0 && <div className="p-6 text-muted-foreground text-sm">No orders in this range.</div>}
        </div>
      </div>
    </div>
  );
}
