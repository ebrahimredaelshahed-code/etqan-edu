import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { GraduationCap } from "lucide-react";
import { SiteLayout } from "@/components/site/SiteLayout";
import { useI18n } from "@/lib/i18n";
import { useAuth } from "@/lib/auth";

type Mode = "login" | "signup";

export const Route = createFileRoute("/auth")({
  validateSearch: (search: Record<string, unknown>): { mode: Mode } => ({
    mode: search.mode === "signup" ? "signup" : "login",
  }),
  head: () => ({
    meta: [
      { title: "تسجيل الدخول وإنشاء حساب | Login — Etqan Academy" },
      { name: "description", content: "سجّل دخولك برقم هاتفك أو أنشئ حساب متدرب جديد على منصة إتقان." },
      { property: "og:title", content: "تسجيل الدخول | Etqan Academy" },
      { property: "og:description", content: "حساب المتدرب: رقم الهاتف هو اسم المستخدم." },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: AuthPage,
});

function AuthPage() {
  const { mode } = Route.useSearch();
  const navigate = useNavigate();
  const { t } = useI18n();
  const { signIn, signUp, user, loading } = useAuth();
  const [busy, setBusy] = useState(false);
  const [remember, setRemember] = useState(true);
  const [form, setForm] = useState({ fullName: "", phone: "", guardianPhone: "", password: "" });

  useEffect(() => {
    if (!loading && user) navigate({ to: "/" });
  }, [loading, user, navigate]);

  const isSignup = mode === "signup";

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    const error = isSignup
      ? await signUp({ ...form, guardianPhone: form.guardianPhone, remember })
      : await signIn(form.phone, form.password, remember);
    setBusy(false);
    if (error) {
      toast.error(error);
      return;
    }
    toast.success(isSignup ? t("codeSuccess") : t("welcomeBack"));
    navigate({ to: "/" });
  };

  return (
    <SiteLayout>
      <div className="mx-auto grid max-w-6xl items-center gap-10 px-4 py-16 md:grid-cols-2">
        <div className="hidden rounded-3xl bg-hero-gradient p-12 text-ink-foreground shadow-lift md:block">
          <GraduationCap className="size-10" />
          <h2 className="mt-6 text-3xl font-extrabold">{t("heroTitle")}</h2>
          <p className="mt-3 opacity-85">{t("heroSubtitle")}</p>
        </div>

        <div className="rounded-3xl border border-border bg-card p-8 shadow-soft">
          <h1 className="text-2xl font-extrabold">{isSignup ? t("createAccount") : t("welcomeBack")}</h1>

          <form onSubmit={submit} className="mt-6 space-y-4">
            {isSignup && (
              <Field
                label={t("fullName")}
                value={form.fullName}
                onChange={(v) => setForm({ ...form, fullName: v })}
                required
              />
            )}
            <Field
              label={t("phone")}
              value={form.phone}
              onChange={(v) => setForm({ ...form, phone: v })}
              type="tel"
              required
            />
            <p className="text-xs font-semibold text-accent-foreground">{t("phoneNote")}</p>
            {isSignup && (
              <Field
                label={t("guardianPhone")}
                value={form.guardianPhone}
                onChange={(v) => setForm({ ...form, guardianPhone: v })}
                type="tel"
                required
              />
            )}
            <Field
              label={t("password")}
              value={form.password}
              onChange={(v) => setForm({ ...form, password: v })}
              type="password"
              required
            />

            <label className="flex items-center gap-2 text-sm font-semibold">
              <input
                type="checkbox"
                checked={remember}
                onChange={(e) => setRemember(e.target.checked)}
                className="size-4 accent-[var(--primary)]"
              />
              {t("rememberMe")}
            </label>

            <button
              disabled={busy}
              className="w-full rounded-full bg-primary px-5 py-3.5 text-sm font-extrabold text-primary-foreground shadow-soft disabled:opacity-60"
            >
              {busy ? t("loading") : t("submit")}
            </button>
          </form>

          <p className="mt-5 text-center text-sm text-muted-foreground">
            {isSignup ? t("haveAccount") : t("noAccount")}{" "}
            <Link
              to="/auth"
              search={{ mode: isSignup ? "login" : "signup" }}
              className="font-bold text-primary"
            >
              {isSignup ? t("login") : t("signup")}
            </Link>
          </p>
        </div>
      </div>
    </SiteLayout>
  );
}

function Field({
  label,
  value,
  onChange,
  type = "text",
  required,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  type?: string;
  required?: boolean;
}) {
  return (
    <label className="block space-y-1.5">
      <span className="text-sm font-bold">{label}</span>
      <input
        type={type}
        value={value}
        required={required}
        onChange={(e) => onChange(e.target.value)}
        className="w-full rounded-2xl border border-border bg-background px-4 py-3 text-sm outline-none focus:border-primary"
      />
    </label>
  );
}
