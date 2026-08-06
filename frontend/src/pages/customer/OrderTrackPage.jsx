import { useEffect, useState } from "react";
import { useParams, Link } from "react-router-dom";
import { api } from "@/lib/api";
import { statusLabel } from "./OrderSuccessPage";

const STEPS = ["order_placed", "accepted", "preparing", "ready", "served", "completed"];

export default function OrderTrackPage() {
  const { orderId } = useParams();
  const [order, setOrder] = useState(null);

  useEffect(() => {
    let timer;
    const fetch = () => api.get(`/orders/${orderId}`).then(({ data }) => setOrder(data)).catch(() => {});
    fetch();
    timer = setInterval(fetch, 5000);
    return () => clearInterval(timer);
  }, [orderId]);

  if (!order) return <div className="p-10 text-center text-muted-foreground">Loading…</div>;
  const currentIdx = STEPS.indexOf(order.order_status);
  const terminal = ["rejected", "cancelled"].includes(order.order_status);

  return (
    <div className="space-y-6 animate-fade-up">
      <div>
        <div className="text-[10px] font-mono uppercase tracking-[0.2em] text-primary">Tracking</div>
        <h1 className="text-3xl font-heading">Order #{order.order_number}</h1>
        <p className="text-muted-foreground text-sm">Table {order.table_number} · ₹{order.total_amount.toFixed(2)}</p>
      </div>

      <div className="bg-card border border-border rounded-2xl p-6">
        {terminal ? (
          <div data-testid="track-status" className="text-destructive font-heading text-lg">{statusLabel(order.order_status)}</div>
        ) : (
          <ol className="relative space-y-4">
            {STEPS.map((s, i) => (
              <li key={s} className="flex items-center gap-3">
                <div className={`w-8 h-8 rounded-full grid place-items-center text-xs font-mono ${i <= currentIdx ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground"}`}>
                  {i + 1}
                </div>
                <div className={`text-sm ${i <= currentIdx ? "text-foreground font-medium" : "text-muted-foreground"}`}>
                  {statusLabel(s)}
                </div>
                {i === currentIdx && !terminal && (
                  <span data-testid="track-status" className="ml-auto text-[10px] font-mono uppercase tracking-[0.2em] text-primary">Current</span>
                )}
              </li>
            ))}
          </ol>
        )}
      </div>

      <div className="bg-card border border-border rounded-2xl p-5 space-y-2">
        <div className="text-xs font-mono uppercase tracking-[0.15em] text-muted-foreground">Items</div>
        {(Array.isArray(order.items) ? order.items : []).map((it) => (
          <div key={it.id} className="flex justify-between text-sm">
            <span>{it.item_name} × {it.quantity}</span>
            <span className="font-mono">₹{Number(it.item_total || 0).toFixed(0)}</span>
          </div>
        ))}
      </div>

      <Link to="/" data-testid="track-back-menu" className="inline-block h-11 px-5 rounded-full border border-border">← Back to menu</Link>
    </div>
  );
}
