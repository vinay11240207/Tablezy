import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";
import { api } from "@/lib/api";
import { useCart, useCustomerAuth } from "@/lib/contexts";

const TAX_RATE = 0.05;

export default function CheckoutPage() {
  const { items, subtotal, clear, rewardLine } = useCart();
  const { customer } = useCustomerAuth();
  const nav = useNavigate();
  const [form, setForm] = useState({ customer_name: "", mobile_number: "", table_number: "" });
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (customer) setForm((f) => ({ ...f, customer_name: customer.name, mobile_number: customer.mobile_number }));
  }, [customer]);

  const tax = +(subtotal * TAX_RATE).toFixed(2);
  const rewardDiscount = rewardLine?.reward_type === "discount" ? Number(rewardLine.discount_amount) : 0;
  const total = Math.max(0, +(subtotal + tax - rewardDiscount).toFixed(2));
  const foodItems = items.filter((i) => !i.is_reward);

  const validMobile = /^\d{8,15}$/.test(form.mobile_number.trim());
  const canPlace = foodItems.length > 0 && form.customer_name.trim() && validMobile && form.table_number.trim() && !submitting;

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

  const place = async () => {
    if (!canPlace) return;
    setSubmitting(true);
    try {
      const payload = {
        customer_name: form.customer_name.trim(),
        mobile_number: form.mobile_number.trim(),
        table_number: form.table_number.trim(),
        items: foodItems.map((i) => ({ menu_item_id: i.id, quantity: i.quantity })),
        reward_id: rewardLine?.reward_id || null,
      };
      const { data } = await api.post("/orders", payload);
      clear();
      toast.success("Order placed!");
      nav(`/order/${data.id}`);
    } catch (e) {
      toast.error(e?.response?.data?.detail || "Failed to place order");
    } finally { setSubmitting(false); }
  };

  if (foodItems.length === 0) {
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
        {!validMobile && form.mobile_number && <p className="text-xs text-destructive">Enter a valid mobile number.</p>}
      </div>

      {rewardLine && (
        <div data-testid="checkout-reward-applied" className="bg-accent/40 border border-accent rounded-2xl p-4 text-sm flex justify-between">
          <span>🎁 Reward applied: <b>{rewardLine.name.replace("🎁 ", "")}</b> ({rewardLine.points_required} pts)</span>
          {rewardLine.reward_type === "discount" && <span className="font-mono">-₹{rewardLine.discount_amount}</span>}
        </div>
      )}

      <div className="bg-card border border-border rounded-2xl p-5 space-y-2 font-mono text-sm">
        <div className="flex justify-between"><span>Subtotal</span><span>₹{subtotal.toFixed(2)}</span></div>
        <div className="flex justify-between"><span>Tax (5%)</span><span>₹{tax.toFixed(2)}</span></div>
        {rewardDiscount > 0 && <div className="flex justify-between text-primary"><span>Reward discount</span><span>-₹{rewardDiscount.toFixed(2)}</span></div>}
        <div className="h-px bg-border my-1" />
        <div className="flex justify-between font-heading text-lg"><span>Total</span><span data-testid="checkout-total">₹{total.toFixed(2)}</span></div>
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
