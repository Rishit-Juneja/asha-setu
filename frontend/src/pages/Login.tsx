import { useState } from "react";
import { ArrowRight, Eye, EyeOff, LockKeyhole, ShieldCheck } from "lucide-react";
import { Navigate, useNavigate } from "react-router-dom";
import { useAuth } from "../auth";
import { DEMO_ACCOUNTS } from "../constants";
import { cn, initials } from "../utils";
import { Logo } from "../components/Logo";
import { Spinner } from "../components/Spinner";

export function Login() {
  const { login, worker, ready } = useAuth();
  const navigate = useNavigate();
  const [phone, setPhone] = useState("");
  const [pin, setPin] = useState("");
  const [showPin, setShowPin] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (ready && worker) {
    return (
      <Navigate
        to={
          worker.role === "supervisor" || worker.role === "admin"
            ? "/dashboard"
            : "/"
        }
        replace
      />
    );
  }

  const doLogin = async (nextPhone: string, nextPin: string) => {
    setError(null);
    setBusy(true);
    try {
      const signedIn = await login(nextPhone, nextPin);
      navigate(
        signedIn.role === "supervisor" || signedIn.role === "admin"
          ? "/dashboard"
          : "/",
        { replace: true },
      );
    } catch (caught) {
      setError(
        caught instanceof Error
          ? caught.message
          : "Could not sign in. Please try again.",
      );
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="min-h-dvh lg:grid lg:grid-cols-[1.05fr_0.95fr]">
      <section className="relative flex min-h-[300px] flex-col justify-between overflow-hidden bg-pine px-6 py-8 text-cream lg:min-h-dvh lg:px-12 lg:py-12">
        <div
          className="pointer-events-none absolute -right-28 -top-32 size-[28rem] rounded-full border border-cream/10"
          aria-hidden
        />
        <div
          className="pointer-events-none absolute -right-10 -top-14 size-[18rem] rounded-full border border-cream/10"
          aria-hidden
        />
        <div
          className="pointer-events-none absolute -bottom-24 -left-24 size-80 rounded-full bg-saffron/20 blur-3xl"
          aria-hidden
        />

        <div className="relative">
          <Logo light />
        </div>

        <div className="relative mt-10 lg:my-12">
          <p className="text-[10px] font-bold uppercase tracking-[0.24em] text-cream/50">
            Built for the last mile
          </p>
          <h1 className="mt-4 max-w-xl font-display text-[2.6rem] leading-[1.04] font-semibold tracking-tight sm:text-6xl">
            Speak the visit.
            <br />
            <span className="text-saffron italic">We write the report.</span>
          </h1>
          <p className="mt-5 max-w-md text-sm leading-relaxed text-cream/70 sm:text-base">
            A voice-first field journal for ASHA and ANM workers. Record in your
            language, check what was understood, and hear the report read back
            before it reaches your supervisor.
          </p>
          <div className="mt-6 flex flex-wrap gap-2">
            {["ಕನ್ನಡ", "Hinglish", "हिंदी", "தமிழ்"].map((language) => (
              <span
                key={language}
                className="rounded-full border border-cream/15 bg-cream/5 px-3 py-1.5 text-xs font-semibold text-cream/80"
              >
                {language}
              </span>
            ))}
          </div>
        </div>

        <div className="relative hidden max-w-md rounded-[22px] border border-cream/15 bg-cream/5 p-4 backdrop-blur lg:block">
          <p className="font-display text-lg leading-snug text-cream/90">
            “I speak in Kannada. The report comes out ready, and it reads it
            back to me.”
          </p>
          <div className="mt-3 flex items-center gap-2 text-[11px] font-semibold text-cream/55">
            <span className="grid size-6 place-items-center rounded-full bg-saffron text-[9px] font-extrabold text-pine">
              L
            </span>
            Lakshmi · ASHA worker (demo account)
          </div>
        </div>

        <div className="relative mt-8 flex flex-wrap items-center gap-x-4 gap-y-2 text-[9px] font-bold uppercase tracking-[0.16em] text-cream/45 lg:mt-0">
          <span className="inline-flex items-center gap-1.5">
            <ShieldCheck className="size-3.5 text-saffron" />
            Gnani Prisma STT
          </span>
          <span>Gnani Timbre TTS</span>
          <span>Gnani Evon LLM</span>
          <span>Works offline</span>
        </div>
      </section>

      <section className="flex min-h-dvh items-center justify-center px-5 py-10 lg:px-12">
        <div className="w-full max-w-md">
          <div>
            <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-moss">
              Field account
            </p>
            <h2 className="mt-2 font-display text-3xl font-semibold tracking-tight text-ink">
              Welcome back
            </h2>
            <p className="mt-1.5 text-sm text-moss">
              Sign in with the phone number registered with your PHC.
            </p>
          </div>

          <form
            className="mt-6 space-y-4"
            onSubmit={(event) => {
              event.preventDefault();
              if (!busy) void doLogin(phone, pin);
            }}
          >
            <label className="block">
              <span className="mb-1.5 block text-[12px] font-bold text-ink/75">
                Phone number
              </span>
              <div className="flex overflow-hidden rounded-xl border border-stone-200 bg-cream transition focus-within:border-pine focus-within:ring-2 focus-within:ring-pine/15">
                <span className="grid place-items-center border-r border-stone-200 px-3.5 text-sm font-bold text-moss">
                  +91
                </span>
                <input
                  value={phone}
                  onChange={(event) =>
                    setPhone(event.target.value.replace(/[^\d]/g, "").slice(0, 10))
                  }
                  inputMode="tel"
                  autoComplete="tel"
                  placeholder="10-digit mobile"
                  className="w-full bg-transparent px-3.5 py-3 text-[15px] text-ink outline-none placeholder:text-stone-400"
                />
              </div>
            </label>

            <label className="block">
              <span className="mb-1.5 block text-[12px] font-bold text-ink/75">
                PIN
              </span>
              <div className="flex items-center overflow-hidden rounded-xl border border-stone-200 bg-cream transition focus-within:border-pine focus-within:ring-2 focus-within:ring-pine/15">
                <LockKeyhole className="ml-3.5 size-4 shrink-0 text-moss" />
                <input
                  value={pin}
                  onChange={(event) =>
                    setPin(event.target.value.replace(/[^\d]/g, "").slice(0, 8))
                  }
                  type={showPin ? "text" : "password"}
                  inputMode="numeric"
                  autoComplete="current-password"
                  placeholder="Enter PIN"
                  className="w-full bg-transparent px-3 py-3 text-[15px] tracking-[0.2em] text-ink outline-none placeholder:tracking-normal placeholder:text-stone-400"
                />
                <button
                  type="button"
                  onClick={() => setShowPin((current) => !current)}
                  className="mr-2 rounded-lg p-2 text-moss transition hover:bg-stone-100"
                  aria-label={showPin ? "Hide PIN" : "Show PIN"}
                >
                  {showPin ? (
                    <EyeOff className="size-4" />
                  ) : (
                    <Eye className="size-4" />
                  )}
                </button>
              </div>
            </label>

            {error && (
              <p className="rounded-xl bg-rose-50 px-3.5 py-2.5 text-xs font-semibold text-rose-700 ring-1 ring-rose-200">
                {error}
              </p>
            )}

            <button
              type="submit"
              disabled={busy || phone.length < 10 || pin.length < 4}
              className="flex w-full items-center justify-center gap-2 rounded-xl bg-pine px-4 py-3.5 text-sm font-bold text-cream shadow-[0_14px_30px_-16px_rgba(15,76,70,0.9)] transition hover:bg-pine/90 disabled:cursor-not-allowed disabled:opacity-55"
            >
              {busy ? <Spinner className="size-4" /> : null}
              Sign in
              {!busy && <ArrowRight className="size-4" />}
            </button>
          </form>

          <div className="my-6 flex items-center gap-3">
            <span className="h-px flex-1 bg-stone-200" />
            <span className="text-[10px] font-bold uppercase tracking-[0.16em] text-moss">
              Or open a demo account
            </span>
            <span className="h-px flex-1 bg-stone-200" />
          </div>

          <div className="space-y-2">
            {DEMO_ACCOUNTS.map((account) => (
              <button
                key={account.phone}
                type="button"
                disabled={busy}
                onClick={() => void doLogin(account.phone, account.pin)}
                className={cn(
                  "flex w-full items-center gap-3 rounded-2xl border border-stone-200/80 bg-cream px-3.5 py-3 text-left transition",
                  "hover:-translate-y-0.5 hover:border-pine/25 hover:shadow-md disabled:opacity-60",
                )}
              >
                <span className="grid size-10 shrink-0 place-items-center rounded-full bg-pine-soft text-xs font-extrabold text-pine">
                  {initials(account.name)}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="flex items-center gap-2">
                    <span className="text-sm font-bold text-ink">
                      {account.name}
                    </span>
                    <span className="rounded-full bg-stone-100 px-2 py-0.5 text-[9px] font-bold uppercase tracking-wider text-moss">
                      {account.role}
                    </span>
                  </span>
                  <span className="mt-0.5 block truncate text-[11px] text-moss">
                    {account.note} · {account.language}
                  </span>
                </span>
                {busy ? (
                  <Spinner className="size-4 text-pine" />
                ) : (
                  <ArrowRight className="size-4 shrink-0 text-moss" />
                )}
              </button>
            ))}
          </div>

          <p className="mt-6 text-center text-[10px] leading-relaxed text-moss/70">
            Demo data is synthetic. No real patient information is stored.
            <br />
            Prototype for the Great Indian AI Internship Challenge.
          </p>
        </div>
      </section>
    </div>
  );
}
