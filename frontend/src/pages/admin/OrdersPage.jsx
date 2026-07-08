import { useEffect, useState } from "react";
import { toast } from "sonner";
import { apiAdmin } from "@/lib/api";
import { statusLabel } from "@/pages/customer/OrderSuccessPage";

const NEXT_ACTION = {
  order_placed: [{ label: "Accept", next: "accepted", variant: "primary" }, { label: "Reject", next: "rejected", variant: "danger" }],
  accepted: [{ label: "Start Preparing", next: "preparing", variant: "primary" }],
  preparing: [{ label: "Mark Ready", next: "ready", variant: "primary" }],
  ready: [{ label: "Mark Served", next: "served", variant: "primary" }],
  served: [{ label: "Complete", next: "completed", variant: "primary" }],
};

export default function OrdersPage() {
  const [orders, setOrders] = useState([]);
  const [prevIds, setPrevIds] = useState(new Set());

  const load = async () => {
    const { data } = await apiAdmin.get("/orders?status_group=active");
    const currentIds = new Set(data.map((o) => o.id));
    const newIds = [...currentIds].filter((id) => !prevIds.has(id));
    if (prevIds.size > 0 && newIds.length > 0) toast.success(`${newIds.length} new order(s)!`);
    setPrevIds(currentIds);
    setOrders(data);
  };

  useEffect(() => {
    load();
    const t = setInterval(load, 4000);
    return () => clearInterval(t);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const update = async (o, next) => {
    try {
      await apiAdmin.patch(`/orders/${o.id}/status`, { status: next });
      toast.success(`Order ${o.order_number} → ${statusLabel(next)}`);
      load();
    } catch (e) {
      toast.error("Failed to update");
    }
  };

  return (
    <div className="space-y-4">
      <div>
        <div className="text-[10px] font-mono uppercase tracking-[0.2em] text-primary">Live</div>
        <h1 className="text-3xl font-heading">Active orders</h1>
      </div>
      <div className="grid gap-3">
        {orders.length === 0 && <div className="p-6 text-muted-foreground border border-dashed border-border rounded-xl">No active orders.</div>}
        {orders.map((o) => (
          <div key={o.id} data-testid={`order-${o.id}`} className="bg-card border border-border rounded-xl p-4">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <div className="font-heading text-lg">#{o.order_number} · Table {o.table_number}</div>
                <div className="text-xs text-muted-foreground">{o.customer_name} · {o.mobile_number} · {new Date(o.created_at).toLocaleTimeString()}</div>
              </div>
              <div className="text-right">
                <div className="text-xs px-2 py-1 rounded-md bg-secondary inline-block">{statusLabel(o.order_status)}</div>
                <div className="font-mono text-lg mt-1">₹{o.total_amount.toFixed(2)}</div>
              </div>
            </div>
            <div className="mt-3 text-sm space-y-0.5">
              {o.items.map((it) => (
                <div key={it.id} className="flex justify-between">
                  <span>{it.item_name} × {it.quantity}</span>
                  <span className="font-mono text-xs text-muted-foreground">₹{it.item_total.toFixed(0)}</span>
                </div>
              ))}
            </div>
            <div className="mt-3 flex flex-wrap gap-2">
              {(NEXT_ACTION[o.order_status] || []).map((a) => (
                <button
                  key={a.next}
                  data-testid={`action-${o.id}-${a.next}`}
                  onClick={() => update(o, a.next)}
                  className={`h-9 px-4 rounded-md text-sm font-medium ${a.variant === "danger" ? "border border-destructive text-destructive hover:bg-destructive/10" : "bg-primary text-primary-foreground hover:opacity-90"}`}
                >{a.label}</button>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
