import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { ArrowLeft, PlayCircle, ShieldCheck, Sparkles, Trophy, Layers, GraduationCap } from "lucide-react";
import { SiteLayout } from "@/components/site/SiteLayout";
import { useI18n } from "@/lib/i18n";
import { supabase } from "@/integrations/supabase/client";
import heroIllustration from "@/assets/hero-illustration.png";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "منصة إتقان — دورات تدريبية أونلاين باحتراف" },
      {
        name: "description",
        content:
          "منصة إتقان للتعليم الإلكتروني: دورات في البرمجة والتصميم والأعمال مع متابعة التقدم ومحاضرات فيديو عالية الجودة.",
      },
      { property: "og:title", content: "منصة إتقان — دورات تدريبية أونلاين باحتراف" },
      {
        property: "og:description",
        content: "تصفح الأقسام واشترك في دوراتك المفضلة وتابع تقدمك خطوة بخطوة على منصة إتقان.",
      },
    ],
  }),
  component: Index,
});

function Index() {
  const { t, lang } = useI18n();

  const { data: stats } = useQuery({
    queryKey: ["home-stats"],
    queryFn: async () => {
      const [courses, lessons] = await Promise.all([
        supabase.from("courses").select("id, duration_hours"),
        supabase.from("lessons").select("id"),
      ]);
      return {
        courses: courses.data?.length ?? 0,
        hours: Math.round(courses.data?.reduce((a, c) => a + Number(c.duration_hours), 0) ?? 0),
        lessons: lessons.data?.length ?? 0,
      };
    },
  });

  return (
    <SiteLayout>
      {/* Bento hero */}
      <section className="mx-auto max-w-6xl px-4 pb-10 pt-10 sm:pt-14">
        <div className="grid gap-4 md:grid-cols-3 md:grid-rows-2">
          {/* main tile */}
          <div className="relative isolate overflow-hidden rounded-4xl border border-border bg-hero-gradient p-8 text-ink-foreground shadow-lift sm:p-12 md:col-span-2 md:row-span-2">
            <div className="grid items-center gap-6 sm:grid-cols-[1.15fr_0.85fr]">
              <div className="space-y-6">
                <span className="inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/10 px-4 py-1.5 text-xs font-semibold backdrop-blur">
                  <Sparkles className="size-4 text-primary" /> {t("brand")}
                </span>
                <h1 className="font-display text-3xl font-bold leading-[1.2] sm:text-4xl">{t("heroTitle")}</h1>
                <p className="text-base opacity-80">{t("heroSubtitle")}</p>
                <Link
                  to="/categories"
                  className="inline-flex items-center gap-2 rounded-full bg-accent-gradient px-7 py-4 text-base font-bold text-accent-foreground shadow-lift transition-transform hover:-translate-y-1"
                >
                  {t("browseCategories")}
                  <ArrowLeft className={lang === "ar" ? "size-5" : "size-5 rotate-180"} />
                </Link>
              </div>
              <img
                src={heroIllustration}
                alt="رسم توضيحي لمتدرب يتابع دورة تدريبية عبر الإنترنت"
                width={1200}
                height={1008}
                className="pointer-events-none mx-auto w-full max-w-sm select-none"
              />
            </div>
          </div>


          {/* stat tiles */}
          <div className="rounded-4xl border border-border bg-card p-6 shadow-soft">
            <PlayCircle className="size-6 text-primary" />
            <p className="mt-4 font-display text-3xl font-bold">{stats?.courses ?? 0}+</p>
            <p className="text-sm text-muted-foreground">{t("stat2")}</p>
          </div>
          <div className="rounded-4xl border border-border bg-accent-gradient p-6 text-accent-foreground shadow-soft">
            <Trophy className="size-6" />
            <p className="mt-4 font-display text-3xl font-bold">{stats?.hours ?? 0}+</p>
            <p className="text-sm opacity-80">{t("stat3")}</p>
          </div>
        </div>
      </section>

      {/* Secondary bento row */}
      <section className="mx-auto max-w-6xl px-4">
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {[
            { label: t("stat1"), value: "1,200+", icon: ShieldCheck },
            { label: t("stat4"), value: "98%", icon: Sparkles },
            { label: t("progress"), value: `${stats?.lessons ?? 0}+`, icon: Layers },
            { label: t("subscriptionCode"), value: "✓", icon: GraduationCap },
          ].map((s) => (
            <div
              key={s.label}
              className="rounded-3xl border border-border bg-card/70 p-5 shadow-soft transition-transform hover:-translate-y-1"
            >
              <span className="flex size-10 items-center justify-center rounded-2xl bg-secondary">
                <s.icon className="size-5 text-primary" />
              </span>
              <p className="mt-4 font-display text-2xl font-bold">{s.value}</p>
              <p className="text-xs text-muted-foreground">{s.label}</p>
            </div>
          ))}
        </div>
      </section>

      {/* About */}
      <section className="mx-auto max-w-6xl px-4 py-16">
        <div className="grid items-center gap-10 rounded-4xl border border-border bg-card p-8 shadow-soft sm:p-12 md:grid-cols-2">
          <div className="space-y-4">
            <h2 className="font-display text-3xl font-bold">{t("aboutTitle")}</h2>
            <p className="leading-relaxed text-muted-foreground">{t("aboutText")}</p>
            <Link
              to="/categories"
              className="inline-flex rounded-full bg-primary px-6 py-3 text-sm font-bold text-primary-foreground shadow-soft transition-transform hover:-translate-y-0.5"
            >
              {t("browseCategories")}
            </Link>
          </div>
          <ul className="space-y-3">
            {[t("stat2"), t("stat3"), t("progress"), t("subscriptionCode")].map((item, i) => (
              <li
                key={item}
                className="flex items-center gap-3 rounded-2xl bg-secondary px-5 py-4 text-sm font-semibold text-secondary-foreground"
              >
                <span className="flex size-8 items-center justify-center rounded-full bg-accent-gradient text-xs font-bold text-accent-foreground">
                  {i + 1}
                </span>
                {item}
              </li>
            ))}
          </ul>
        </div>
      </section>
    </SiteLayout>
  );
}
