import { Outlet, Link, useLocation } from "react-router-dom";
import { ShoppingBag, User, Coffee } from "lucide-react";
import { useCart, useCustomerAuth } from "@/lib/contexts";

export default function CustomerShell() {
  const { count } = useCart();
  const { customer } = useCustomerAuth();
  const loc = useLocation();
  const isAdmin = loc.pathname.startsWith("/admin");
  if (isAdmin) return <Outlet />;

  return (
    <div className="min-h-screen bg-background grainy">
      <header className="sticky top-0 z-30 backdrop-blur-xl bg-background/80 border-b border-border">
        <div className="max-w-4xl mx-auto px-4 h-16 flex items-center justify-between">
          <Link to="/" data-testid="brand-link" className="flex items-center gap-2">
            <div className="w-9 h-9 rounded-full bg-primary text-primary-foreground grid place-items-center">
              <Coffee className="w-5 h-5" strokeWidth={2} />
            </div>
            <div className="leading-tight">
              <div className="font-heading text-xl"># CAROLINA Lounge</div>
              <div className="text-[10px] font-mono uppercase tracking-[0.2em] text-muted-foreground">Cafe · Order</div>
            </div>
          </Link>
          <nav className="flex items-center gap-2">
            <Link
              to="/account"
              data-testid="header-account-link"
              className="h-10 px-3 rounded-full border border-border flex items-center gap-2 text-sm hover:bg-secondary transition-colors"
            >
              <User className="w-4 h-4" strokeWidth={2} />
              {customer ? (
                <span className="hidden sm:inline">{customer.name.split(" ")[0]}</span>
              ) : (
                <span className="hidden sm:inline">Sign in</span>
              )}
              {customer && (
                <span data-testid="header-points-pill" className="ml-1 px-2 py-0.5 rounded-full bg-accent text-accent-foreground text-xs font-mono">
                  {customer.total_points} pts
                </span>
              )}
            </Link>
            <Link
              to="/cart"
              data-testid="header-cart-link"
              className="relative h-10 px-4 rounded-full bg-primary text-primary-foreground flex items-center gap-2 hover:opacity-90 active:scale-95 transition-all"
            >
              <ShoppingBag className="w-4 h-4" strokeWidth={2} />
              <span className="text-sm font-medium">Cart</span>
              {count > 0 && (
                <span data-testid="cart-badge" className="min-w-[22px] h-[22px] px-1.5 rounded-full bg-accent text-accent-foreground text-xs font-mono grid place-items-center">
                  {count}
                </span>
              )}
            </Link>
          </nav>
        </div>
      </header>
      <main className="max-w-4xl mx-auto px-4 pb-24 pt-6">
        <Outlet />
      </main>
    </div>
  );
}
