import { useEffect, useState } from "react";
import {
  CloudOff,
  Home,
  LayoutDashboard,
  ListChecks,
  LogOut,
  Mic,
  RefreshCw,
  WifiOff,
  Phone,
} from "lucide-react";
import {
  Link,
  NavLink,
  Outlet,
  useNavigate,
} from "react-router-dom";
import { useAuth } from "../auth";
import { flushQueue } from "../sync";
import { useOnline, useQueueCount } from "../hooks";
import { useToast } from "../toast";
import { cn, initials, languageOption } from "../utils";
import { Logo } from "./Logo";
import { Spinner } from "./Spinner";

function navClass(active: boolean): string {
  return cn(
    "flex items-center gap-3 rounded-2xl px-3.5 py-3 text-sm font-bold transition",
    active
      ? "bg-pine text-cream shadow-[0_8px_20px_-12px_rgba(15,76,70,0.9)]"
      : "text-ink/65 hover:bg-pine-soft/60 hover:text-ink",
  );
}

function NavItem({
  to,
  label,
  icon: Icon,
  end,
  badge,
}: {
  to: string;
  label: string;
  icon: typeof Home;
  end?: boolean;
  badge?: number;
}) {
  return (
    <NavLink to={to} end={end} className={({ isActive }) => navClass(isActive)}>
      <Icon className="size-[18px]" />
      <span className="flex-1">{label}</span>
      {badge ? (
        <span className="rounded-full bg-saffron px-2 py-0.5 text-[10px] font-extrabold text-pine">
          {badge}
        </span>
      ) : null}
    </NavLink>
  );
}

function BottomItem({
  to,
  label,
  icon: Icon,
  end,
  badge,
}: {
  to: string;
  label: string;
  icon: typeof Home;
  end?: boolean;
  badge?: number;
}) {
  return (
    <NavLink
      to={to}
      end={end}
      className={({ isActive }) =>
        cn(
          "relative flex flex-col items-center gap-1 rounded-2xl px-2 py-2 text-[10px] font-bold transition",
          isActive ? "text-pine" : "text-ink/45",
        )
      }
    >
      <span className="relative">
        <Icon className="size-[21px]" />
        {badge ? (
          <span className="absolute -right-2 -top-1.5 grid min-w-[16px] place-items-center rounded-full bg-saffron px-1 text-[9px] font-extrabold text-pine">
            {badge}
          </span>
        ) : null}
      </span>
      {label}
    </NavLink>
  );
}

function SyncBanner({
  online,
  queueCount,
  syncing,
  onSync,
}: {
  online: boolean;
  queueCount: number;
  syncing: boolean;
  onSync: () => void;
}) {
  if (online && queueCount === 0) return null;
  if (!online) {
    return (
      <div className="mb-4 flex items-start gap-2.5 rounded-2xl bg-ink px-4 py-3 text-sm text-cream shadow-sm">
        <WifiOff className="mt-0.5 size-4 shrink-0 text-saffron" />
        <p>
          <span className="font-bold">Offline mode.</span> New visits are saved
          safely on this phone
          {queueCount > 0 ? ` · ${queueCount} waiting to sync` : ""}.
        </p>
      </div>
    );
  }
  return (
    <div className="mb-4 flex flex-wrap items-center gap-3 rounded-2xl bg-amber-50 px-4 py-3 text-sm text-amber-900 ring-1 ring-amber-200">
      <CloudOff className="size-4 shrink-0" />
      <p className="min-w-0 flex-1 font-semibold">
        {queueCount} saved report{queueCount === 1 ? "" : "s"} waiting to sync.
      </p>
      <button
        type="button"
        onClick={onSync}
        disabled={syncing}
        className="inline-flex items-center gap-1.5 rounded-full bg-amber-900 px-3.5 py-1.5 text-xs font-bold text-amber-50 transition hover:bg-amber-800 disabled:opacity-60"
      >
        {syncing ? (
          <Spinner className="size-3.5" />
        ) : (
          <RefreshCw className="size-3.5" />
        )}
        Sync now
      </button>
    </div>
  );
}

