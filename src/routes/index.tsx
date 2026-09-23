import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import {
  ArrowLeft,
  Sparkles,
  ShieldCheck,
  PlayCircle,
  Trophy,
} from "lucide-react";

import { SiteLayout } from "@/components/site/SiteLayout";
import { useI18n } from "@/lib/i18n";
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

  const aboutPoints = [
    { icon: PlayCircle, title: t("aboutPoint1") },
    { icon: ShieldCheck, title: t("aboutPoint2") },
    { icon: Trophy, title: t("aboutPoint3") },
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
        <div className="relative mx-auto grid max-w-6xl items-center gap-10 px-4 py-14 sm:py-20 lg:py-24">
          <div className="max-w-2xl space-y-6">
            <span className="inline-flex items-center gap-2 rounded-full border border-white/20 bg-white/10 px-4 py-1.5 text-sm font-semibold">
              <Sparkles className="size-4" /> {t("tagline")}
            </span>
            <h1 className="text-4xl font-extrabold leading-tight sm:text-6xl">
              {lang === "ar" ? (
                <>
                  مناهجك الدراسية .. <span className="text-accent">في مكانٍ واحد!!</span>
                </>
              ) : (
                t("heroTitle")
              )}
            </h1>

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

      {/* About */}
      <section className="relative z-10 mx-auto -mt-16 max-w-6xl px-4 pb-24 sm:-mt-20">
        <div className="overflow-hidden rounded-[2rem] border border-border bg-card shadow-lift">
          <div className="grid gap-10 p-8 sm:p-12 md:grid-cols-[1.1fr_1fr]">
            <div className="space-y-5">
              <span className="inline-flex items-center gap-2 rounded-full bg-secondary px-4 py-1.5 text-xs font-extrabold text-primary">
                <Sparkles className="size-4" /> {t("aboutTitle")}
              </span>
              <h2 className="text-3xl font-extrabold leading-snug sm:text-4xl">{t("aboutHeadline")}</h2>
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
                  className="flex items-center gap-4 rounded-2xl border border-border bg-secondary/60 p-5"
                >
                  <span className="flex size-11 shrink-0 items-center justify-center rounded-2xl bg-accent-gradient text-accent-foreground">
                    <p.icon className="size-5" />
                  </span>
                  <p className="text-base font-extrabold">{p.title}</p>
                </li>
              ))}
            </ul>
          </div>
        </div>
      </section>
    </SiteLayout>
  );
}
