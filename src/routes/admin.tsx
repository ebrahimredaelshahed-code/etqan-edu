import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { Film, KeyRound, Layers, LogOut, ShieldCheck, Users } from "lucide-react";
import { useI18n } from "@/lib/i18n";
import { useAuth } from "@/lib/auth";
import { supabase } from "@/integrations/supabase/client";
import { getAdminAccess, type AdminAccess } from "@/lib/admin.functions";
import { AdminLessons } from "@/components/admin/AdminLessons";
import { AdminCatalog } from "@/components/admin/AdminCatalog";
import { AdminCodes } from "@/components/admin/AdminCodes";
import { AdminAdmins } from "@/components/admin/AdminAdmins";
import { AdminUsers } from "@/components/admin/AdminUsers";
import { AdminQuizzes } from "@/components/admin/AdminQuizzes";


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
  const fetchAccess = useServerFn(getAdminAccess);
  const { data: access, isLoading: accessLoading } = useQuery({
    queryKey: ["admin-access", user?.id],
    enabled: Boolean(user && isAdmin),
    queryFn: () => fetchAccess({}),
  });

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

  if (accessLoading || !access) return <Shell>{t("loading")}</Shell>;

  return <AdminDashboard lang={lang} access={access} />;
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
          autoComplete="username"
          className="w-full rounded-2xl border border-border bg-background px-4 py-3 text-sm outline-none focus:border-primary"
          required
        />
        <input
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          placeholder={t("password")}
          autoComplete="current-password"
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

const TABS = [
  { id: "codes", label: "tabCodes", icon: KeyRound },
  { id: "catalog", label: "tabCatalog", icon: Layers },
  { id: "videos", label: "tabVideos", icon: Film },
  { id: "users", label: "tabUsers", icon: Users },
  { id: "admins", label: "tabAdmins", icon: ShieldCheck },
] as const;

function AdminDashboard({ lang, access }: { lang: "ar" | "en"; access: AdminAccess }) {
  const { t } = useI18n();
  const { signOut } = useAuth();
  const [tab, setTab] = useState<(typeof TABS)[number]["id"]>("codes");

  const { data: categories } = useQuery({
    queryKey: ["admin-categories"],
    queryFn: async () => (await supabase.from("categories").select("*").order("sort_order")).data ?? [],
  });

  const { data: courses } = useQuery({
    queryKey: ["admin-courses"],
    queryFn: async () => (await supabase.from("courses").select("*").order("title_ar")).data ?? [],
  });

  const visibleCategories = (categories ?? []).filter((category) => access.isSuperAdmin || access.categoryIds.includes(category.id));
  const visibleCourses = (courses ?? []).filter((course) => access.isSuperAdmin || access.categoryIds.includes(course.category_id));
  const visibleTabs = TABS.filter(({ id }) => {
    if (access.isSuperAdmin) return true;
    if (id === "codes") return access.permissions.codes;
    if (id === "catalog") return access.permissions.catalog;
    if (id === "videos") return access.permissions.videos;
    if (id === "users") return access.permissions.users;
    return false;
  });
  const activeTab = visibleTabs.some(({ id }) => id === tab) ? tab : visibleTabs[0]?.id;

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
        <nav className="flex flex-wrap gap-2 rounded-3xl border border-border bg-card p-2 shadow-soft">
          {visibleTabs.map(({ id, label, icon: Icon }) => (
            <button
              key={id}
              onClick={() => setTab(id)}
              className={`inline-flex flex-1 items-center justify-center gap-2 rounded-2xl px-4 py-3 text-sm font-extrabold transition ${
                tab === id ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:bg-secondary"
              }`}
            >
              <Icon className="size-4" /> {t(label)}
            </button>
          ))}
        </nav>

        {activeTab === "codes" && <AdminCodes categories={visibleCategories} courses={visibleCourses} lang={lang} />}
        {activeTab === "catalog" && <AdminCatalog lang={lang} categoryIds={access.categoryIds} isSuperAdmin={access.isSuperAdmin} />}
        {activeTab === "videos" && (
          <div className="space-y-8">
            <AdminLessons categories={visibleCategories} courses={visibleCourses} lang={lang} />
            <AdminQuizzes categories={visibleCategories} courses={visibleCourses} lang={lang} />
          </div>
        )}
        {activeTab === "users" && <AdminUsers categories={visibleCategories} courses={visibleCourses} isSuperAdmin={access.isSuperAdmin} />}
        {activeTab === "admins" && <AdminAdmins categories={visibleCategories} lang={lang} />}
      </main>
    </div>
  );
}

