import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import {
  ApiError,
  clearSession,
  getStoredWorker,
  getToken,
  login as apiLogin,
  me,
  saveSession,
} from "./api";
import type { Worker } from "./types";

interface AuthContextValue {
  worker: Worker | null;
  token: string | null;
  ready: boolean;
  isSupervisor: boolean;
  login: (phone: string, pin: string) => Promise<Worker>;
  logout: () => void;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [worker, setWorker] = useState<Worker | null>(() => getStoredWorker());
  const [token, setToken] = useState<string | null>(() => getToken());
  const [ready, setReady] = useState<boolean>(
    () => !getToken() || !navigator.onLine,
  );

  useEffect(() => {
    const handleUnauthorized = () => {
      clearSession();
      setWorker(null);
      setToken(null);
      setReady(true);
    };
    window.addEventListener("asha:unauthorized", handleUnauthorized);
    return () =>
      window.removeEventListener("asha:unauthorized", handleUnauthorized);
  }, []);

  useEffect(() => {
    if (!token) {
      setReady(true);
      return;
    }
    if (!navigator.onLine) {
      setReady(true);
      return;
    }
    let cancelled = false;
    me()
      .then((freshWorker) => {
        if (cancelled) return;
        saveSession(token, freshWorker);
        setWorker(freshWorker);
      })
      .catch((error) => {
        if (cancelled) return;
        if (error instanceof ApiError && error.status === 401) {
          clearSession();
          setWorker(null);
          setToken(null);
        }
      })
      .finally(() => {
        if (!cancelled) setReady(true);
      });
    return () => {
      cancelled = true;
    };
  }, [token]);

  const login = useCallback(async (phone: string, pin: string) => {
    const response = await apiLogin(phone, pin);
    saveSession(response.access_token, response.worker);
    setToken(response.access_token);
    setWorker(response.worker);
    setReady(true);
    return response.worker;
  }, []);

  const logout = useCallback(() => {
    clearSession();
    setWorker(null);
    setToken(null);
    setReady(true);
  }, []);

  const value = useMemo<AuthContextValue>(
    () => ({
      worker,
      token,
      ready,
      isSupervisor:
        worker?.role === "supervisor" || worker?.role === "admin",
      login,
      logout,
    }),
    [worker, token, ready, login, logout],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const context = useContext(AuthContext);
  if (!context) throw new Error("useAuth must be used inside AuthProvider");
  return context;
}
