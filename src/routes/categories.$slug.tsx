import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { Clock, KeyRound, PlayCircle, Tag, X } from "lucide-react";
import { toast } from "sonner";
import { SiteLayout } from "@/components/site/SiteLayout";
import { useI18n } from "@/lib/i18n";
import { useAuth } from "@/lib/auth";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/categories/$slug")({
  head: () => ({
    meta: [
      { title: "دورات القسم | Category courses — Etqan Academy" },
      { name: "description", content: "استعرض دورات القسم وتفاصيلها واشترك بكود الاشتراك الخاص بك." },
      { property: "og:title", content: "دورات القسم | Etqan Academy" },
      { property: "og:description", content: "تفاصيل الدورات: المدة، عدد المحاضرات، السعر والاشتراك." },
    ],
  }),
  component: CategoryCourses,
});

type CourseRow = {
  id: string;
  title_ar: string;
  title_en: string;
  description_ar: string;
  description_en: string;
  image_url: string;
  duration_hours: number;
  price: number;
  instructor: string;
};

function CategoryCourses() {
  const { slug } = Route.useParams();
  const { t, lang } = useI18n();
  const { user } = useAuth();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [activeCourse, setActiveCourse] = useState<CourseRow | null>(null);

  const { data, isLoading } = useQuery({
    queryKey: ["category-courses", slug],
    queryFn: async () => {
      const { data: category, error } = await supabase
        .from("categories")
        .select("*")
        .eq("slug", slug)
        .maybeSingle();
      if (error) throw error;
      if (!category) return null;
      const { data: courses } = await supabase
        .from("courses")
        .select("*")
        .eq("category_id", category.id)
        .order("created_at");
      const ids = (courses ?? []).map((c) => c.id);
      const { data: lessons } = ids.length
        ? await supabase.from("lessons").select("id, course_id").in("course_id", ids)
        : { data: [] };
      return { category, courses: (courses ?? []) as CourseRow[], lessons: lessons ?? [] };
    },
  });

  const { data: enrollments } = useQuery({
    queryKey: ["my-enrollments", user?.id],
    enabled: Boolean(user),
    queryFn: async () => {
      const { data } = await supabase.from("enrollments").select("course_id");
      return (data ?? []).map((e) => e.course_id);
    },
  });

  if (isLoading) {
    return (
      <SiteLayout>
        <p className="mx-auto max-w-6xl px-4 py-20 text-muted-foreground">{t("loading")}</p>
      </SiteLayout>
    );
  }

  if (!data) {
    return (
      <SiteLayout>
        <div className="mx-auto max-w-6xl px-4 py-20">
          <p className="text-muted-foreground">404</p>
          <Link to="/categories" className="font-bold text-primary">
            {t("categories")}
          </Link>
        </div>
      </SiteLayout>
    );
  }

  const lessonCount = (courseId: string) => data.lessons.filter((l) => l.course_id === courseId).length;

  return (
    <SiteLayout>
      <div className="bg-hero-gradient text-ink-foreground">
        <div className="mx-auto max-w-6xl px-4 py-14">
          <Link to="/categories" className="text-sm opacity-70">
            {t("categories")}
          </Link>
          <h1 className="mt-2 text-4xl font-extrabold">
            {t("coursesIn")} {lang === "ar" ? data.category.name_ar : data.category.name_en}
          </h1>
          <p className="mt-2 opacity-80">
            {lang === "ar" ? data.category.description_ar : data.category.description_en}
          </p>
        </div>
      </div>

      <div className="mx-auto grid max-w-6xl gap-6 px-4 py-14 md:grid-cols-2 lg:grid-cols-3">
        {data.courses.map((course) => {
          const enrolled = enrollments?.includes(course.id);
          return (
            <article
              key={course.id}
              className="overflow-hidden rounded-3xl border border-border bg-card shadow-soft transition-all hover:-translate-y-1 hover:shadow-lift"
            >
              <img
                src={course.image_url}
                alt={lang === "ar" ? course.title_ar : course.title_en}
                loading="lazy"
                width={1280}
                height={720}
                className="h-44 w-full object-cover"
              />
              <div className="space-y-3 p-6">
                <h2 className="text-lg font-extrabold">{lang === "ar" ? course.title_ar : course.title_en}</h2>
                <p className="line-clamp-2 text-sm text-muted-foreground">
                  {lang === "ar" ? course.description_ar : course.description_en}
                </p>
                <div className="flex flex-wrap gap-3 text-xs font-semibold text-muted-foreground">
                  <span className="inline-flex items-center gap-1.5">
                    <Clock className="size-4" /> {course.duration_hours} {t("hours")}
                  </span>
                  <span className="inline-flex items-center gap-1.5">
                    <PlayCircle className="size-4" /> {lessonCount(course.id)} {t("lessons")}
                  </span>
                  <span className="inline-flex items-center gap-1.5 text-accent-foreground">
                    <Tag className="size-4" /> {course.price} {t("currency")}
                  </span>
                </div>
                {enrolled ? (
                  <Link
                    to="/courses/$courseId"
                    params={{ courseId: course.id }}
                    className="block w-full rounded-full bg-primary px-5 py-3 text-center text-sm font-extrabold text-primary-foreground"
                  >
                    {t("enterCourse")}
                  </Link>
                ) : (
                  <button
                    onClick={() => {
                      if (!user) {
                        toast.error(t("mustLogin"));
                        navigate({ to: "/auth", search: { mode: "login" } });
                        return;
                      }
                      setActiveCourse(course);
                    }}
                    className="w-full rounded-full bg-accent-gradient px-5 py-3 text-sm font-extrabold text-accent-foreground shadow-soft"
                  >
                    {t("enroll")}
                  </button>
                )}
              </div>
            </article>
          );
        })}
      </div>

      {activeCourse && (
        <EnrollDialog
          course={activeCourse}
          onClose={() => setActiveCourse(null)}
          onSuccess={async () => {
            await queryClient.invalidateQueries({ queryKey: ["my-enrollments"] });
            navigate({ to: "/courses/$courseId", params: { courseId: activeCourse.id } });
          }}
        />
      )}
    </SiteLayout>
  );
}

