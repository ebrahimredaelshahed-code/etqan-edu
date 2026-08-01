import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { CheckCircle2, Film, Link2, Trash2, VideoOff } from "lucide-react";
import { useI18n } from "@/lib/i18n";
import { supabase } from "@/integrations/supabase/client";
import { youtubeIdOf } from "@/lib/lesson-video";

type Course = { id: string; title_ar: string; title_en: string };

export function AdminLessons({ courses, lang }: { courses: Course[]; lang: "ar" | "en" }) {
  const { t } = useI18n();
  const queryClient = useQueryClient();
  const [courseId, setCourseId] = useState("");
  const [titleAr, setTitleAr] = useState("");
  const [minutes, setMinutes] = useState(10);
  const [youtube, setYoutube] = useState("");
  const [busy, setBusy] = useState(false);

  const { data: lessons } = useQuery({
    queryKey: ["admin-lessons", courseId],
    enabled: Boolean(courseId),
    queryFn: async () => {
      const { data, error } = await supabase.rpc("admin_list_lessons", { _course_id: courseId });
      if (error) throw error;
      return data ?? [];
    },
  });


  const refresh = () => queryClient.invalidateQueries({ queryKey: ["admin-lessons", courseId] });

  const addLesson = async () => {
    if (!courseId) {
      toast.error(t("selectCourseFirst"));
      return;
    }
    const id = youtubeIdOf(youtube);
    if (!id) {
      toast.error(t("invalidYoutube"));
      return;
    }
    setBusy(true);
    try {
      const { error } = await supabase.from("lessons").insert({
        course_id: courseId,
        title_ar: titleAr,
        title_en: titleAr,
        duration_minutes: minutes,
        position: (lessons?.length ?? 0) + 1,
        video_url: `https://www.youtube.com/watch?v=${id}`,
      });
      if (error) throw error;
      toast.success(t("lessonSaved"));
      setTitleAr("");
      setYoutube("");
      await refresh();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  };

  const updateVideo = async (lessonId: string, raw: string) => {
    const id = youtubeIdOf(raw);
    if (!id) {
      toast.error(t("invalidYoutube"));
      return;
    }
    setBusy(true);
    try {
      const { error } = await supabase
        .from("lessons")
        .update({ video_url: `https://www.youtube.com/watch?v=${id}` })
        .eq("id", lessonId);
      if (error) throw error;
      toast.success(t("lessonSaved"));
      await refresh();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  };

  const deleteLesson = async (lessonId: string) => {
    setBusy(true);
    try {
      const { error } = await supabase.from("lessons").delete().eq("id", lessonId);
      if (error) throw error;
      toast.success(t("lessonDeleted"));
      await refresh();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  };

  return (
    <section className="rounded-3xl border border-border bg-card p-7 shadow-soft">
      <h2 className="flex items-center gap-2 text-lg font-extrabold">
        <Film className="size-5 text-primary" /> {t("manageLessons")}
      </h2>

      <div className="mt-5 grid gap-3 sm:grid-cols-2">
        <select
          value={courseId}
          onChange={(e) => setCourseId(e.target.value)}
          className="rounded-2xl border border-border bg-background px-4 py-3 text-sm sm:col-span-2"
        >
          <option value="">{t("course")}</option>
          {courses.map((c) => (
            <option key={c.id} value={c.id}>
              {lang === "ar" ? c.title_ar : c.title_en}
            </option>
          ))}
        </select>
        <input
          value={titleAr}
          onChange={(e) => setTitleAr(e.target.value)}
          placeholder={t("lessonTitleAr")}
          className="rounded-2xl border border-border bg-background px-4 py-3 text-sm"
        />
        <input
          type="number"
          min={1}
          value={minutes}
          onChange={(e) => setMinutes(Number(e.target.value))}
          placeholder={t("durationMinutes")}
          className="rounded-2xl border border-border bg-background px-4 py-3 text-sm"
        />
        <input
          value={youtube}
          onChange={(e) => setYoutube(e.target.value)}
          dir="ltr"
          placeholder={t("youtubeUrl")}
          className="rounded-2xl border border-border bg-background px-4 py-3 text-sm"
        />
        <button
          disabled={busy}
          onClick={addLesson}
          className="inline-flex items-center justify-center gap-2 rounded-2xl bg-primary px-7 py-3 text-sm font-extrabold text-primary-foreground disabled:opacity-60 sm:col-span-2"
        >
          <Link2 className="size-4" /> {busy ? t("uploading") : t("addLesson")}
        </button>
      </div>

      {courseId && (
        <div className="mt-6 space-y-3">
          {(lessons ?? []).length === 0 && <p className="text-sm text-muted-foreground">{t("noLessons")}</p>}
          {(lessons ?? []).map((l, i) => (
            <LessonRow
              key={l.id}
              index={i}
              lesson={l}
              lang={lang}
              busy={busy}
              onUpdate={updateVideo}
              onDelete={deleteLesson}
            />
          ))}
        </div>
      )}
    </section>
  );
}

function LessonRow({
  index,
  lesson,
  lang,
  busy,
  onUpdate,
  onDelete,
}: {
  index: number;
  lesson: { id: string; title_ar: string; title_en: string; duration_minutes: number; video_url: string };
  lang: "ar" | "en";
  busy: boolean;
  onUpdate: (id: string, url: string) => Promise<void>;
  onDelete: (id: string) => Promise<void>;
}) {
  const { t } = useI18n();
  const [url, setUrl] = useState(lesson.video_url);
  const linked = Boolean(youtubeIdOf(lesson.video_url));

  return (
    <div className="flex flex-wrap items-center gap-3 rounded-2xl border border-border bg-background p-4">
      <span className="w-full text-sm font-bold sm:w-auto sm:flex-1">
        {index + 1}. {lang === "ar" ? lesson.title_ar : lesson.title_en}{" "}
        <span className="text-xs font-normal text-muted-foreground">
          ({lesson.duration_minutes} {lang === "ar" ? "دقيقة" : "min"})
        </span>
      </span>
      <span
        className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-bold ${
          linked ? "bg-secondary text-secondary-foreground" : "bg-muted text-muted-foreground"
        }`}
      >
        {linked ? <CheckCircle2 className="size-3.5" /> : <VideoOff className="size-3.5" />}
        {linked ? t("videoReady") : t("videoMissing")}
      </span>
      <input
        value={url}
        dir="ltr"
        onChange={(e) => setUrl(e.target.value)}
        placeholder={t("youtubeUrl")}
        className="min-w-0 flex-1 rounded-full border border-border bg-card px-4 py-2 text-xs"
      />
      <button
        disabled={busy}
        onClick={() => onUpdate(lesson.id, url)}
        className="rounded-full border border-border px-4 py-1.5 text-xs font-bold disabled:opacity-60"
      >
        {t("replaceVideo")}
      </button>
      <button
        disabled={busy}
        onClick={() => onDelete(lesson.id)}
        className="rounded-full bg-destructive/10 p-2 text-destructive disabled:opacity-60"
        aria-label={t("deleteLesson")}
      >
        <Trash2 className="size-4" />
      </button>
    </div>
  );
}
