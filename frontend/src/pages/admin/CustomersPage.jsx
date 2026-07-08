import { useEffect, useState } from "react";
import { Users } from "lucide-react";
import { apiAdmin } from "@/lib/api";
import { statusLabel } from "@/pages/customer/OrderSuccessPage";

export default function CustomersPage() {
  const [rows, setRows] = useState([]);
  const [selected, setSelected] = useState(null);
  const [orders, setOrders] = useState([]);
  const [q, setQ] = useState("");

  useEffect(() => {
    apiAdmin.get("/customers").then(({ data }) => setRows(data));
  }, []);

  const open = async (c) => {
    setSelected(c);
    const { data } = await apiAdmin.get(`/customers/${c.id}/orders`);
    setOrders(data);
  };

  const filtered = rows.filter((c) =>
    !q.trim() ||
    c.name.toLowerCase().includes(q.toLowerCase()) ||
    c.mobile_number.includes(q.trim())
  );

  return (
    <div className="space-y-4">
      <div>
        <div className="text-[10px] font-mono uppercase tracking-[0.2em] text-primary">CRM</div>
        <h1 className="text-3xl font-heading flex items-center gap-2"><Users className="w-6 h-6" strokeWidth={1.5}/> Customers</h1>
      </div>
      <input
        data-testid="customer-search"
        placeholder="Search name or mobile…"
        value={q}
        onChange={(e) => setQ(e.target.value)}
        className="h-9 px-3 rounded-md border border-border bg-background text-sm min-w-[260px]"
      />
      <div className="bg-card border border-border rounded-xl divide-y divide-border">
        <div className="p-3 grid grid-cols-6 text-xs font-mono uppercase tracking-[0.15em] text-muted-foreground">
          <div className="col-span-2">Name</div><div>Mobile</div><div className="text-right">Orders</div><div className="text-right">Points</div><div className="text-right">Joined</div>
        </div>
        {filtered.map((c) => (
          <button
            key={c.id}
            data-testid={`customer-row-${c.id}`}
            onClick={() => open(c)}
            className="w-full text-left p-3 grid grid-cols-6 text-sm hover:bg-secondary transition-colors"
          >
            <div className="col-span-2 font-medium truncate">{c.name}</div>
            <div className="font-mono">{c.mobile_number}</div>
            <div className="text-right font-mono">{c.orders_count}</div>
            <div className="text-right font-mono text-primary">{c.total_points}</div>
            <div className="text-right text-xs text-muted-foreground">{new Date(c.created_at).toLocaleDateString()}</div>
          </button>
        ))}
        {filtered.length === 0 && <div className="p-6 text-muted-foreground text-sm">No customers.</div>}
      </div>

      {selected && (
        <div className="fixed inset-0 bg-black/40 grid place-items-center z-40 p-4" onClick={() => setSelected(null)}>
          <div onClick={(e) => e.stopPropagation()} className="bg-card border border-border rounded-2xl max-w-lg w-full p-5 space-y-3 max-h-[80vh] overflow-y-auto">
            <div className="flex justify-between">
              <div>
                <div className="font-heading text-2xl">{selected.name}</div>
                <div className="text-sm text-muted-foreground">{selected.mobile_number} · {selected.total_points} pts</div>
              </div>
              <button data-testid="customer-modal-close" onClick={() => setSelected(null)} className="text-sm text-muted-foreground">✕</button>
            </div>
            <div className="text-xs font-mono uppercase tracking-[0.15em] text-muted-foreground pt-2">Order history</div>
            <div className="divide-y divide-border">
              {orders.map((o) => (
                <div key={o.id} className="py-2 flex justify-between text-sm">
                  <div>
                    <div className="font-medium">#{o.order_number}</div>
                    <div className="text-xs text-muted-foreground">{statusLabel(o.order_status)} · {new Date(o.created_at).toLocaleString()}</div>
                  </div>
                  <div className="font-mono">₹{o.total_amount.toFixed(0)}</div>
                </div>
              ))}
              {orders.length === 0 && <div className="text-sm text-muted-foreground py-2">No orders yet.</div>}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
