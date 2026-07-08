import { NavLink, Outlet, useNavigate } from "react-router-dom";
import { LayoutDashboard, ClipboardList, History, UtensilsCrossed, Gift, HelpCircle, LogOut, Coffee, Users } from "lucide-react";
import { useAdminAuth } from "@/lib/contexts";

const nav = [
  { to: "/admin/dashboard", label: "Dashboard", icon: LayoutDashboard, testid: "nav-dashboard" },
  { to: "/admin/orders", label: "Orders", icon: ClipboardList, testid: "nav-orders" },
  { to: "/admin/history", label: "Order History", icon: History, testid: "nav-history" },
  { to: "/admin/menu", label: "Menu", icon: UtensilsCrossed, testid: "nav-menu" },
  { to: "/admin/customers", label: "Customers", icon: Users, testid: "nav-customers" },
  { to: "/admin/loyalty", label: "Loyalty", icon: Gift, testid: "nav-loyalty" },
  { to: "/admin/help", label: "Help", icon: HelpCircle, testid: "nav-help" },
];

export default function AdminShell() {
  const { admin, logout } = useAdminAuth();
  const navigate = useNavigate();

  return (
    <div className="min-h-screen bg-background flex">
      <aside className="w-60 border-r border-border bg-card sticky top-0 h-screen flex flex-col">
        <div className="p-5 border-b border-border">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-full bg-primary text-primary-foreground grid place-items-center">
              <Coffee className="w-4 h-4" strokeWidth={1.5} />
            </div>
            <div>
              <div className="font-heading text-lg leading-none">Tablezy</div>
              <div className="text-[10px] font-mono uppercase tracking-[0.2em] text-muted-foreground">Admin</div>
            </div>
          </div>
        </div>
        <nav className="flex-1 py-2 px-2 space-y-0.5">
          {nav.map((n) => (
            <NavLink
              key={n.to}
              to={n.to}
              data-testid={n.testid}
              className={({ isActive }) => `flex items-center gap-2 h-9 px-3 rounded-md text-sm transition-colors ${isActive ? "bg-primary text-primary-foreground" : "text-foreground hover:bg-secondary"}`}
            >
              <n.icon className="w-4 h-4" strokeWidth={1.5} />
              {n.label}
            </NavLink>
          ))}
        </nav>
        <div className="p-3 border-t border-border">
          <div className="text-xs text-muted-foreground mb-2 truncate">{admin?.email}</div>
          <button
            onClick={() => { logout(); navigate("/admin/login"); }}
            data-testid="admin-logout-btn"
            className="w-full h-9 rounded-md border border-border flex items-center justify-center gap-2 text-sm hover:bg-secondary"
          >
            <LogOut className="w-4 h-4" /> Sign out
          </button>
        </div>
      </aside>
      <main className="flex-1 p-6 overflow-x-auto">
        <Outlet />
      </main>
    </div>
  );
}
