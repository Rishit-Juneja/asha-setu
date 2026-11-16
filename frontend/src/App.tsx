import { Navigate, Route, Routes } from "react-router-dom";
import { useAuth } from "./auth";
import { AppLayout } from "./components/AppLayout";
import { Logo } from "./components/Logo";
import { Spinner } from "./components/Spinner";
import { Call } from "./pages/Call";
import { Dashboard } from "./pages/Dashboard";
import { Home } from "./pages/Home";
import { Login } from "./pages/Login";
import { Readback } from "./pages/Readback";
import { Record } from "./pages/Record";
import { Review } from "./pages/Review";
import { VisitDetail } from "./pages/VisitDetail";
import { Visits } from "./pages/Visits";

function AuthLoading() {
  return (
    <div className="grid min-h-dvh place-items-center px-6">
      <div className="flex flex-col items-center gap-5">
        <Logo />
        <Spinner className="size-6 text-pine" />
        <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-moss">
          Opening your field book
        </p>
      </div>
    </div>
  );
}

function RequireAuth() {
  const { worker, ready } = useAuth();
  if (!ready) return <AuthLoading />;
  if (!worker) return <Navigate to="/login" replace />;
  return <AppLayout />;
}

function LoginRoute() {
  const { worker, ready, isSupervisor } = useAuth();
  if (!ready) return <AuthLoading />;
  if (worker) {
    return <Navigate to={isSupervisor ? "/dashboard" : "/"} replace />;
  }
  return <Login />;
}

export function App() {
  return (
    <Routes>
      <Route path="/login" element={<LoginRoute />} />
      <Route element={<RequireAuth />}>
        <Route index element={<Home />} />
        <Route path="record" element={<Record />} />
        <Route path="call" element={<Call />} />
        <Route path="review/:id" element={<Review />} />
        <Route path="readback/:id" element={<Readback />} />
        <Route path="visits" element={<Visits />} />
        <Route path="visits/:id" element={<VisitDetail />} />
        <Route path="dashboard" element={<Dashboard />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Route>
    </Routes>
  );
}
