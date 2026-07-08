import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Plus, Trash2, Edit3, X } from "lucide-react";
import { apiAdmin } from "@/lib/api";

const EMPTY = { name: "", description: "", price: "", image_url: "", category_id: "", is_available: true };

export default function MenuManagePage() {
  const [items, setItems] = useState([]);
  const [cats, setCats] = useState([]);
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState(EMPTY);
  const [newCat, setNewCat] = useState("");

  const load = async () => {
    const { data } = await apiAdmin.get("/menu");
    setItems(data.items); setCats(data.categories);
  };
  useEffect(() => { load(); }, []);

  const startAdd = () => { setEditing(null); setForm({ ...EMPTY, category_id: cats[0]?.id || "" }); setShowForm(true); };
  const startEdit = (m) => { setEditing(m); setForm({ ...m, price: String(m.price) }); setShowForm(true); };

  const save = async () => {
    const payload = { ...form, price: Number(form.price) || 0 };
    if (!payload.name.trim() || !payload.category_id) return toast.error("Name and category required");
    try {
      if (editing) await apiAdmin.put(`/menu/${editing.id}`, payload);
      else await apiAdmin.post("/menu", payload);
      toast.success("Saved");
      setShowForm(false); setEditing(null); setForm(EMPTY); load();
    } catch (e) { toast.error(e?.response?.data?.detail || "Failed"); }
  };

  const remove = async (m) => {
    if (!confirm(`Delete "${m.name}"?`)) return;
    await apiAdmin.delete(`/menu/${m.id}`);
    toast.success("Deleted"); load();
  };

  const toggleAvail = async (m) => {
    await apiAdmin.patch(`/menu/${m.id}/availability?is_available=${!m.is_available}`);
    load();
  };

  const addCategory = async () => {
    if (!newCat.trim()) return;
    await apiAdmin.post("/categories", { name: newCat.trim(), is_active: true });
    setNewCat(""); toast.success("Category added"); load();
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <div className="text-[10px] font-mono uppercase tracking-[0.2em] text-primary">Curation</div>
          <h1 className="text-3xl font-heading">Menu management</h1>
        </div>
        <button data-testid="add-menu-item-btn" onClick={startAdd} className="h-10 px-4 rounded-md bg-primary text-primary-foreground text-sm flex items-center gap-2">
          <Plus className="w-4 h-4" /> Add item
        </button>
      </div>

      <div className="bg-card border border-border rounded-xl p-4">
        <div className="text-xs font-mono uppercase tracking-[0.15em] text-muted-foreground mb-2">Categories</div>
        <div className="flex flex-wrap gap-2 items-center">
          {cats.map((c) => <span key={c.id} className="text-xs px-2 py-1 bg-secondary rounded-md">{c.name}</span>)}
          <input data-testid="new-category-input" value={newCat} onChange={(e) => setNewCat(e.target.value)} placeholder="New category" className="h-8 px-2 text-sm rounded-md border border-border bg-background" />
          <button data-testid="add-category-btn" onClick={addCategory} className="h-8 px-3 text-sm rounded-md border border-border">Add</button>
        </div>
      </div>

      <div className="bg-card border border-border rounded-xl divide-y divide-border">
        {items.map((m) => {
          const cat = cats.find((c) => c.id === m.category_id);
          return (
            <div key={m.id} data-testid={`menu-row-${m.id}`} className="p-3 flex items-center gap-3">
              <div className="w-12 h-12 rounded-md bg-secondary overflow-hidden shrink-0">
                {m.image_url && <img src={m.image_url} alt="" className="w-full h-full object-cover" />}
              </div>
              <div className="flex-1 min-w-0">
                <div className="font-medium truncate">{m.name}</div>
                <div className="text-xs text-muted-foreground truncate">{cat?.name} · ₹{m.price}</div>
              </div>
              <label className="flex items-center gap-1 text-xs mr-2">
                <input data-testid={`avail-toggle-${m.id}`} type="checkbox" checked={m.is_available} onChange={() => toggleAvail(m)} /> Available
              </label>
              <button data-testid={`edit-${m.id}`} onClick={() => startEdit(m)} className="w-8 h-8 grid place-items-center rounded-md border border-border hover:bg-secondary"><Edit3 className="w-4 h-4" /></button>
              <button data-testid={`del-${m.id}`} onClick={() => remove(m)} className="w-8 h-8 grid place-items-center rounded-md border border-destructive text-destructive hover:bg-destructive/10"><Trash2 className="w-4 h-4" /></button>
            </div>
          );
        })}
        {items.length === 0 && <div className="p-6 text-muted-foreground text-sm">No menu items yet.</div>}
      </div>

      {showForm && (
        <div className="fixed inset-0 bg-black/40 grid place-items-center z-40 p-4">
          <div className="bg-card border border-border rounded-2xl w-full max-w-md p-5 space-y-3">
            <div className="flex items-center justify-between">
              <div className="font-heading text-xl">{editing ? "Edit item" : "Add item"}</div>
              <button data-testid="close-form" onClick={() => setShowForm(false)} className="w-8 h-8 grid place-items-center rounded-md border border-border"><X className="w-4 h-4" /></button>
            </div>
            {["name", "description", "price", "image_url"].map((k) => (
              <label key={k} className="block">
                <span className="text-xs font-mono uppercase tracking-[0.15em] text-muted-foreground">{k.replace("_", " ")}</span>
                <input data-testid={`form-${k}`} value={form[k]} onChange={(e) => setForm({ ...form, [k]: e.target.value })} className="mt-1 w-full h-10 px-3 rounded-md border border-border bg-background" />
              </label>
            ))}
            <label className="block">
              <span className="text-xs font-mono uppercase tracking-[0.15em] text-muted-foreground">Category</span>
              <select data-testid="form-category" value={form.category_id} onChange={(e) => setForm({ ...form, category_id: e.target.value })} className="mt-1 w-full h-10 px-3 rounded-md border border-border bg-background">
                <option value="">-- select --</option>
                {cats.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
            </label>
            <label className="flex items-center gap-2 text-sm">
              <input data-testid="form-available" type="checkbox" checked={form.is_available} onChange={(e) => setForm({ ...form, is_available: e.target.checked })} /> Available
            </label>
            <button data-testid="form-save" onClick={save} className="w-full h-10 rounded-md bg-primary text-primary-foreground text-sm">Save item</button>
          </div>
        </div>
      )}
    </div>
  );
}
