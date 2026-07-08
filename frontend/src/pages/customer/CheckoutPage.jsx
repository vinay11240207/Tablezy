import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";
import { api } from "@/lib/api";
import { useCart, useCustomerAuth } from "@/lib/contexts";

const TAX_RATE = 0.05;

export default function CheckoutPage() {
  const { items, subtotal, clear } = useCart();
  const { customer } = useCustomerAuth();
  const nav = useNavigate();
  const [form, setForm] = useState({ customer_name: "", mobile_number: "", table_number: "" });
  const [submitting, setSubmitting] = useState(false);
  const [rewards, setRewards] = useState([]);
  const [selectedReward, setSelectedReward] = useState(null);

  useEffect(() => {
    if (customer) setForm((f) => ({ ...f, customer_name: customer.name, mobile_number: customer.mobile_number }));
  }, [customer]);

  useEffect(() => {
    if (customer) api.get("/rewards?active_only=true").then(({ data }) => setRewards(data)).catch(() => {});
  }, [customer]);

  const tax = +(subtotal * TAX_RATE).toFixed(2);
  const rewardDiscount = selectedReward?.reward_type === "discount" ? Number(selectedReward.discount_amount) : 0;
  const total = Math.max(0, +(subtotal + tax - rewardDiscount).toFixed(2));

  const validMobile = /^\d{8,15}$/.test(form.mobile_number.trim());
  const canPlace = items.length > 0 && form.customer_name.trim() && validMobile && form.table_number.trim() && !submitting;

  const place = async () => {
    if (!canPlace) return;
    setSubmitting(true);
    try {
      const payload = {
        customer_name: form.customer_name.trim(),
        mobile_number: form.mobile_number.trim(),
        table_number: form.table_number.trim(),
        items: items.map((i) => ({ menu_item_id: i.id, quantity: i.quantity })),
        reward_id: selectedReward?.id || null,
      };
      const { data } = await api.post("/orders", payload);
      clear();
      toast.success("Order placed!");
      nav(`/order/${data.id}`);
    } catch (e) {
      toast.error(e?.response?.data?.detail || "Failed to place order");
    } finally {
      setSubmitting(false);
    }
  };

  const renderField = (name, label, opts = {}) => (
    <label className="block">
      <span className="text-xs font-mono uppercase tracking-[0.15em] text-muted-foreground">{label}</span>
      <input
        data-testid={`checkout-${name}`}
        value={form[name]}
        onChange={(e) => setForm({ ...form, [name]: e.target.value })}
        {...opts}
        className="mt-1 w-full h-12 px-4 rounded-xl bg-card border border-border focus:outline-none focus:ring-2 focus:ring-ring/40"
      />
    </label>
  );

  if (items.length === 0) {
    return <div className="py-16 text-center text-muted-foreground">Cart is empty. <a className="text-primary underline" href="/">Add items</a></div>;
  }

  return (
    <div className="space-y-6 animate-fade-up">
      <div>
        <div className="text-[10px] font-mono uppercase tracking-[0.2em] text-primary">Almost there</div>
        <h1 className="text-3xl sm:text-4xl font-heading tracking-tight">Confirm your order</h1>
      </div>

      <div className="bg-card border border-border rounded-2xl p-5 space-y-4">
        {renderField("customer_name", "Full name", { placeholder: "e.g. Rahul" })}
        {renderField("mobile_number", "Mobile number", { placeholder: "10-digit number", inputMode: "numeric" })}
        {renderField("table_number", "Table number", { placeholder: "e.g. T05" })}
        {!validMobile && form.mobile_number && (
          <p className="text-xs text-destructive">Enter a valid mobile number.</p>
        )}
      </div>

      {customer && rewards.length > 0 && (
        <div className="bg-card border border-border rounded-2xl p-5 space-y-3">
          <div className="flex items-center justify-between">
            <div>
              <div className="text-xs font-mono uppercase tracking-[0.15em] text-primary">Loyalty</div>
              <div className="font-heading text-lg">Apply a reward</div>
            </div>
            <div className="text-sm font-mono">{customer.total_points} pts</div>
          </div>
          <div className="grid gap-2">
            <button
              data-testid="reward-none"
              onClick={() => setSelectedReward(null)}
              className={`h-11 rounded-xl border text-sm ${!selectedReward ? "bg-primary text-primary-foreground border-primary" : "border-border hover:bg-secondary"}`}
            >No reward</button>
            {rewards.map((r) => {
              const affordable = customer.total_points >= r.points_required;
              return (
                <button
                  key={r.id}
                  data-testid={`reward-${r.id}`}
                  disabled={!affordable}
                  onClick={() => setSelectedReward(r)}
                  className={`h-14 px-4 rounded-xl border text-left flex items-center justify-between ${selectedReward?.id === r.id ? "bg-primary text-primary-foreground border-primary" : "border-border hover:bg-secondary"} disabled:opacity-40`}
                >
                  <div>
                    <div className="text-sm font-medium">{r.reward_name}</div>
                    <div className="text-xs opacity-80">{r.description}</div>
                  </div>
                  <div className="font-mono text-xs">{r.points_required} pts</div>
                </button>
              );
            })}
          </div>
        </div>
      )}

      <div className="bg-card border border-border rounded-2xl p-5 space-y-2 font-mono text-sm">
        <div className="flex justify-between"><span>Subtotal</span><span>₹{subtotal.toFixed(2)}</span></div>
        <div className="flex justify-between"><span>Tax (5%)</span><span>₹{tax.toFixed(2)}</span></div>
        {rewardDiscount > 0 && <div className="flex justify-between text-primary"><span>Reward discount</span><span>-₹{rewardDiscount.toFixed(2)}</span></div>}
        <div className="h-px bg-border my-1" />
        <div className="flex justify-between font-heading text-lg"><span>Total</span><span>₹{total.toFixed(2)}</span></div>
      </div>

      <button
        data-testid="place-order-btn"
        disabled={!canPlace}
        onClick={place}
        className="w-full h-14 rounded-full bg-primary text-primary-foreground font-medium hover:opacity-90 active:scale-[0.98] transition disabled:opacity-40"
      >
        {submitting ? "Placing…" : `Place order — ₹${total.toFixed(0)}`}
      </button>
    </div>
  );
}
