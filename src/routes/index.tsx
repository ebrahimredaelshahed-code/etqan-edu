import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import {
  ArrowLeft,
  BookOpen,
  GraduationCap,
  Users,
  Sparkles,
  Smile,
  ShieldCheck,
  PlayCircle,
  Trophy,
} from "lucide-react";
import { SiteLayout } from "@/components/site/SiteLayout";
import { useI18n } from "@/lib/i18n";
import { supabase } from "@/integrations/supabase/client";
import { TeacherPhoto } from "@/components/site/TeacherPhoto";
import heroPattern from "@/assets/hero-pattern.png";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "منصة إتقان — مناهجك الدراسية في مكان واحد" },
      {
        name: "description",
        content:
          "منصة إتقان للتعليم الإلكتروني: اختر معلمك، تابع دروسك بالفيديو، وتعلّم بأسلوب يناسبك في جميع المواد.",
      },
      { property: "og:title", content: "منصة إتقان — مناهجك الدراسية في مكان واحد" },
      {
        property: "og:description",
        content: "اختر معلمك وتابع دروسك بالفيديو على منصة إتقان للتعليم الإلكتروني.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: Index,
});

function Index() {
  const { t, lang } = useI18n();

  const { data: teachers } = useQuery({
    queryKey: ["home-teachers"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("categories")
        .select("id, slug, name_ar, description_ar, teacher_name, teacher_image_url")
        .order("sort_order");
      if (error) throw error;
      return data;
    },
  });

  const { data: stats } = useQuery({
    queryKey: ["home-stats"],
    queryFn: async () => {
      const [courses, categories] = await Promise.all([
        supabase.from("courses").select("id, duration_hours"),
        supabase.from("categories").select("id"),
      ]);
      return {
        courses: courses.data?.length ?? 0,
        teachers: categories.data?.length ?? 0,
        hours: Math.round(courses.data?.reduce((a, c) => a + Number(c.duration_hours), 0) ?? 0),
      };
    },
  });

  const statCards = [
    { label: t("statTeachers"), value: `${stats?.teachers ?? 0}+`, icon: GraduationCap },
    { label: t("statSubjects"), value: `${stats?.courses ?? 0}+`, icon: BookOpen },
    { label: t("statStudents"), value: "1,200+", icon: Users },
    { label: t("stat4"), value: "98%", icon: Smile },
  ];

  const aboutPoints = [
    { icon: PlayCircle, title: t("aboutPoint1"), text: t("aboutPoint1Text") },
    { icon: ShieldCheck, title: t("aboutPoint2"), text: t("aboutPoint2Text") },
    { icon: Trophy, title: t("aboutPoint3"), text: t("aboutPoint3Text") },
  ];

  return (
    <SiteLayout>
      <section className="relative isolate overflow-hidden bg-hero-gradient text-ink-foreground">
        <img
          src={heroPattern}
          alt=""
          width={1920}
          height={1080}
          className="absolute inset-0 size-full object-cover opacity-60"
        />
        <div className="relative mx-auto grid max-w-6xl gap-10 px-4 py-24 sm:py-32">
          <div className="max-w-2xl space-y-6">
            <span className="inline-flex items-center gap-2 rounded-full border border-white/20 bg-white/10 px-4 py-1.5 text-sm font-semibold">
              <Sparkles className="size-4" /> {t("tagline")}
            </span>
            <h1 className="text-4xl font-extrabold leading-tight sm:text-6xl">{t("heroTitle")}</h1>

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

      {/* Teachers strip */}
      <section className="mx-auto max-w-6xl px-4 py-16">
        <div className="flex items-end justify-between gap-4">
          <div>
            <h2 className="text-3xl font-extrabold sm:text-4xl">{t("leadTitle")}</h2>
            <p className="mt-2 text-sm text-muted-foreground">{t("leadSubtitle")}</p>
          </div>
          <Link
            to="/categories"
            className="hidden shrink-0 rounded-full border border-border px-5 py-2.5 text-sm font-bold text-primary transition-colors hover:bg-secondary sm:inline-flex"
          >
            {t("browseCategories")}
          </Link>
        </div>

        <div className="marquee mt-8 overflow-hidden">
          <div className="marquee-track flex w-max gap-5">
            {[...(teachers ?? []), ...(teachers ?? [])].map((c, i) => (
              <div
                key={`${c.id}-${i}`}
                aria-hidden={i >= (teachers?.length ?? 0)}
                className="pointer-events-none w-[240px] shrink-0 select-none overflow-hidden rounded-3xl border border-border bg-card shadow-soft"
              >
                <div className="relative h-[220px] overflow-hidden bg-hero-gradient">
                  <TeacherPhoto
                    value={c.teacher_image_url}
                    alt={c.teacher_name || c.name_ar}
                    className="absolute inset-0 size-full object-cover object-top"
                  />
                </div>
                <div className="space-y-1 p-5">
                  <p className="text-lg font-extrabold">{c.teacher_name || c.name_ar}</p>
                  <p className="text-sm font-semibold text-primary">{c.name_ar}</p>
                  {c.description_ar && (
                    <p className="line-clamp-1 text-xs text-muted-foreground">{c.description_ar}</p>
                  )}
                </div>
              </div>
            ))}
          </div>
          {!teachers?.length && <p className="text-muted-foreground">{t("loading")}</p>}
        </div>
      </section>


      {/* About */}
      <section className="mx-auto max-w-6xl px-4 pb-24">
        <div className="overflow-hidden rounded-[2rem] border border-border bg-card shadow-soft">
          <div className="grid gap-10 p-8 sm:p-12 md:grid-cols-[1.1fr_1fr]">
            <div className="space-y-5">
              <span className="inline-flex items-center gap-2 rounded-full bg-secondary px-4 py-1.5 text-xs font-extrabold text-primary">
                <Sparkles className="size-4" /> {t("aboutTitle")}
              </span>
              <h2 className="text-3xl font-extrabold leading-snug sm:text-4xl">{t("aboutHeadline")}</h2>
              <p className="leading-relaxed text-muted-foreground">{t("aboutText")}</p>
              <Link
                to="/categories"
                className="inline-flex items-center gap-2 rounded-full bg-hero-gradient px-6 py-3 text-sm font-extrabold text-ink-foreground shadow-soft transition-transform hover:-translate-y-1"
              >
                {t("browseCategories")}
                <ArrowLeft className={lang === "ar" ? "size-4" : "size-4 rotate-180"} />
              </Link>
            </div>

            <ul className="space-y-4">
              {aboutPoints.map((p) => (
                <li
                  key={p.title}
                  className="flex items-start gap-4 rounded-2xl border border-border bg-secondary/60 p-5"
                >
                  <span className="flex size-11 shrink-0 items-center justify-center rounded-2xl bg-accent-gradient text-accent-foreground">
                    <p.icon className="size-5" />
                  </span>
                  <div>
                    <p className="font-extrabold">{p.title}</p>
                    <p className="mt-1 text-sm leading-relaxed text-muted-foreground">{p.text}</p>
                  </div>
                </li>
              ))}
            </ul>
          </div>
        </div>
      </section>
    </SiteLayout>
  );
}
