/* eslint-disable react-refresh/only-export-components */
import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { ApiError, api } from "./api";

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [ready, setReady] = useState(false);
  const navigate = useNavigate();
  const location = useLocation();

  useEffect(() => {
    let cancelled = false;
    api
      .me()
      .then((profile) => {
        if (!cancelled) setUser(profile);
      })
      .catch((err) => {
        if (!cancelled) setUser(null);
        if (!(err instanceof ApiError && err.status === 401)) {
          setUser(null);
        }
      })
      .finally(() => {
        if (!cancelled) setReady(true);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const signIn = useCallback((profile) => {
    setUser(profile);
  }, []);

  const signOut = useCallback(async () => {
    try {
      await api.logout();
    } catch (err) {
      if (!(err instanceof ApiError && err.status === 401)) {
        throw err;
      }
    }
    setUser(null);
    if (
      location.pathname === "/me/posts" ||
      location.pathname === "/me/avatar" ||
      location.pathname === "/admin/users"
    ) {
      navigate("/");
    }
  }, [location.pathname, navigate]);

  const value = useMemo(
    () => ({ user, ready, signIn, signOut, setUser }),
    [user, ready, signIn, signOut],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}
