import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { CheckCircle2 } from "lucide-react";
import { api } from "@/lib/api";
import { useCustomerAuth } from "@/lib/contexts";

export default function OrderSuccessPage() {
  const { orderId } = useParams();
  const [order, setOrder] = useState(null);
  const { customer } = useCustomerAuth();

  useEffect(() => {
    api.get(`/orders/${orderId}`).then(({ data }) => setOrder(data));
  }, [orderId]);

  if (!order) return <div className="p-10 text-center text-muted-foreground">Loading…</div>;
  const potentialPts = customer && order.subtotal >= 100 ? Math.floor(order.subtotal * 0.1) : 0;

  return (
    <div className="space-y-6 animate-fade-up">
      <div className="text-center py-6">
        <CheckCircle2 className="w-16 h-16 mx-auto text-primary" strokeWidth={1.5} />
        <h1 className="mt-4 text-4xl font-heading">Order placed!</h1>
        <p className="text-muted-foreground mt-1">Your food is on its way.</p>
      </div>

      <div className="bg-card border border-border rounded-2xl p-6 space-y-3">
        <Row label="Order ID" value={order.order_number} testid="succ-order-number" />
        <Row label="Customer" value={order.customer_name} />
        <Row label="Table" value={order.table_number} />
        <Row label="Total" value={`₹${order.total_amount.toFixed(2)}`} />
        <Row label="Status" value={statusLabel(order.order_status)} />
      </div>

      {customer && potentialPts > 0 && (
        <div className="bg-accent/40 border border-accent rounded-2xl p-4 text-sm">
          You&apos;ll earn <b className="font-mono">{potentialPts} points</b> after this order is completed.
        </div>
      )}

      <div className="flex gap-3">
        <Link data-testid="succ-track-btn" to={`/track/${order.id}`} className="flex-1 h-12 rounded-full bg-primary text-primary-foreground grid place-items-center font-medium">Track order</Link>
        <Link data-testid="succ-continue-btn" to="/" className="flex-1 h-12 rounded-full border border-border grid place-items-center">Continue browsing</Link>
      </div>
    </div>
  );
}

function Row({ label, value, testid }) {
  return (
    <div className="flex justify-between items-center">
      <div className="text-xs font-mono uppercase tracking-[0.15em] text-muted-foreground">{label}</div>
      <div data-testid={testid} className="font-heading text-base">{value}</div>
    </div>
  );
}

export function statusLabel(s) {
  return {
    order_placed: "Order Placed", accepted: "Accepted", preparing: "Preparing",
    ready: "Ready", served: "Served", completed: "Completed",
    rejected: "Rejected", cancelled: "Cancelled",
  }[s] || s;
}
