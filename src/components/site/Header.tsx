import { Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import brandLogo from "@/assets/etqan-logo.png";
import { GraduationCap, ChevronDown, User, BookOpen, LogOut, Globe } from "lucide-react";
import { useI18n } from "@/lib/i18n";
import { useAuth } from "@/lib/auth";

export function Header() {
  const { t, toggle, lang } = useI18n();
  const { user, profile, signOut, isAdmin } = useAuth();
  const [open, setOpen] = useState(false);
  const navigate = useNavigate();
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const onClick = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", onClick);
    return () => document.removeEventListener("mousedown", onClick);
  }, []);

  return (
    <header className="sticky top-0 z-50 border-b border-border/70 bg-background/85 backdrop-blur-xl">
      <div className="mx-auto flex h-18 max-w-6xl items-center justify-between gap-4 px-4 py-3">
        <Link to="/" className="flex items-center gap-2.5">
          <img
            src={brandLogo}
            alt={t("brand")}
            width={40}
            height={40}
            className="size-10 rounded-xl object-cover shadow-soft"
          />
          <span className="flex flex-col leading-tight">
            <span className="text-lg font-extrabold tracking-tight">{t("brand")}</span>
            <span className="text-[11px] text-muted-foreground">{t("tagline")}</span>
          </span>
        </Link>

        <div className="flex items-center gap-2">


          {!user ? (
            <div className="flex items-center gap-2">
              <Link
                to="/auth"
                search={{ mode: "login" }}
                className="rounded-full px-3 py-2 text-sm font-semibold text-foreground transition-colors hover:bg-secondary sm:px-4"
              >
                {t("login")}
              </Link>
              <Link
                to="/auth"
                search={{ mode: "signup" }}
                className="rounded-full bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground shadow-soft transition-transform hover:-translate-y-0.5"
              >
                {t("signup")}
              </Link>
            </div>
          ) : (
            <div className="relative" ref={ref}>
              <button
                onClick={() => setOpen((v) => !v)}
                className="flex items-center gap-2 rounded-full border border-border bg-card px-3 py-1.5 text-sm font-semibold shadow-soft"
              >
                <span className="flex size-7 items-center justify-center rounded-full bg-accent-gradient text-xs font-bold text-accent-foreground">
                  {(profile?.full_name || "?").trim().charAt(0).toUpperCase()}
                </span>
                <span className="hidden max-w-28 truncate sm:inline">{profile?.full_name || t("account")}</span>
                <ChevronDown className="size-4" />
              </button>
              {open && (
                <div className="absolute end-0 mt-2 w-56 overflow-hidden rounded-2xl border border-border bg-popover p-1.5 shadow-lift">
                  <Link
                    to="/account"
                    search={{ tab: "profile" }}
                    onClick={() => setOpen(false)}
                    className="flex items-center gap-2 rounded-xl px-3 py-2.5 text-sm hover:bg-secondary"
                  >
                    <User className="size-4" /> {t("profile")}
                  </Link>
                  <Link
                    to="/account"
                    search={{ tab: "courses" }}
                    onClick={() => setOpen(false)}
                    className="flex items-center gap-2 rounded-xl px-3 py-2.5 text-sm hover:bg-secondary"
                  >
                    <BookOpen className="size-4" /> {t("myCourses")}
                  </Link>
                  {isAdmin && (
                    <Link
                      to="/admin"
                      onClick={() => setOpen(false)}
                      className="flex items-center gap-2 rounded-xl px-3 py-2.5 text-sm hover:bg-secondary"
                    >
                      <GraduationCap className="size-4" /> {t("adminPanel")}
                    </Link>
                  )}
                  <button
                    onClick={async () => {
                      setOpen(false);
                      await signOut();
                      navigate({ to: "/" });
                    }}
                    className="flex w-full items-center gap-2 rounded-xl px-3 py-2.5 text-start text-sm text-destructive hover:bg-secondary"
                  >
                    <LogOut className="size-4" /> {t("logout")}
                  </button>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </header>
  );
}
