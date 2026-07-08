import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Plus, Trash2 } from "lucide-react";
import { apiAdmin } from "@/lib/api";

const EMPTY = { reward_name: "", description: "", points_required: 100, reward_type: "free_item", discount_amount: 0, is_active: true };

export default function LoyaltyPage() {
  const [rewards, setRewards] = useState([]);
  const [form, setForm] = useState(EMPTY);

  const load = () => apiAdmin.get("/rewards").then(({ data }) => setRewards(data));
  useEffect(() => { load(); }, []);

  const create = async () => {
    if (!form.reward_name.trim()) return toast.error("Name required");
    await apiAdmin.post("/rewards", {
      ...form,
      points_required: Number(form.points_required),
      discount_amount: Number(form.discount_amount),
    });
    toast.success("Reward added");
    setForm(EMPTY); load();
  };

  const remove = async (r) => {
    if (!confirm(`Delete "${r.reward_name}"?`)) return;
    await apiAdmin.delete(`/rewards/${r.id}`);
    toast.success("Deleted"); load();
  };

  return (
    <div className="space-y-4">
      <div>
        <div className="text-[10px] font-mono uppercase tracking-[0.2em] text-primary">Rewards</div>
        <h1 className="text-3xl font-heading">Loyalty program</h1>
        <p className="text-sm text-muted-foreground mt-1">Customers earn 10 points per ₹100 spent (min order ₹100). Set rewards below.</p>
      </div>

      <div className="bg-card border border-border rounded-xl p-4 grid grid-cols-1 md:grid-cols-6 gap-2 items-end">
        <input data-testid="rew-name" placeholder="Reward name" value={form.reward_name} onChange={(e) => setForm({ ...form, reward_name: e.target.value })} className="md:col-span-2 h-10 px-3 rounded-md border border-border bg-background text-sm" />
        <input data-testid="rew-desc" placeholder="Description" value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} className="md:col-span-2 h-10 px-3 rounded-md border border-border bg-background text-sm" />
        <input data-testid="rew-points" type="number" placeholder="Points" value={form.points_required} onChange={(e) => setForm({ ...form, points_required: e.target.value })} className="h-10 px-3 rounded-md border border-border bg-background text-sm" />
        <select data-testid="rew-type" value={form.reward_type} onChange={(e) => setForm({ ...form, reward_type: e.target.value })} className="h-10 px-3 rounded-md border border-border bg-background text-sm">
          <option value="free_item">Free Item</option>
          <option value="discount">₹ Discount</option>
        </select>
        {form.reward_type === "discount" && (
          <input data-testid="rew-discount" type="number" placeholder="Discount ₹" value={form.discount_amount} onChange={(e) => setForm({ ...form, discount_amount: e.target.value })} className="h-10 px-3 rounded-md border border-border bg-background text-sm md:col-span-1" />
        )}
        <button data-testid="rew-add-btn" onClick={create} className="h-10 rounded-md bg-primary text-primary-foreground text-sm flex items-center justify-center gap-1 md:col-span-1"><Plus className="w-4 h-4" /> Add</button>
      </div>

      <div className="bg-card border border-border rounded-xl divide-y divide-border">
        {rewards.map((r) => (
          <div key={r.id} data-testid={`rew-row-${r.id}`} className="p-3 flex items-center gap-3">
            <div className="flex-1">
              <div className="font-medium">{r.reward_name}</div>
              <div className="text-xs text-muted-foreground">{r.description} · {r.reward_type === "discount" ? `₹${r.discount_amount} off` : "Free item"}</div>
            </div>
            <div className="font-mono text-sm">{r.points_required} pts</div>
            <button data-testid={`rew-del-${r.id}`} onClick={() => remove(r)} className="w-8 h-8 grid place-items-center rounded-md border border-destructive text-destructive"><Trash2 className="w-4 h-4" /></button>
          </div>
        ))}
        {rewards.length === 0 && <div className="p-6 text-muted-foreground text-sm">No rewards yet.</div>}
      </div>
    </div>
  );
}
