import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { toast } from "sonner";
import { Copy, KeyRound, LogOut, ShieldCheck } from "lucide-react";
import { useI18n } from "@/lib/i18n";
import { useAuth } from "@/lib/auth";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/admin")({
  head: () => ({
    meta: [
      { title: "لوحة الإدارة | Admin — Etqan Academy" },
      { name: "description", content: "لوحة إدارة منصة إتقان لتوليد أكواد الاشتراك ومتابعتها." },
      { property: "og:title", content: "لوحة الإدارة | Etqan Academy" },
      { property: "og:description", content: "توليد أكواد اشتراك مرتبطة بدورة واحدة ومتدرب واحد." },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: AdminPage,
});

function AdminPage() {
  const { t, lang } = useI18n();
  const { user, isAdmin, loading, signIn, signOut } = useAuth();

  if (loading) {
    return <Shell>{t("loading")}</Shell>;
  }

  if (!user) return <AdminLogin onSubmit={signIn} />;

  if (!isAdmin) {
    return (
      <Shell>
        <p className="text-lg font-bold">{t("notAdmin")}</p>
        <button
          onClick={() => signOut()}
          className="mt-4 rounded-full bg-primary px-5 py-2.5 text-sm font-bold text-primary-foreground"
        >
          {t("logout")}
        </button>
      </Shell>
    );
  }

  return <AdminDashboard lang={lang} />;
}

function Shell({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-screen items-center justify-center bg-ink p-6 text-ink-foreground">
      <div className="w-full max-w-md rounded-3xl bg-card p-8 text-card-foreground shadow-lift">{children}</div>
    </div>
  );
}

function AdminLogin({
  onSubmit,
}: {
  onSubmit: (phone: string, password: string, remember: boolean) => Promise<string | null>;
}) {
  const { t } = useI18n();
  const [phone, setPhone] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);

  return (
    <Shell>
      <div className="flex items-center gap-2 text-primary">
        <ShieldCheck className="size-6" />
        <h1 className="text-xl font-extrabold">{t("adminLogin")}</h1>
      </div>
      <form
        className="mt-6 space-y-4"
        onSubmit={async (e) => {
          e.preventDefault();
          setBusy(true);
          const error = await onSubmit(phone, password, true);
          setBusy(false);
          if (error) toast.error(error);
        }}
      >
        <input
          value={phone}
          onChange={(e) => setPhone(e.target.value)}
          placeholder={t("phone")}
          className="w-full rounded-2xl border border-border bg-background px-4 py-3 text-sm outline-none focus:border-primary"
          required
        />
        <input
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          placeholder={t("password")}
          className="w-full rounded-2xl border border-border bg-background px-4 py-3 text-sm outline-none focus:border-primary"
          required
        />
        <button
          disabled={busy}
          className="w-full rounded-full bg-primary px-5 py-3 text-sm font-extrabold text-primary-foreground disabled:opacity-60"
        >
          {busy ? t("loading") : t("login")}
        </button>
      </form>
    </Shell>
  );
}

function AdminDashboard({ lang }: { lang: "ar" | "en" }) {
  const { t } = useI18n();
  const { signOut } = useAuth();
  const queryClient = useQueryClient();
  const [courseId, setCourseId] = useState("");
  const [count, setCount] = useState(5);
  const [busy, setBusy] = useState(false);

  const { data: courses } = useQuery({
    queryKey: ["admin-courses"],
    queryFn: async () => (await supabase.from("courses").select("*").order("title_ar")).data ?? [],
  });

  const { data: codes } = useQuery({
    queryKey: ["admin-codes"],
    queryFn: async () => {
      const { data, error } = await supabase.rpc("admin_list_codes");
      if (error) throw error;
      return data ?? [];
    },
  });

  const generate = async () => {
    const target = courseId || courses?.[0]?.id;
    if (!target) return;
    setBusy(true);
    const { error } = await supabase.rpc("generate_codes", { _course_id: target, _count: count });
    setBusy(false);
    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success(t("codeSuccess"));
    await queryClient.invalidateQueries({ queryKey: ["admin-codes"] });
  };

  return (
    <div className="min-h-screen bg-background">
      <header className="bg-ink text-ink-foreground">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-5">
          <div className="flex items-center gap-2 font-extrabold">
            <ShieldCheck className="size-5" /> {t("adminPanel")}
          </div>
          <button onClick={() => signOut()} className="flex items-center gap-1.5 text-sm font-bold opacity-80">
            <LogOut className="size-4" /> {t("logout")}
          </button>
        </div>
      </header>

      <main className="mx-auto max-w-6xl space-y-8 px-4 py-10">
        <section className="rounded-3xl border border-border bg-card p-7 shadow-soft">
          <h2 className="flex items-center gap-2 text-lg font-extrabold">
            <KeyRound className="size-5 text-primary" /> {t("generateCodes")}
          </h2>
          <div className="mt-5 grid gap-3 sm:grid-cols-[2fr_1fr_auto]">
            <select
              value={courseId}
              onChange={(e) => setCourseId(e.target.value)}
              className="rounded-2xl border border-border bg-background px-4 py-3 text-sm"
            >
              <option value="">{t("course")}</option>
              {courses?.map((c) => (
                <option key={c.id} value={c.id}>
                  {lang === "ar" ? c.title_ar : c.title_en}
                </option>
              ))}
            </select>
            <input
              type="number"
              min={1}
              max={100}
              value={count}
              onChange={(e) => setCount(Number(e.target.value))}
              className="rounded-2xl border border-border bg-background px-4 py-3 text-sm"
              placeholder={t("count")}
            />
            <button
              disabled={busy}
              onClick={generate}
              className="rounded-2xl bg-primary px-7 py-3 text-sm font-extrabold text-primary-foreground disabled:opacity-60"
            >
              {busy ? t("loading") : t("generate")}
            </button>
          </div>
        </section>

        <AdminLessons courses={courses ?? []} lang={lang} />



        <section className="overflow-hidden rounded-3xl border border-border bg-card shadow-soft">
          <table className="w-full text-start text-sm">
            <thead className="bg-secondary text-secondary-foreground">
              <tr>
                <th className="p-4 text-start">{t("code")}</th>
                <th className="p-4 text-start">{t("course")}</th>
                <th className="p-4 text-start">{t("status")}</th>
              </tr>
            </thead>
            <tbody>
              {codes?.map((c) => (
                <tr key={c.id} className="border-t border-border">
                  <td className="p-4 font-mono font-bold tracking-widest">
                    <button
                      className="inline-flex items-center gap-2"
                      onClick={() => {
                        navigator.clipboard.writeText(c.code);
                        toast.success(c.code);
                      }}
                    >
                      {c.code} <Copy className="size-3.5 text-muted-foreground" />
                    </button>
                  </td>
                  <td className="p-4">{c.course_title}</td>
                  <td className="p-4">
                    {c.used_by ? (
                      <span className="rounded-full bg-secondary px-3 py-1 text-xs font-bold">
                        {t("used")} — {c.used_by_name || t("usedBy")}
                      </span>
                    ) : (
                      <span className="rounded-full bg-accent-gradient px-3 py-1 text-xs font-bold text-accent-foreground">
                        {t("available")}
                      </span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>
      </main>
    </div>
  );
}
