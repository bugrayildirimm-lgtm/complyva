"use client";

import { createContext, useContext, useEffect, useState, useCallback, type ReactNode } from "react";

type User = {
  id: string;
  email: string;
  full_name: string;
  org_id: string;
  org_name: string;
  role: string;
};

type Org = {
  id: string;
  name: string;
  role: string;
  member_count: number;
};

type AuthContextType = {
  user: User | null;
  loading: boolean;
  login: (email: string, password: string) => Promise<{ verified: boolean; userId?: string }>;
  verifyCode: (userId: string, code: string, rememberDevice: boolean) => Promise<void>;
  resendCode: (userId: string) => Promise<void>;
  register: (email: string, password: string, fullName: string, orgName?: string) => Promise<{ verified: boolean; userId?: string; email?: string }>;
  verifyRegistration: (userId: string, code: string) => Promise<void>;
  logout: () => void;
  getToken: () => string | null;
  orgs: Org[];
  currentOrgId: string | null;
  switchOrg: (orgId: string) => Promise<void>;
  fetchOrgs: () => Promise<void>;
};

const AuthContext = createContext<AuthContextType>({
  user: null,
  loading: true,
  login: async () => ({ verified: false }),
  verifyCode: async () => {},
  resendCode: async () => {},
  register: async () => ({ verified: false }),
  verifyRegistration: async () => {},
  logout: () => {},
  getToken: () => null,
  orgs: [],
  currentOrgId: null,
  switchOrg: async () => {},
  fetchOrgs: async () => {},
});

export function useAuth() {
  return useContext(AuthContext);
}

const API_BASE = process.env.NEXT_PUBLIC_API_BASE ?? "http://localhost:4000";

function getDeviceId(): string {
  if (typeof window === "undefined") return "";
  let id = localStorage.getItem("deviceId");
  if (!id) {
    id = crypto.randomUUID();
    localStorage.setItem("deviceId", id);
  }
  return id;
}

async function setCookies(token: string, refreshToken: string) {
  await fetch("/api/auth", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ token, refreshToken }),
  });
}

