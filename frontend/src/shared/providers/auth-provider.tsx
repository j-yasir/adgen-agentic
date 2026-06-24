"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
} from "react";
import { useRouter } from "next/navigation";
import {
  setTokens,
  clearTokens,
  getRefreshToken,
  apiClient,
} from "@/shared/lib/api-client";

type User = {
  id: string;
  name: string;
  email: string;
  created_at: string;
};

type AuthContextType = {
  user: User | null;
  isLoading: boolean;
  login: (email: string, password: string) => Promise<void>;
  signup: (name: string, email: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
};

const AuthContext = createContext<AuthContextType | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const router = useRouter();

  const fetchUser = useCallback(async () => {
    try {
      const data = await apiClient<User>("/auth/me");
      setUser(data);
    } catch {
      setUser(null);
      clearTokens();
    }
  }, []);

  useEffect(() => {
    const savedRefresh = typeof window !== "undefined"
      ? localStorage.getItem("refresh_token")
      : null;

    if (savedRefresh) {
      setTokens("", savedRefresh);
      apiClient<{ access_token: string; refresh_token: string }>(
        "/auth/refresh",
        {
          method: "POST",
          body: JSON.stringify({ refresh_token: savedRefresh }),
        }
      )
        .then((data) => {
          setTokens(data.access_token, data.refresh_token);
          localStorage.setItem("refresh_token", data.refresh_token);
          return fetchUser();
        })
        .catch(() => {
          clearTokens();
          localStorage.removeItem("refresh_token");
        })
        .finally(() => setIsLoading(false));
    } else {
      setIsLoading(false);
    }
  }, [fetchUser]);

  const login = useCallback(
    async (email: string, password: string) => {
      const data = await apiClient<{
        access_token: string;
        refresh_token: string;
      }>("/auth/login", {
        method: "POST",
        body: JSON.stringify({ email, password }),
      });
      setTokens(data.access_token, data.refresh_token);
      localStorage.setItem("refresh_token", data.refresh_token);
      await fetchUser();
      router.push("/businesses");
    },
    [fetchUser, router]
  );

  const signup = useCallback(
    async (name: string, email: string, password: string) => {
      const data = await apiClient<{
        access_token: string;
        refresh_token: string;
        user: User;
      }>("/auth/signup", {
        method: "POST",
        body: JSON.stringify({ name, email, password }),
      });
      setTokens(data.access_token, data.refresh_token);
      localStorage.setItem("refresh_token", data.refresh_token);
      setUser(data.user);
      router.push("/businesses");
    },
    [router]
  );

  const logout = useCallback(async () => {
    const refresh = getRefreshToken();
    if (refresh) {
      try {
        await apiClient("/auth/logout", {
          method: "POST",
          body: JSON.stringify({ refresh_token: refresh }),
        });
      } catch {
        // ignore logout errors
      }
    }
    clearTokens();
    localStorage.removeItem("refresh_token");
    setUser(null);
    router.push("/login");
  }, [router]);

  return (
    <AuthContext.Provider value={{ user, isLoading, login, signup, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}
