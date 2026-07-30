import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import * as Icons from "lucide-react";
import { SiteLayout } from "@/components/site/SiteLayout";
import { useI18n } from "@/lib/i18n";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/categories/")({
  head: () => ({
    meta: [
      { title: "الأقسام التدريبية | Categories — Etqan Academy" },
      {
        name: "description",
        content: "تصفح أقسام منصة إتقان: البرمجة، التصميم، إدارة الأعمال واللغات، واختر دورتك.",
      },
      { property: "og:title", content: "الأقسام التدريبية | Etqan Academy" },
      { property: "og:description", content: "اختر مجالك وابدأ رحلتك التعليمية على منصة إتقان." },
    ],
  }),
  component: CategoriesPage,
});

function CategoriesPage() {
  const { t, lang } = useI18n();
  const { data, isLoading } = useQuery({
    queryKey: ["categories"],
    queryFn: async () => {
      const { data, error } = await supabase.from("categories").select("*").order("sort_order");
      if (error) throw error;
      return data;
    },
  });

  return (
    <SiteLayout>
      <div className="mx-auto max-w-6xl px-4 py-16">
        <h1 className="text-4xl font-extrabold">{t("categories")}</h1>
        <p className="mt-2 text-muted-foreground">{t("categoriesSubtitle")}</p>

        {isLoading ? (
          <p className="mt-10 text-muted-foreground">{t("loading")}</p>
        ) : (
          <div className="mt-10 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {data?.map((c) => {
              const Icon = (Icons as unknown as Record<string, Icons.LucideIcon>)[c.icon] ?? Icons.BookOpen;
              return (
                <Link
                  key={c.id}
                  to="/categories/$slug"
                  params={{ slug: c.slug }}
                  className="group rounded-3xl border border-border bg-card p-7 shadow-soft transition-all hover:-translate-y-1 hover:shadow-lift"
                >
                  <span className="flex size-12 items-center justify-center rounded-2xl bg-hero-gradient text-ink-foreground">
                    <Icon className="size-6" />
                  </span>
                  <h2 className="mt-5 text-xl font-extrabold">{lang === "ar" ? c.name_ar : c.name_en}</h2>
                  <p className="mt-1.5 text-sm text-muted-foreground">
                    {lang === "ar" ? c.description_ar : c.description_en}
                  </p>
                  <span className="mt-5 inline-flex w-full items-center justify-center rounded-full bg-primary px-5 py-3 text-sm font-extrabold text-primary-foreground transition group-hover:brightness-110">
                    {t("subscribeAndView")}
                  </span>
                </Link>
              );
            })}
          </div>
        )}
      </div>
    </SiteLayout>
  );
}
