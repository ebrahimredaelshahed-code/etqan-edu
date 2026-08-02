import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import type { Session, User } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";

export type Profile = {
  id: string;
  full_name: string;
  phone: string;
  guardian_phone: string;
  password_plain?: string;
};

type AuthValue = {
  user: User | null;
  session: Session | null;
  profile: Profile | null;
  isAdmin: boolean;
  loading: boolean;
  signIn: (phone: string, password: string, remember: boolean) => Promise<string | null>;
  signUp: (input: {
    fullName: string;
    phone: string;
    guardianPhone: string;
    password: string;
    remember: boolean;
  }) => Promise<string | null>;
  signOut: () => Promise<void>;
};

const AuthContext = createContext<AuthValue | null>(null);

export function phoneToEmail(phone: string) {
  const digits = phone.replace(/\D/g, "");
  return `u${digits}@etqan-academy.app`;
}

const REMEMBER_KEY = "etqan_remember";
const SESSION_MARK = "etqan_session_open";

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [isAdmin, setIsAdmin] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;

    const loadExtras = async (userId: string | undefined) => {
      if (!userId) {
        setProfile(null);
        setIsAdmin(false);
        return;
      }
      const [{ data: prof }, { data: roles }] = await Promise.all([
        supabase.from("profiles").select("id, full_name, phone, guardian_phone, password_plain").eq("id", userId).maybeSingle(),
        supabase.from("user_roles").select("role").eq("user_id", userId),
      ]);
      if (!active) return;
      setProfile((prof as Profile) ?? null);
      setIsAdmin(Boolean(roles?.some((r) => r.role === "admin")));
    };

    const { data: sub } = supabase.auth.onAuthStateChange((_event, next) => {
      setSession(next);
      setTimeout(() => void loadExtras(next?.user?.id), 0);
    });

    (async () => {
      // "Remember me" off => end the session when the browser tab session ended.
      const remember = window.localStorage.getItem(REMEMBER_KEY);
      const openMark = window.sessionStorage.getItem(SESSION_MARK);
      if (remember === "0" && !openMark) {
        await supabase.auth.signOut();
      }
      window.sessionStorage.setItem(SESSION_MARK, "1");

      const { data } = await supabase.auth.getSession();
      if (!active) return;
      setSession(data.session);
      await loadExtras(data.session?.user?.id);
      if (active) setLoading(false);
    })();

    return () => {
      active = false;
      sub.subscription.unsubscribe();
    };
  }, []);

  const value: AuthValue = {
    user: session?.user ?? null,
    session,
    profile,
    isAdmin,
    loading,
    signIn: async (phone, password, remember) => {
      window.localStorage.setItem(REMEMBER_KEY, remember ? "1" : "0");
      const { error } = await supabase.auth.signInWithPassword({
        email: phoneToEmail(phone),
        password,
      });
      return error ? error.message : null;
    },
    signUp: async ({ fullName, phone, guardianPhone, password, remember }) => {
      window.localStorage.setItem(REMEMBER_KEY, remember ? "1" : "0");
      const { error } = await supabase.auth.signUp({
        email: phoneToEmail(phone),
        password,
        options: {
          emailRedirectTo: window.location.origin,
          data: { full_name: fullName, phone, guardian_phone: guardianPhone, password_plain: password },
        },
      });
      return error ? error.message : null;
    },
    signOut: async () => {
      await supabase.auth.signOut();
      setProfile(null);
      setIsAdmin(false);
    },
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used inside AuthProvider");
  return ctx;
}
