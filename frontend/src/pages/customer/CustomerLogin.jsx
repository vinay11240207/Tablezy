import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { toast } from "sonner";
import { useCustomerAuth } from "@/lib/contexts";

export default function CustomerLogin() {
  const { login } = useCustomerAuth();
  const nav = useNavigate();
  const [f, setF] = useState({ mobile_number: "", password: "" });
  const [busy, setBusy] = useState(false);

  const submit = async (e) => {
    e.preventDefault();
    setBusy(true);
    try {
      await login(f.mobile_number.trim(), f.password);
      toast.success("Welcome back!");
      nav("/account");
    } catch (e) {
      toast.error(e?.response?.data?.detail || "Login failed");
    } finally { setBusy(false); }
  };

  return (
    <div className="max-w-md mx-auto py-8 animate-fade-up">
      <div className="text-[10px] font-mono uppercase tracking-[0.2em] text-primary">Sign in</div>
      <h1 className="text-4xl font-heading mb-6">Welcome back</h1>
      <form onSubmit={submit} className="bg-card border border-border rounded-2xl p-6 space-y-4">
        <label className="block">
          <span className="text-xs font-mono uppercase tracking-[0.15em] text-muted-foreground">Mobile number</span>
          <input data-testid="cust-login-mobile" value={f.mobile_number} onChange={(e) => setF({ ...f, mobile_number: e.target.value })} className="mt-1 w-full h-12 px-4 rounded-xl border border-border bg-background" />
        </label>
        <label className="block">
          <span className="text-xs font-mono uppercase tracking-[0.15em] text-muted-foreground">Password</span>
          <input data-testid="cust-login-password" type="password" value={f.password} onChange={(e) => setF({ ...f, password: e.target.value })} className="mt-1 w-full h-12 px-4 rounded-xl border border-border bg-background" />
        </label>
        <button data-testid="cust-login-submit" disabled={busy} className="w-full h-12 rounded-full bg-primary text-primary-foreground font-medium disabled:opacity-40">{busy ? "Signing in…" : "Sign in"}</button>
      </form>
      <p className="text-sm text-muted-foreground mt-4 text-center">New here? <Link to="/account/register" data-testid="cust-goto-register" className="text-primary underline">Create an account</Link></p>
    </div>
  );
}
