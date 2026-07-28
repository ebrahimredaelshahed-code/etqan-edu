import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useRef, useState } from "react";
import { CheckCircle2, Circle, Clock, Maximize, Minimize, PlayCircle } from "lucide-react";
import { SiteLayout } from "@/components/site/SiteLayout";
import { useI18n } from "@/lib/i18n";
import { useAuth } from "@/lib/auth";
import { supabase } from "@/integrations/supabase/client";
import { resolveLessonVideoUrl, youtubeEmbedUrl, youtubeIdOf } from "@/lib/lesson-video";

export const Route = createFileRoute("/courses/$courseId")({
  head: () => ({
    meta: [
      { title: "محاضرات الدورة | Course lessons — Etqan Academy" },
      { name: "description", content: "شاهد دروس الدورة وتابع نسبة إنجازك درسًا بدرس." },
      { property: "og:title", content: "محاضرات الدورة | Etqan Academy" },
      { property: "og:description", content: "مشغل فيديو للدروس مع مؤشرات أداء لإكمال الدورة." },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: CoursePlayer,
});

function CoursePlayer() {
  const { courseId } = Route.useParams();
  const { t, lang } = useI18n();
  const { user, loading } = useAuth();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [activeLesson, setActiveLesson] = useState<string | null>(null);

  useEffect(() => {
    if (!loading && !user) navigate({ to: "/auth", search: { mode: "login" } });
  }, [loading, user, navigate]);

  const { data, isLoading } = useQuery({
    queryKey: ["course-player", courseId, user?.id],
    enabled: Boolean(user),
    queryFn: async () => {
      const [{ data: course }, { data: lessons }, { data: enrollment }, { data: progress }] = await Promise.all([
        supabase.from("courses").select("*").eq("id", courseId).maybeSingle(),
        supabase.from("lessons").select("*").eq("course_id", courseId).order("position"),
        supabase.from("enrollments").select("id").eq("course_id", courseId).maybeSingle(),
        supabase.from("lesson_progress").select("lesson_id").eq("course_id", courseId),
      ]);
      return {
        course,
        lessons: lessons ?? [],
        enrolled: Boolean(enrollment),
        done: new Set((progress ?? []).map((p) => p.lesson_id)),
      };
    },
  });

  if (loading || isLoading || !data) {
    return (
      <SiteLayout>
        <p className="mx-auto max-w-6xl px-4 py-20 text-muted-foreground">{t("loading")}</p>
      </SiteLayout>
    );
  }

  if (!data.enrolled || !data.course) {
    return (
      <SiteLayout>
        <div className="mx-auto max-w-6xl space-y-4 px-4 py-20">
          <h1 className="text-2xl font-extrabold">{t("subscriptionCode")}</h1>
          <p className="text-muted-foreground">{t("noCourses")}</p>
          <Link to="/categories" className="font-bold text-primary">
            {t("browseCategories")}
          </Link>
        </div>
      </SiteLayout>
    );
  }

  const course = data.course;
  const total = data.lessons.length;
  const completed = data.lessons.filter((l) => data.done.has(l.id)).length;
  const percent = total ? Math.round((completed / total) * 100) : 0;
  const current = data.lessons.find((l) => l.id === activeLesson) ?? null;

  const toggle = async (lessonId: string) => {
    if (!user) return;
    if (data.done.has(lessonId)) {
      await supabase.from("lesson_progress").delete().eq("lesson_id", lessonId).eq("user_id", user.id);
    } else {
      await supabase
        .from("lesson_progress")
        .upsert({ lesson_id: lessonId, course_id: courseId, user_id: user.id, completed: true });
    }
    await queryClient.invalidateQueries({ queryKey: ["course-player", courseId] });
  };

  return (
    <SiteLayout>
      <div className="bg-hero-gradient text-ink-foreground">
        <div className="mx-auto max-w-6xl px-4 py-12">
          <h1 className="text-3xl font-extrabold sm:text-4xl">
            {lang === "ar" ? course.title_ar : course.title_en}
          </h1>
          <div className="mt-3 flex flex-wrap gap-4 text-sm opacity-85">
            <span className="inline-flex items-center gap-1.5">
              <Clock className="size-4" /> {course.duration_hours} {t("hours")}
            </span>
            <span className="inline-flex items-center gap-1.5">
              <PlayCircle className="size-4" /> {total} {t("lessons")}
            </span>
            <span>
              {t("instructor")}: {course.instructor}
            </span>
          </div>
        </div>
      </div>

      <div className="mx-auto max-w-6xl space-y-8 px-4 py-12">
        <section className="rounded-3xl border border-border bg-card p-6 shadow-soft">
          <h2 className="text-lg font-extrabold">{t("aboutCourse")}</h2>
          <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
            {lang === "ar" ? course.description_ar : course.description_en}
          </p>

          <div className="mt-6">
            <div className="flex items-center justify-between text-sm font-bold">
              <span>{t("progress")}</span>
              <span className="text-primary">
                {completed}/{total} — {percent}%
              </span>
            </div>
            <div className="mt-2 h-3 overflow-hidden rounded-full bg-secondary">
              <div className="h-full rounded-full bg-accent-gradient transition-all" style={{ width: `${percent}%` }} />
            </div>
          </div>
        </section>

        {current && <LessonPlayer lesson={current} lang={lang} />}

        <section className="space-y-3">
          <h2 className="text-lg font-extrabold">{t("lessonsList")}</h2>
          {data.lessons.map((lesson, i) => {
            const isDone = data.done.has(lesson.id);
            return (
              <div
                key={lesson.id}
                className="flex items-center gap-3 rounded-2xl border border-border bg-card p-4 shadow-soft"
              >
                <button
                  onClick={() => toggle(lesson.id)}
                  aria-label={isDone ? t("markIncomplete") : t("markComplete")}
                  className={isDone ? "text-primary" : "text-muted-foreground"}
                >
                  {isDone ? <CheckCircle2 className="size-6" /> : <Circle className="size-6" />}
                </button>
                <button onClick={() => setActiveLesson(lesson.id)} className="flex-1 text-start">
                  <p className="text-sm font-bold">
                    {i + 1}. {lang === "ar" ? lesson.title_ar : lesson.title_en}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {lesson.duration_minutes} {lang === "ar" ? "دقيقة" : "min"}
                  </p>
                </button>
                <button
                  onClick={() => setActiveLesson(lesson.id)}
                  className="rounded-full bg-primary px-4 py-2 text-xs font-extrabold text-primary-foreground"
                >
                  <PlayCircle className="size-4" />
                </button>
              </div>
            );
          })}
        </section>
      </div>
    </SiteLayout>
  );
}

function LessonPlayer({
  lesson,
  lang,
}: {
  lesson: { id: string; title_ar: string; title_en: string; video_url: string };
  lang: "ar" | "en";
}) {
  const { t } = useI18n();
  const youtubeId = youtubeIdOf(lesson.video_url);
  const frameRef = useRef<HTMLDivElement>(null);
  const [isFull, setIsFull] = useState(false);

  useEffect(() => {
    const onChange = () => setIsFull(Boolean(document.fullscreenElement));
    document.addEventListener("fullscreenchange", onChange);
    return () => document.removeEventListener("fullscreenchange", onChange);
  }, []);

  const toggleFullscreen = async () => {
    if (document.fullscreenElement) await document.exitFullscreen();
    else await frameRef.current?.requestFullscreen?.();
  };

  const { data: src, isLoading } = useQuery({
    queryKey: ["lesson-video", lesson.id, lesson.video_url],
    enabled: !youtubeId,
    queryFn: () => resolveLessonVideoUrl(lesson.video_url),
  });

  return (
    <section className="overflow-hidden rounded-3xl border border-border bg-ink p-3 shadow-lift">
      {youtubeId ? (
        <div
          ref={frameRef}
          className="relative aspect-video w-full overflow-hidden rounded-2xl bg-black"
          onContextMenu={(e) => e.preventDefault()}
        >
          <iframe
            key={youtubeId}
            src={youtubeEmbedUrl(youtubeId)}
            title={lang === "ar" ? lesson.title_ar : lesson.title_en}
            allow="accelerometer; encrypted-media; gyroscope; picture-in-picture; fullscreen"
            allowFullScreen
            referrerPolicy="strict-origin-when-cross-origin"
            className="absolute inset-0 size-full"
          />
          {/* Blocks YouTube title, channel link, share and "watch on YouTube" — playback controls (incl. settings) stay usable */}
          <div className="absolute inset-x-0 top-0 h-16 cursor-default bg-transparent" aria-hidden />
          <div className="absolute bottom-12 end-2 h-8 w-28 cursor-default bg-transparent" aria-hidden />
          <button
            type="button"
            onClick={toggleFullscreen}
            aria-label={
              isFull
                ? lang === "ar"
                  ? "إنهاء ملء الشاشة"
                  : "Exit fullscreen"
                : lang === "ar"
                  ? "ملء الشاشة"
                  : "Fullscreen"
            }
            className="absolute top-2 end-2 z-20 rounded-lg bg-black/60 p-2 text-white transition hover:bg-black/80"
          >
            {isFull ? <Minimize className="size-4" /> : <Maximize className="size-4" />}
          </button>
        </div>
      ) : src ? (
        <video
          key={src}
          src={src}
          controls
          controlsList="nodownload"
          className="aspect-video w-full rounded-2xl bg-black"
        />
      ) : (
        <div className="flex aspect-video w-full items-center justify-center rounded-2xl bg-black text-sm text-ink-foreground/70">
          {isLoading ? t("loading") : t("videoMissing")}
        </div>
      )}
      <div className="p-3">
        <p className="text-sm font-bold text-ink-foreground">
          {lang === "ar" ? lesson.title_ar : lesson.title_en}
        </p>
      </div>
    </section>
  );
}

