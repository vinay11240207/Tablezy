import { useState } from "react";
import { useNavigate, Navigate } from "react-router-dom";
import { Coffee } from "lucide-react";
import { toast } from "sonner";
import { useAdminAuth } from "@/lib/contexts";

export default function AdminLoginPage() {
  const { admin, login } = useAdminAuth();
  const nav = useNavigate();
  const [f, setF] = useState({ email: "admin@carolinalounge.com", password: "" });
  const [busy, setBusy] = useState(false);

  if (admin) return <Navigate to="/admin/dashboard" replace />;

  const submit = async (e) => {
    e.preventDefault();
    setBusy(true);
    try {
      await login(f.email.trim(), f.password);
      toast.success("Welcome!");
      nav("/admin/dashboard");
    } catch (e) {
      toast.error(e?.response?.data?.detail || "Login failed");
    } finally { setBusy(false); }
  };

  return (
    <div className="min-h-screen bg-background grainy grid place-items-center p-6">
      <div className="w-full max-w-md bg-card border border-border rounded-2xl p-8 shadow-sm animate-fade-up">
        <div className="flex items-center gap-3 mb-6">
          <div className="w-11 h-11 rounded-full bg-primary text-primary-foreground grid place-items-center">
            <Coffee className="w-6 h-6" strokeWidth={1.5} />
          </div>
          <div>
            <div className="font-heading text-2xl leading-none">CAROLINA Lounge</div>
            <div className="text-[10px] font-mono uppercase tracking-[0.2em] text-muted-foreground">Admin Console</div>
          </div>
        </div>
        <h1 className="text-3xl font-heading mb-1">Sign in</h1>
        <p className="text-sm text-muted-foreground mb-5">Manage orders, menu, and loyalty program.</p>
        <form onSubmit={submit} className="space-y-4">
          <label className="block">
            <span className="text-xs font-mono uppercase tracking-[0.15em] text-muted-foreground">Email</span>
            <input data-testid="admin-login-email" value={f.email} onChange={(e) => setF({ ...f, email: e.target.value })} className="mt-1 w-full h-11 px-3 rounded-md border border-border bg-background" />
          </label>
          <label className="block">
            <span className="text-xs font-mono uppercase tracking-[0.15em] text-muted-foreground">Password</span>
            <input data-testid="admin-login-password" type="password" value={f.password} onChange={(e) => setF({ ...f, password: e.target.value })} className="mt-1 w-full h-11 px-3 rounded-md border border-border bg-background" />
          </label>
          <button data-testid="admin-login-submit" disabled={busy} className="w-full h-11 rounded-md bg-primary text-primary-foreground font-medium disabled:opacity-40">{busy ? "Signing in…" : "Sign in"}</button>
        </form>
        <p className="text-xs text-muted-foreground mt-4 text-center">Demo: admin@carolinalounge.com / carolina123</p>
      </div>
    </div>
  );
}
