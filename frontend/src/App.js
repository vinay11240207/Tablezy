import "@/App.css";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { Toaster } from "sonner";
import { CustomerAuthProvider, AdminAuthProvider, CartProvider, useAdminAuth } from "@/lib/contexts";
import CustomerShell from "@/components/customer/CustomerShell";
import MenuPage from "@/pages/customer/MenuPage";
import CartPage from "@/pages/customer/CartPage";
import CheckoutPage from "@/pages/customer/CheckoutPage";
import OrderSuccessPage from "@/pages/customer/OrderSuccessPage";
import OrderTrackPage from "@/pages/customer/OrderTrackPage";
import CustomerLogin from "@/pages/customer/CustomerLogin";
import CustomerRegister from "@/pages/customer/CustomerRegister";
import AccountPage from "@/pages/customer/AccountPage";
import AdminLoginPage from "@/pages/admin/AdminLoginPage";
import AdminShell from "@/pages/admin/AdminShell";
import DashboardPage from "@/pages/admin/DashboardPage";
import OrdersPage from "@/pages/admin/OrdersPage";
import OrderHistoryPage from "@/pages/admin/OrderHistoryPage";
import MenuManagePage from "@/pages/admin/MenuManagePage";
import LoyaltyPage from "@/pages/admin/LoyaltyPage";
import HelpPage from "@/pages/admin/HelpPage";

function AdminGuard({ children }) {
  const { admin, loading } = useAdminAuth();
  if (loading) return <div className="p-10 text-center font-body text-muted-foreground">Loading…</div>;
  if (!admin) return <Navigate to="/admin/login" replace />;
  return children;
}

export default function App() {
  return (
    <BrowserRouter>
      <CustomerAuthProvider>
        <AdminAuthProvider>
          <CartProvider>
            <Toaster position="bottom-center" richColors />
            <Routes>
              {/* Customer */}
              <Route element={<CustomerShell />}>
                <Route path="/" element={<MenuPage />} />
                <Route path="/cart" element={<CartPage />} />
                <Route path="/checkout" element={<CheckoutPage />} />
                <Route path="/order/:orderId" element={<OrderSuccessPage />} />
                <Route path="/track/:orderId" element={<OrderTrackPage />} />
                <Route path="/account" element={<AccountPage />} />
                <Route path="/account/login" element={<CustomerLogin />} />
                <Route path="/account/register" element={<CustomerRegister />} />
              </Route>

              {/* Admin */}
              <Route path="/admin/login" element={<AdminLoginPage />} />
              <Route path="/admin" element={<AdminGuard><AdminShell /></AdminGuard>}>
                <Route index element={<Navigate to="/admin/dashboard" replace />} />
                <Route path="dashboard" element={<DashboardPage />} />
                <Route path="orders" element={<OrdersPage />} />
                <Route path="history" element={<OrderHistoryPage />} />
                <Route path="menu" element={<MenuManagePage />} />
                <Route path="loyalty" element={<LoyaltyPage />} />
                <Route path="help" element={<HelpPage />} />
              </Route>
            </Routes>
          </CartProvider>
        </AdminAuthProvider>
      </CustomerAuthProvider>
    </BrowserRouter>
  );
}
