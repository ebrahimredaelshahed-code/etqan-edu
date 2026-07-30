import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { BookOpen, KeyRound, Phone, User, Users } from "lucide-react";
import { SiteLayout } from "@/components/site/SiteLayout";
import { useI18n } from "@/lib/i18n";
import { useAuth } from "@/lib/auth";
import { supabase } from "@/integrations/supabase/client";

type Tab = "profile" | "courses";

export const Route = createFileRoute("/account")({
  validateSearch: (search: Record<string, unknown>): { tab: Tab } => ({
    tab: search.tab === "courses" ? "courses" : "profile",
  }),
  head: () => ({
    meta: [
      { title: "حساب المتدرب | My account — Etqan Academy" },
      { name: "description", content: "ملفك الشخصي والدورات المشترك بها على منصة إتقان." },
      { property: "og:title", content: "حساب المتدرب | Etqan Academy" },
      { property: "og:description", content: "إدارة بياناتك ومتابعة دوراتك." },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: AccountPage,
});

function AccountPage() {
  const { tab } = Route.useSearch();
  const { t, lang } = useI18n();
  const { user, profile, loading } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    if (!loading && !user) navigate({ to: "/auth", search: { mode: "login" } });
  }, [loading, user, navigate]);

  const { data: courses } = useQuery({
    queryKey: ["my-courses", user?.id],
    enabled: Boolean(user),
    queryFn: async () => {
      const { data: enrollments } = await supabase.from("enrollments").select("course_id");
      const ids = (enrollments ?? []).map((e) => e.course_id);
      if (!ids.length) return [];
      const { data } = await supabase.from("courses").select("*").in("id", ids);
      return data ?? [];
    },
  });

  return (
    <SiteLayout>
      <div className="mx-auto max-w-5xl px-4 py-14">
        <h1 className="text-3xl font-extrabold">{t("account")}</h1>

        <div className="mt-6 inline-flex gap-1 rounded-full border border-border bg-card p-1 shadow-soft">
          <Link
            to="/account"
            search={{ tab: "profile" }}
            className={`rounded-full px-5 py-2.5 text-sm font-bold ${tab === "profile" ? "bg-primary text-primary-foreground" : "text-muted-foreground"}`}
          >
            {t("profile")}
          </Link>
          <Link
            to="/account"
            search={{ tab: "courses" }}
            className={`rounded-full px-5 py-2.5 text-sm font-bold ${tab === "courses" ? "bg-primary text-primary-foreground" : "text-muted-foreground"}`}
          >
            {t("myCourses")}
          </Link>
        </div>

        {tab === "profile" ? (
          <>
            <div className="mt-8 grid gap-4 sm:grid-cols-2">
              <InfoCard icon={User} label={t("fullName")} value={profile?.full_name || "—"} />
              <InfoCard icon={Phone} label={t("phone")} value={profile?.phone || "—"} />
              <InfoCard icon={Users} label={t("guardianPhone")} value={profile?.guardian_phone || "—"} />
              <InfoCard icon={BookOpen} label={t("myCourses")} value={String(courses?.length ?? 0)} />
            </div>
            <PasswordCard />
          </>
        ) : (
          <div className="mt-8 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {!courses?.length ? (
              <p className="text-muted-foreground">{t("noCourses")}</p>
            ) : (
              courses.map((course) => (
                <Link
                  key={course.id}
                  to="/courses/$courseId"
                  params={{ courseId: course.id }}
                  className="overflow-hidden rounded-3xl border border-border bg-card shadow-soft transition-transform hover:-translate-y-1"
                >
                  <img
                    src={course.image_url}
                    alt={lang === "ar" ? course.title_ar : course.title_en}
                    loading="lazy"
                    width={1280}
                    height={720}
                    className="h-36 w-full object-cover"
                  />
                  <div className="p-5">
                    <h2 className="font-extrabold">{lang === "ar" ? course.title_ar : course.title_en}</h2>
                    <p className="mt-2 text-sm font-bold text-primary">{t("enterCourse")} →</p>
                  </div>
                </Link>
              ))
            )}
          </div>
        )}
      </div>
    </SiteLayout>
  );
}

function InfoCard({
  icon: Icon,
  label,
  value,
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  value: string;
}) {
  return (
    <div className="rounded-3xl border border-border bg-card p-6 shadow-soft">
      <Icon className="size-5 text-primary" />
      <p className="mt-3 text-xs font-semibold text-muted-foreground">{label}</p>
      <p className="text-lg font-extrabold">{value}</p>
    </div>
  );
}