async function clearCookies() {
  await fetch("/api/auth", { method: "DELETE" });
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [orgs, setOrgs] = useState<Org[]>([]);
  const [currentOrgId, setCurrentOrgId] = useState<string | null>(null);

  const getToken = useCallback(() => {
    if (typeof window === "undefined") return null;
    return localStorage.getItem("token");
  }, []);

  const fetchUser = useCallback(async (token: string) => {
    try {
      const res = await fetch(`${API_BASE}/auth/me`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) throw new Error("Invalid token");
      const data = await res.json();
      setUser(data);
      setCurrentOrgId(data.org_id);
      return true;
    } catch {
      const refreshToken = localStorage.getItem("refreshToken");
      if (refreshToken) {
        try {
          const refreshRes = await fetch(`${API_BASE}/auth/refresh`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ refreshToken }),
          });
          if (refreshRes.ok) {
            const refreshData = await refreshRes.json();
            localStorage.setItem("token", refreshData.token);
            await setCookies(refreshData.token, refreshToken);
            const retryRes = await fetch(`${API_BASE}/auth/me`, {
              headers: { Authorization: `Bearer ${refreshData.token}` },
            });
            if (retryRes.ok) {
              const userData = await retryRes.json();
              setUser(userData);
              setCurrentOrgId(userData.org_id);
              return true;
            }
          }
        } catch { /* refresh failed */ }
      }
      localStorage.removeItem("token");
      localStorage.removeItem("refreshToken");
      await clearCookies();
      setUser(null);
      return false;
    }
  }, []);

  const fetchOrgs = useCallback(async () => {
    const token = localStorage.getItem("token");
    if (!token) return;
    try {
      const res = await fetch(`${API_BASE}/auth/orgs`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) {
        const data = await res.json();
        setOrgs(data.orgs);
        setCurrentOrgId(data.currentOrgId);
      }
    } catch { /* ignore */ }
  }, []);

  useEffect(() => {
    const token = localStorage.getItem("token");
    if (token) {
      Promise.all([fetchUser(token), fetchOrgs()]).finally(() => setLoading(false));
    } else {
      setLoading(false);
    }
  }, [fetchUser, fetchOrgs]);

  const login = async (email: string, password: string): Promise<{ verified: boolean; userId?: string }> => {
    const deviceId = getDeviceId();
    const res = await fetch(`${API_BASE}/auth/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, password, deviceId }),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.message || data.error || "Login failed");

    if (data.verified) {
      // Trusted device — skip 2FA
      localStorage.setItem("token", data.token);
      localStorage.setItem("refreshToken", data.refreshToken);
      await setCookies(data.token, data.refreshToken);
      await fetchUser(data.token);
      return { verified: true };
    }

    // Need 2FA code
    return { verified: false, userId: data.userId };
  };

  const verifyCode = async (userId: string, code: string, rememberDevice: boolean) => {
    const deviceId = getDeviceId();
    const res = await fetch(`${API_BASE}/auth/verify-code`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ userId, code, rememberDevice, deviceId }),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.message || data.error || "Verification failed");

    localStorage.setItem("token", data.token);
    localStorage.setItem("refreshToken", data.refreshToken);
    await setCookies(data.token, data.refreshToken);
    await fetchUser(data.token);
  };

  const resendCode = async (userId: string) => {
    const res = await fetch(`${API_BASE}/auth/resend-code`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ userId }),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.message || data.error || "Failed to resend code");
  };

  const register = async (email: string, password: string, fullName: string, orgName?: string): Promise<{ verified: boolean; userId?: string; email?: string }> => {
    const res = await fetch(`${API_BASE}/auth/register`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, password, fullName, orgName }),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.message || data.error || "Registration failed");
    
    if (data.verified) {
      // Invited user — already verified, tokens issued
      localStorage.setItem("token", data.token);
      localStorage.setItem("refreshToken", data.refreshToken);
      await setCookies(data.token, data.refreshToken);
      await fetchUser(data.token);
      return { verified: true };
    }
    
    // New user — needs email verification
    return { verified: false, userId: data.userId, email: data.email };
  };

  const verifyRegistration = async (userId: string, code: string) => {
    const res = await fetch(`${API_BASE}/auth/verify-registration`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ userId, code }),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.message || data.error || "Verification failed");
    
    localStorage.setItem("token", data.token);
    localStorage.setItem("refreshToken", data.refreshToken);
    await setCookies(data.token, data.refreshToken);
    await fetchUser(data.token);
  };

  const switchOrg = async (orgId: string) => {
    const token = localStorage.getItem("token");
    if (!token) return;
    const res = await fetch(`${API_BASE}/auth/switch-org`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
      body: JSON.stringify({ orgId }),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.message || data.error || "Failed to switch org");
    localStorage.setItem("token", data.token);
    localStorage.setItem("refreshToken", data.refreshToken);
    await setCookies(data.token, data.refreshToken);
    await fetchUser(data.token);
    await fetchOrgs();
    window.location.href = "/dashboard";
  };

  const logout = async () => {
    localStorage.removeItem("token");
    localStorage.removeItem("refreshToken");
    await clearCookies();
    setUser(null);
    setOrgs([]);
    window.location.href = "/sign-in";
  };

  // 30-min inactivity auto-logout
  useEffect(() => {
    let timeout: ReturnType<typeof setTimeout>;
    const THIRTY_MIN = 30 * 60 * 1000;
    const resetTimer = () => {
      clearTimeout(timeout);
      timeout = setTimeout(() => {
        localStorage.removeItem("token");
        localStorage.removeItem("refreshToken");
        clearCookies();
        setUser(null);
        setOrgs([]);
        window.location.href = "/sign-in?reason=inactivity";
      }, THIRTY_MIN);
    };
    const events = ["mousedown", "keydown", "scroll", "touchstart", "mousemove"];
    events.forEach(e => window.addEventListener(e, resetTimer));
    resetTimer();
    return () => {
      clearTimeout(timeout);
      events.forEach(e => window.removeEventListener(e, resetTimer));
    };
  }, [user]);

  return (
    <AuthContext.Provider value={{ user, loading, login, verifyCode, resendCode, register, verifyRegistration, logout, getToken, orgs, currentOrgId, switchOrg, fetchOrgs }}>
      {children}
    </AuthContext.Provider>
  );
}
