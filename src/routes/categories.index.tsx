import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { ArrowLeft, BookOpen, GraduationCap, User } from "lucide-react";
import { SiteLayout } from "@/components/site/SiteLayout";
import { useI18n } from "@/lib/i18n";
import { useAuth } from "@/lib/auth";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/categories/")({
  head: () => ({
    meta: [
      { title: "إختار معلمك | Etqan Academy" },
      {
        name: "description",
        content: "تصفح المواد الدراسية ومعلميها على منصة إتقان واشترك في المادة التي تناسبك.",
      },
      { property: "og:title", content: "إختار معلمك | Etqan Academy" },
      { property: "og:description", content: "اختر مادتك ومعلمك وابدأ رحلتك التعليمية على منصة إتقان." },
    ],
  }),
  component: CategoriesPage,
});

function CategoriesPage() {
  const { t, lang } = useI18n();
  const { user } = useAuth();
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const { data, isLoading } = useQuery({
    queryKey: ["categories"],
    queryFn: async () => {
      const { data, error } = await supabase.from("categories").select("*").order("sort_order");
      if (error) throw error;
      return data;
    },
  });

  const { data: subscribed } = useQuery({
    queryKey: ["my-category-subscriptions", user?.id],
    enabled: Boolean(user),
    queryFn: async () => {
      const { data } = await supabase.from("category_subscriptions").select("category_id");
      return (data ?? []).map((row) => row.category_id);
    },
  });

  const goToCourses = (slug: string) => navigate({ to: "/categories/$slug", params: { slug } });

  const subscribe = async (categoryId: string, slug: string) => {
    if (!user) {
      toast.error(t("mustLogin"));
      navigate({ to: "/auth", search: { mode: "login" } });
      return;
    }
    const { error } = await supabase
      .from("category_subscriptions")
      .insert({ user_id: user.id, category_id: categoryId });
    if (error && !error.message.includes("duplicate")) {
      toast.error(error.message);
      return;
    }
    await queryClient.invalidateQueries({ queryKey: ["my-category-subscriptions"] });
    toast.success(t("subscribedOk"));
    goToCourses(slug);
  };

  return (
    <SiteLayout>
      <div className="mx-auto max-w-6xl px-4 py-16">
        <h1 className="text-4xl font-extrabold">{t("browseCategories")}</h1>

        {isLoading ? (
          <p className="mt-10 text-muted-foreground">{t("loading")}</p>
        ) : (
          <div className="mt-10 grid gap-7 md:grid-cols-2">
            {data?.map((c) => {
              const slug = c.slug?.trim() ? c.slug : c.id;
              const isSubscribed = subscribed?.includes(c.id);
              const name = lang === "ar" ? c.name_ar : c.name_en;
              const specialty = lang === "ar" ? c.description_ar : c.description_en;
              return (
                <article
                  key={c.id}
                  className="relative flex min-h-[280px] overflow-hidden rounded-[2rem] border border-border bg-card shadow-soft transition-all hover:-translate-y-1 hover:shadow-lift"
                >
                  <div className="relative z-10 flex w-[58%] flex-col justify-between p-7">
                    <div>
                      <span className="flex size-12 items-center justify-center rounded-full bg-hero-gradient text-ink-foreground">
                        <BookOpen className="size-6" />
                      </span>
                      <h2 className="mt-5 text-3xl font-extrabold leading-tight">{name}</h2>
                      {c.teacher_name && (
                        <p className="mt-4 flex items-center gap-2 text-lg font-extrabold text-foreground">
                          <User className="size-5 text-muted-foreground" />
                          {c.teacher_name}
                        </p>
                      )}
                      {specialty && (
                        <span className="mt-3 inline-flex items-center gap-2 rounded-xl bg-secondary px-4 py-2 text-sm font-bold text-primary">
                          <GraduationCap className="size-4" />
                          {specialty}
                        </span>
                      )}
                    </div>

                    <div className="mt-6 border-t border-border pt-5">
                      <button
                        onClick={() => (isSubscribed ? goToCourses(slug) : subscribe(c.id, slug))}
                        className="inline-flex items-center gap-3 rounded-2xl bg-hero-gradient px-7 py-3.5 text-sm font-extrabold text-ink-foreground shadow-soft"
                      >
                        {isSubscribed ? t("enterSubject") : t("subscribeNow")}
                        <ArrowLeft className="size-4 rtl:rotate-0 ltr:rotate-180" />
                      </button>
                    </div>
                  </div>

                  <div
                    className="absolute inset-y-0 left-0 w-[48%] overflow-hidden bg-hero-gradient"
                    style={{ borderTopRightRadius: "60% 100%", borderBottomRightRadius: "60% 100%" }}
                  >
                    <TeacherPhoto
                      value={c.teacher_image_url}
                      alt={c.teacher_name || name}
                      className="absolute inset-0 size-full object-cover object-top"
                    />

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
