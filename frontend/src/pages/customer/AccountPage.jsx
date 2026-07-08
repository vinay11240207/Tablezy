import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { toast } from "sonner";
import { LogOut, Gift, Receipt, Award } from "lucide-react";
import { api } from "@/lib/api";
import { useCustomerAuth, useCart } from "@/lib/contexts";
import { statusLabel } from "./OrderSuccessPage";

export default function AccountPage() {
  const { customer, loading, logout, refresh } = useCustomerAuth();
  const { addReward, rewardLine } = useCart();
  const nav = useNavigate();
  const [orders, setOrders] = useState([]);
  const [rewards, setRewards] = useState([]);
  const [history, setHistory] = useState([]);

  useEffect(() => {
    if (!loading && !customer) nav("/account/login");
  }, [loading, customer, nav]);

  useEffect(() => {
    if (!customer) return;
    const load = () => {
      api.get("/customer/orders").then(({ data }) => setOrders(data)).catch(() => {});
      api.get("/rewards?active_only=true").then(({ data }) => setRewards(data)).catch(() => {});
      api.get("/customer/points-history").then(({ data }) => setHistory(data)).catch(() => {});
      refresh();
    };
    load();
    const t = setInterval(load, 8000);
    return () => clearInterval(t);
  }, [customer?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  const addToCart = (r) => {
    if (customer.total_points < r.points_required) return toast.error("Not enough points");
    if (rewardLine) return toast.error("You already added a reward to your cart");
    addReward(r);
    toast.success(`${r.reward_name} added to cart`);
    nav("/cart");
  };

  if (loading || !customer) return <div className="p-10 text-center text-muted-foreground">Loading…</div>;

  return (
    <div className="space-y-6 animate-fade-up">
      <div className="flex items-start justify-between gap-4">
        <div>
          <div className="text-[10px] font-mono uppercase tracking-[0.2em] text-primary">Your account</div>
          <h1 data-testid="account-name" className="text-4xl font-heading">{customer.name}</h1>
          <p className="text-muted-foreground text-sm">{customer.mobile_number}</p>
        </div>
        <button onClick={() => { logout(); nav("/"); }} data-testid="account-logout-btn" className="h-10 px-4 rounded-full border border-border flex items-center gap-2 text-sm hover:bg-secondary">
          <LogOut className="w-4 h-4" /> Log out
        </button>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
        <Stat label="Points" value={customer.total_points} testid="stat-points" icon={<Award className="w-4 h-4" />} />
        <Stat label="Orders" value={orders.length} testid="stat-orders" icon={<Receipt className="w-4 h-4" />} />
        <Stat label="Redeems" value={history.filter(h => h.transaction_type === "redeemed").length} testid="stat-redeems" icon={<Gift className="w-4 h-4" />} />
      </div>

      <section className="bg-card border border-border rounded-2xl p-5">
        <h2 className="font-heading text-2xl mb-3">Available rewards</h2>
        <div className="grid gap-2">
          {rewards.length === 0 && <p className="text-muted-foreground text-sm">No rewards yet.</p>}
          {rewards.map((r) => {
            const canRedeem = customer.total_points >= r.points_required;
            return (
              <div key={r.id} data-testid={`reward-item-${r.id}`} className="flex items-center justify-between gap-3 p-3 rounded-xl border border-border">
                <div>
                  <div className="font-heading">{r.reward_name}</div>
                  <div className="text-xs text-muted-foreground">{r.description}</div>
                </div>
                <div className="flex items-center gap-3">
                  <div className="font-mono text-xs">{r.points_required} pts</div>
                  <button data-testid={`redeem-btn-${r.id}`} disabled={!canRedeem} onClick={() => addToCart(r)} className="h-9 px-4 rounded-full bg-primary text-primary-foreground text-sm disabled:opacity-40">Add to cart</button>
                </div>
              </div>
            );
          })}
        </div>
      </section>

      <section className="bg-card border border-border rounded-2xl p-5">
        <h2 className="font-heading text-2xl mb-3">Recent orders</h2>
        <div className="grid gap-2">
          {orders.length === 0 && <p className="text-muted-foreground text-sm">No orders yet. <Link to="/" className="text-primary underline">Order now</Link>.</p>}
          {orders.slice(0, 10).map((o) => (
            <Link key={o.id} to={`/track/${o.id}`} data-testid={`account-order-${o.id}`} className="flex justify-between items-center p-3 rounded-xl border border-border hover:bg-secondary">
              <div>
                <div className="font-heading">#{o.order_number}</div>
                <div className="text-xs text-muted-foreground">{statusLabel(o.order_status)} · Table {o.table_number}</div>
              </div>
              <div className="font-mono text-sm">₹{o.total_amount.toFixed(0)}</div>
            </Link>
          ))}
        </div>
      </section>

      <section className="bg-card border border-border rounded-2xl p-5">
        <h2 className="font-heading text-2xl mb-3">Points history</h2>
        <div className="grid gap-1">
          {history.length === 0 && <p className="text-muted-foreground text-sm">No transactions yet.</p>}
          {history.slice(0, 15).map((h) => (
            <div key={h.id} className="flex justify-between text-sm py-1">
              <span>{h.description}</span>
              <span className={`font-mono ${h.points > 0 ? "text-green-700" : "text-destructive"}`}>{h.points > 0 ? "+" : ""}{h.points}</span>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}

function Stat({ label, value, testid, icon }) {
  return (
    <div data-testid={testid} className="bg-card border border-border rounded-2xl p-4">
      <div className="flex items-center gap-2 text-xs font-mono uppercase tracking-[0.15em] text-muted-foreground">{icon} {label}</div>
      <div className="mt-1 text-3xl font-heading">{value}</div>
    </div>
  );
}