function EnrollDialog({
  course,
  onClose,
  onSuccess,
}: {
  course: CourseRow;
  onClose: () => void;
  onSuccess: () => void;
}) {
  const { t, lang } = useI18n();
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState(false);

  const submit = async () => {
    if (!code.trim()) return;
    setBusy(true);
    const { data, error } = await supabase.rpc("redeem_code", {
      _code: code.trim(),
      _course_id: course.id,
    });
    setBusy(false);
    if (error) {
      toast.error(error.message);
      return;
    }
    const result = data as { ok: boolean; error?: string };
    if (!result?.ok) {
      const map: Record<string, string> = {
        invalid_code: t("codeInvalid"),
        wrong_course: t("codeWrongCourse"),
        already_used: t("codeUsed"),
        not_authenticated: t("mustLogin"),
      };
      toast.error(map[result?.error ?? ""] ?? t("codeInvalid"));
      return;
    }
    toast.success(t("codeSuccess"));
    onSuccess();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-sm">
      <div className="w-full max-w-md rounded-3xl border border-border bg-card p-7 shadow-lift">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h3 className="text-xl font-extrabold">{t("subscriptionCode")}</h3>
            <p className="mt-1 text-sm text-muted-foreground">
              {lang === "ar" ? course.title_ar : course.title_en}
            </p>
          </div>
          <button onClick={onClose} aria-label="close" className="rounded-full p-1 hover:bg-secondary">
            <X className="size-5" />
          </button>
        </div>

        <div className="mt-6 space-y-3">
          <div className="flex items-center gap-2 rounded-2xl border border-border bg-background px-4">
            <KeyRound className="size-4 text-muted-foreground" />
            <input
              value={code}
              onChange={(e) => setCode(e.target.value.toUpperCase())}
              placeholder={t("codePlaceholder")}
              className="w-full bg-transparent py-3.5 text-sm font-bold tracking-widest outline-none"
            />
          </div>
          <button
            onClick={() => toast.info(t("getCodeHint"))}
            className="w-full rounded-full border border-border px-5 py-3 text-sm font-bold hover:bg-secondary"
          >
            {t("getCode")}
          </button>
          <button
            disabled={busy}
            onClick={submit}
            className="w-full rounded-full bg-primary px-5 py-3 text-sm font-extrabold text-primary-foreground disabled:opacity-60"
          >
            {busy ? t("loading") : t("enterCourseBtn")}
          </button>
        </div>
      </div>
    </div>
  );
}
