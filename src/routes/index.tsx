import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { ArrowLeft, PlayCircle, ShieldCheck, Sparkles, Trophy } from "lucide-react";
import { SiteLayout } from "@/components/site/SiteLayout";
import { useI18n } from "@/lib/i18n";
import { supabase } from "@/integrations/supabase/client";
import heroPattern from "@/assets/hero-pattern.png.asset.json";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Etqan" },
      {
        name: "description",
        content:
          "منصة إتقان للتعليم الإلكتروني.",
      },
      { property: "og:title", content: "منصة إتقان — تعلم إلكتروني احترافي | Etqan Academy" },
      {
        property: "og:description",
        content: "منصه اتقان للتعلمالاكلتروني ",
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
      <section className="relative isolate overflow-hidden bg-hero-gradient text-ink-foreground">
        <img
          src={heroImage}
          alt=""
          width={1600}
          height={900}
          className="absolute inset-0 size-full object-cover opacity-25"
        />
        <div className="relative mx-auto grid max-w-6xl gap-10 px-4 py-24 sm:py-32">
          <div className="max-w-2xl space-y-6">
            <span className="inline-flex items-center gap-2 rounded-full border border-white/20 bg-white/10 px-4 py-1.5 text-sm font-semibold">
              <Sparkles className="size-4" /> {t("tagline")}
            </span>
            <h1 className="text-4xl font-extrabold leading-tight sm:text-6xl">{t("heroTitle")}</h1>
            <p className="text-lg opacity-85">{t("heroSubtitle")}</p>
            <Link
              to="/categories"
              className="inline-flex items-center gap-2 rounded-full bg-accent-gradient px-7 py-4 text-base font-extrabold text-accent-foreground shadow-lift transition-transform hover:-translate-y-1"
            >
              {t("browseCategories")}
              <ArrowLeft className={lang === "ar" ? "size-5" : "size-5 rotate-180"} />
            </Link>
          </div>
        </div>
      </section>

      <section className="mx-auto -mt-12 grid max-w-6xl grid-cols-2 gap-4 px-4 sm:grid-cols-4">
        {[
          { label: t("stat2"), value: `${stats?.courses ?? 0}+`, icon: PlayCircle },
          { label: t("stat3"), value: `${stats?.hours ?? 0}+`, icon: Trophy },
          { label: t("stat1"), value: "1,200+", icon: ShieldCheck },
          { label: t("stat4"), value: "98%", icon: Sparkles },
        ].map((s) => (
          <div key={s.label} className="rounded-2xl border border-border bg-card p-5 shadow-soft">
            <s.icon className="size-5 text-primary" />
            <p className="mt-3 text-2xl font-extrabold">{s.value}</p>
            <p className="text-xs text-muted-foreground">{s.label}</p>
          </div>
        ))}
      </section>

      <section className="mx-auto max-w-6xl px-4 py-20">
        <div className="grid items-center gap-10 rounded-3xl border border-border bg-card p-8 shadow-soft sm:p-12 md:grid-cols-2">
          <div className="space-y-4">
            <h2 className="text-3xl font-extrabold">{t("aboutTitle")}</h2>
            <p className="leading-relaxed text-muted-foreground">{t("aboutText")}</p>
            <Link
              to="/categories"
              className="inline-flex rounded-full bg-primary px-6 py-3 text-sm font-bold text-primary-foreground shadow-soft"
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
                <span className="flex size-8 items-center justify-center rounded-full bg-accent-gradient text-xs font-extrabold text-accent-foreground">
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