export function AppLayout() {
  const { worker, logout, isSupervisor } = useAuth();
  const navigate = useNavigate();
  const online = useOnline();
  const queueCount = useQueueCount();
  const { notify } = useToast();
  const [syncing, setSyncing] = useState(false);

  useEffect(() => {
    const run = async () => {
      const count = await flushQueue();
      if (count > 0) {
        notify(
          `${count} saved report${count === 1 ? "" : "s"} synced — ready to review.`,
          "success",
        );
      }
    };
    if (navigator.onLine) void run();
    const handleOnline = () => void run();
    window.addEventListener("online", handleOnline);
    return () => window.removeEventListener("online", handleOnline);
  }, [notify]);

  const handleSync = async () => {
    setSyncing(true);
    try {
      const count = await flushQueue();
      if (count > 0) {
        notify(
          `${count} report${count === 1 ? "" : "s"} synced — ready to review.`,
          "success",
        );
      } else if (queueCount > 0) {
        notify("Some reports still need attention. Check All visits.", "error");
      } else {
        notify("Nothing is waiting to sync.", "info");
      }
    } finally {
      setSyncing(false);
    }
  };

  const signOut = () => {
    logout();
    navigate("/login", { replace: true });
  };

  return (
    <div className="min-h-dvh">
      <aside className="fixed inset-y-0 left-0 z-30 hidden w-64 flex-col border-r border-stone-200/70 bg-cream/75 px-4 py-6 backdrop-blur md:flex">
        <Link to={isSupervisor ? "/dashboard" : "/"} className="px-2">
          <Logo />
        </Link>

        <nav className="mt-8 flex-1 space-y-1">
          {!isSupervisor && <NavItem to="/" end label="Today" icon={Home} />}
          {!isSupervisor && (
            <NavItem to="/record" label="Record a visit" icon={Mic} />
          )}
          {!isSupervisor && <NavItem to="/call" label="Call mode" icon={Phone} />}
          <NavItem
            to="/visits"
            label="All visits"
            icon={ListChecks}
            badge={queueCount || undefined}
          />
          {isSupervisor && (
            <NavItem
              to="/dashboard"
              label="Overview"
              icon={LayoutDashboard}
            />
          )}
        </nav>

        {queueCount > 0 && (
          <button
            type="button"
            onClick={handleSync}
            disabled={syncing}
            className="mb-3 flex items-center gap-2.5 rounded-2xl bg-amber-50 px-3.5 py-3 text-left text-xs font-bold text-amber-900 ring-1 ring-amber-200 transition hover:bg-amber-100"
          >
            {syncing ? (
              <Spinner className="size-4" />
            ) : (
              <CloudOff className="size-4" />
            )}
            <span className="flex-1">
              {queueCount} saved offline
              <span className="block text-[10px] font-semibold text-amber-800/70">
                {online ? "Tap to sync" : "Waiting for network"}
              </span>
            </span>
          </button>
        )}

        <div className="rounded-2xl border border-stone-200/80 bg-paper/70 p-3">
          <div className="flex items-center gap-2.5">
            <span className="grid size-9 shrink-0 place-items-center rounded-full bg-pine text-xs font-extrabold text-cream">
              {initials(worker?.name ?? "AS")}
            </span>
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-bold text-ink">
                {worker?.name ?? "Worker"}
              </p>
              <p className="truncate text-[10px] font-semibold uppercase tracking-wider text-moss">
                {isSupervisor ? "Supervisor" : "ASHA worker"}
              </p>
            </div>
            <button
              type="button"
              onClick={signOut}
              className="rounded-xl p-2 text-moss transition hover:bg-rose-50 hover:text-rose-700"
              aria-label="Sign out"
              title="Sign out"
            >
              <LogOut className="size-4" />
            </button>
          </div>
        </div>

        <p className="mt-3 px-2 text-[9px] font-semibold uppercase tracking-[0.14em] text-moss/70">
          Gnani Prisma · Timbre · Evon
        </p>
      </aside>

      <header className="sticky top-0 z-40 flex items-center justify-between border-b border-stone-200/60 bg-paper/85 px-4 py-3 backdrop-blur md:hidden">
        <Link to={isSupervisor ? "/dashboard" : "/"} className="flex items-center gap-2">
          <Logo compact />
          <div className="leading-none">
            <div className="font-display text-lg font-semibold text-ink">ASHA Setu</div>
            <div className="mt-0.5 text-[8px] font-bold uppercase tracking-[0.18em] text-moss">
              Voice field reports
            </div>
          </div>
        </Link>
        <div className="flex items-center gap-1.5">
          {!online && (
            <span className="inline-flex items-center gap-1 rounded-full bg-ink px-2.5 py-1 text-[10px] font-bold text-cream">
              <WifiOff className="size-3" />
              Offline
            </span>
          )}
          {online && queueCount > 0 && (
            <span className="inline-flex items-center gap-1 rounded-full bg-amber-100 px-2.5 py-1 text-[10px] font-bold text-amber-900">
              <CloudOff className="size-3" />
              {queueCount}
            </span>
          )}
          <details className="relative">
            <summary className="flex size-9 cursor-pointer list-none items-center justify-center rounded-full bg-pine text-[11px] font-extrabold text-cream [&::-webkit-details-marker]:hidden">
              {initials(worker?.name ?? "AS")}
            </summary>
            <div className="absolute right-0 mt-2 w-60 rounded-2xl border border-stone-200 bg-cream p-3 shadow-xl shadow-ink/10">
              <p className="text-sm font-bold text-ink">{worker?.name}</p>
              <p className="text-[10px] font-semibold uppercase tracking-wider text-moss">
                {isSupervisor ? "Supervisor" : "ASHA worker"} ·{" "}
                {languageOption(worker?.language ?? "").native}
              </p>
              <button
                type="button"
                onClick={signOut}
                className="mt-3 flex w-full items-center gap-2 rounded-xl bg-rose-50 px-3 py-2 text-xs font-bold text-rose-700"
              >
                <LogOut className="size-3.5" />
                Sign out
              </button>
            </div>
          </details>
        </div>
      </header>

      <main className="px-4 pb-36 pt-5 md:ml-64 md:px-8 md:pb-12 md:pt-8">
        <div className="mx-auto w-full max-w-5xl">
          <SyncBanner
            online={online}
            queueCount={queueCount}
            syncing={syncing}
            onSync={handleSync}
          />
          <Outlet />
        </div>
      </main>

      <nav
        className="fixed inset-x-0 bottom-0 z-40 border-t border-stone-200/70 bg-cream/95 backdrop-blur md:hidden"
        style={{ paddingBottom: "env(safe-area-inset-bottom)" }}
      >
        <div
          className={cn(
            "mx-auto grid items-end gap-1 px-3 pb-2 pt-2",
            isSupervisor ? "max-w-xs grid-cols-2" : "max-w-sm grid-cols-3",
          )}
        >
          {!isSupervisor && <BottomItem to="/" end label="Today" icon={Home} />}
          {!isSupervisor && (
            <Link to="/record" className="-mt-6 flex flex-col items-center gap-1">
              <span className="grid size-14 place-items-center rounded-full bg-pine text-cream shadow-[0_12px_28px_-10px_rgba(15,76,70,0.9)] ring-4 ring-paper">
                <Mic className="size-6" />
              </span>
              <span className="text-[10px] font-extrabold text-pine">Record</span>
            </Link>
          )}
          {!isSupervisor && (
            <BottomItem
              to="/visits"
              label="Visits"
              icon={ListChecks}
              badge={queueCount || undefined}
            />
          )}
          {isSupervisor && (
            <BottomItem
              to="/dashboard"
              label="Overview"
              icon={LayoutDashboard}
            />
          )}
          {isSupervisor && (
            <BottomItem to="/visits" label="Visits" icon={ListChecks} />
          )}
        </div>
      </nav>
    </div>
  );
}
