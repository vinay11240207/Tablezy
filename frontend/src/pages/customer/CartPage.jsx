import { Link, useNavigate } from "react-router-dom";
import { Minus, Plus, Trash2, ShoppingBag } from "lucide-react";
import { useCart } from "@/lib/contexts";

const TAX_RATE = 0.05;

export default function CartPage() {
  const { items, inc, dec, remove, subtotal, clear, rewardLine } = useCart();
  const nav = useNavigate();
  const tax = +(subtotal * TAX_RATE).toFixed(2);
  const rewardDiscount = rewardLine?.reward_type === "discount" ? Number(rewardLine.discount_amount) : 0;
  const total = +Math.max(0, subtotal + tax - rewardDiscount).toFixed(2);

  if (items.length === 0) {
    return (
      <div className="py-16 text-center space-y-4 animate-fade-up">
        <ShoppingBag className="w-12 h-12 mx-auto text-muted-foreground" />
        <h2 className="font-heading text-3xl">Your cart is empty</h2>
        <p className="text-muted-foreground">Browse the menu and add something delicious.</p>
        <Link to="/" data-testid="cart-empty-browse" className="inline-block h-11 px-6 rounded-full bg-primary text-primary-foreground leading-[44px] font-medium">Browse menu</Link>
      </div>
    );
  }

  return (
    <div className="space-y-6 animate-fade-up">
      <div>
        <div className="text-[10px] font-mono uppercase tracking-[0.2em] text-primary">Your Cart</div>
        <h1 className="text-3xl sm:text-4xl font-heading tracking-tight">Review your order</h1>
      </div>

      <div className="space-y-3">
        {items.map((i) => (
          <div key={i.id} data-testid={`cart-row-${i.id}`} className={`bg-card border rounded-2xl p-3 flex gap-3 ${i.is_reward ? "border-accent bg-accent/10" : "border-border"}`}>
            <div className="w-16 h-16 rounded-lg bg-secondary overflow-hidden grid place-items-center">
              {i.image_url ? <img src={i.image_url} alt={i.name} className="w-full h-full object-cover" /> : (i.is_reward ? <span className="text-2xl">🎁</span> : null)}
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex justify-between gap-2">
                <div className="font-heading text-base">{i.name}</div>
                <div className="font-mono text-sm">{i.is_reward ? "FREE" : `₹${(i.price * i.quantity).toFixed(0)}`}</div>
              </div>
              <div className="mt-2 flex items-center justify-between">
                {i.is_reward ? (
                  <div className="text-xs text-muted-foreground">Uses {i.points_required} pts on order</div>
                ) : (
                  <div className="flex items-center gap-2 rounded-full border border-border">
                    <button data-testid={`cart-dec-${i.id}`} onClick={() => dec(i.id)} className="w-8 h-8 grid place-items-center"><Minus className="w-4 h-4" /></button>
                    <span className="min-w-[20px] text-center font-mono text-sm">{i.quantity}</span>
                    <button data-testid={`cart-inc-${i.id}`} onClick={() => inc(i.id)} className="w-8 h-8 grid place-items-center"><Plus className="w-4 h-4" /></button>
                  </div>
                )}
                <button data-testid={`cart-remove-${i.id}`} onClick={() => remove(i.id)} className="text-destructive text-xs flex items-center gap-1 hover:underline">
                  <Trash2 className="w-3.5 h-3.5" /> Remove
                </button>
              </div>
            </div>
          </div>
        ))}
      </div>

      <div className="bg-card border border-border rounded-2xl p-5 space-y-2 font-mono text-sm">
        <div className="flex justify-between"><span>Subtotal</span><span data-testid="cart-subtotal">₹{subtotal.toFixed(2)}</span></div>
        <div className="flex justify-between"><span>Tax (5% GST)</span><span data-testid="cart-tax">₹{tax.toFixed(2)}</span></div>
        {rewardDiscount > 0 && (
          <div className="flex justify-between text-primary"><span>Reward discount</span><span>-₹{rewardDiscount.toFixed(2)}</span></div>
        )}
        <div className="h-px bg-border my-1" />
        <div className="flex justify-between font-heading text-lg"><span>Total</span><span data-testid="cart-total">₹{total.toFixed(2)}</span></div>
      </div>

      <div className="flex gap-3">
        <button onClick={clear} data-testid="cart-clear-btn" className="h-12 px-5 rounded-full border border-border hover:bg-secondary text-sm">Clear cart</button>
        <button
          data-testid="cart-checkout-btn"
          onClick={() => nav("/checkout")}
          className="flex-1 h-12 rounded-full bg-primary text-primary-foreground font-medium hover:opacity-90 active:scale-[0.98] transition"
        >
          Continue — ₹{total.toFixed(0)}
        </button>
      </div>
    </div>
  );
}
