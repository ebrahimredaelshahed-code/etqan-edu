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
        <h1 className="text-4xl font-extrabold">{t("browseCategories")}</h1>

        {isLoading ? (
          <p className="mt-10 text-muted-foreground">{t("loading")}</p>
        ) : (
          <div className="mt-10 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {data?.map((c) => {
              const Icon = (Icons as unknown as Record<string, Icons.LucideIcon>)[c.icon] ?? Icons.BookOpen;
              const slug = c.slug?.trim() ? c.slug : c.id;
              return (
                <article
                  key={c.id}
                  className="group overflow-hidden rounded-3xl border border-border bg-card shadow-soft transition-all hover:-translate-y-1 hover:shadow-lift"
                >
                  <div className="relative flex h-52 items-end justify-center overflow-hidden bg-[hsl(150_60%_38%)]">
                    <span className="absolute inset-x-0 top-0 h-24 bg-[radial-gradient(circle_at_50%_0%,hsl(0_0%_100%/0.25),transparent_70%)]" />
                    {c.teacher_image_url ? (
                      <img
                        src={c.teacher_image_url}
                        alt={c.teacher_name || (lang === "ar" ? c.name_ar : c.name_en)}
                        loading="lazy"
                        className="relative h-full w-auto object-contain drop-shadow-xl"
                      />
                    ) : (
                      <Icon className="relative mb-16 size-14 text-ink-foreground/80" />
                    )}
                  </div>

                  <div className="space-y-1 p-6 text-center">
                    <h2 className="text-xl font-extrabold">{lang === "ar" ? c.name_ar : c.name_en}</h2>
                    <p className="text-sm font-bold text-muted-foreground">
                      {c.teacher_name?.trim() ? c.teacher_name : t("teacher")}
                    </p>
                    <Link
                      to="/categories/$slug"
                      params={{ slug }}
                      className="mt-4 block w-full rounded-full bg-accent-gradient px-5 py-3 text-sm font-extrabold text-accent-foreground shadow-soft"
                    >
                      {t("subscribeNow")}
                    </Link>
                  </div>
                </article>
              );
            })}
          </div>

        )}
      </div>
    </SiteLayout>
  );
}
