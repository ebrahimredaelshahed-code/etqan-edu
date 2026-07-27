import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { CheckCircle2, Film, Trash2, Upload, VideoOff } from "lucide-react";
import { useI18n } from "@/lib/i18n";
import { supabase } from "@/integrations/supabase/client";
import { isStorageRef, removeLessonVideo, uploadLessonVideo } from "@/lib/lesson-video";

type Course = { id: string; title_ar: string; title_en: string };

export function AdminLessons({ courses, lang }: { courses: Course[]; lang: "ar" | "en" }) {
  const { t } = useI18n();
  const queryClient = useQueryClient();
  const [courseId, setCourseId] = useState("");
  const [titleAr, setTitleAr] = useState("");
  const [titleEn, setTitleEn] = useState("");
  const [minutes, setMinutes] = useState(10);
  const [file, setFile] = useState<File | null>(null);
  const [busy, setBusy] = useState(false);

  const { data: lessons } = useQuery({
    queryKey: ["admin-lessons", courseId],
    enabled: Boolean(courseId),
    queryFn: async () => {
      const { data, error } = await supabase
        .from("lessons")
        .select("*")
        .eq("course_id", courseId)
        .order("position");
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
    setBusy(true);
    try {
      let videoUrl = "";
      if (file) videoUrl = await uploadLessonVideo(courseId, file);
      const { error } = await supabase.from("lessons").insert({
        course_id: courseId,
        title_ar: titleAr || titleEn,
        title_en: titleEn || titleAr,
        duration_minutes: minutes,
        position: (lessons?.length ?? 0) + 1,
        video_url: videoUrl,
      });
      if (error) throw error;
      toast.success(t("lessonSaved"));
      setTitleAr("");
      setTitleEn("");
      setFile(null);
      await refresh();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  };

  const replaceVideo = async (lessonId: string, oldUrl: string, newFile: File) => {
    setBusy(true);
    try {
      const videoUrl = await uploadLessonVideo(courseId, newFile);
      const { error } = await supabase.from("lessons").update({ video_url: videoUrl }).eq("id", lessonId);
      if (error) throw error;
      await removeLessonVideo(oldUrl);
      toast.success(t("lessonSaved"));
      await refresh();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  };

  const deleteLesson = async (lessonId: string, videoUrl: string) => {
    setBusy(true);
    try {
      const { error } = await supabase.from("lessons").delete().eq("id", lessonId);
      if (error) throw error;
      await removeLessonVideo(videoUrl);
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
          value={titleEn}
          onChange={(e) => setTitleEn(e.target.value)}
          placeholder={t("lessonTitleEn")}
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
          type="file"
          accept="video/*"
          onChange={(e) => setFile(e.target.files?.[0] ?? null)}
          className="rounded-2xl border border-border bg-background px-4 py-2.5 text-sm file:me-3 file:rounded-full file:border-0 file:bg-secondary file:px-4 file:py-1.5 file:text-xs file:font-bold"
        />
        <button
          disabled={busy}
          onClick={addLesson}
          className="inline-flex items-center justify-center gap-2 rounded-2xl bg-primary px-7 py-3 text-sm font-extrabold text-primary-foreground disabled:opacity-60 sm:col-span-2"
        >
          <Upload className="size-4" /> {busy ? t("uploading") : t("addLesson")}
        </button>
      </div>

      {courseId && (
        <div className="mt-6 space-y-3">
          {(lessons ?? []).length === 0 && <p className="text-sm text-muted-foreground">{t("noLessons")}</p>}
          {(lessons ?? []).map((l, i) => (
            <div
              key={l.id}
              className="flex flex-wrap items-center gap-3 rounded-2xl border border-border bg-background p-4"
            >
              <span className="flex-1 text-sm font-bold">
                {i + 1}. {lang === "ar" ? l.title_ar : l.title_en}{" "}
                <span className="text-xs font-normal text-muted-foreground">
                  ({l.duration_minutes} {lang === "ar" ? "دقيقة" : "min"})
                </span>
              </span>
              <span
                className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-bold ${
                  l.video_url ? "bg-secondary text-secondary-foreground" : "bg-muted text-muted-foreground"
                }`}
              >
                {l.video_url ? <CheckCircle2 className="size-3.5" /> : <VideoOff className="size-3.5" />}
                {l.video_url ? (isStorageRef(l.video_url) ? t("videoReady") : "URL") : t("videoMissing")}
              </span>
              <label className="cursor-pointer rounded-full border border-border px-4 py-1.5 text-xs font-bold">
                {t("replaceVideo")}
                <input
                  type="file"
                  accept="video/*"
                  className="hidden"
                  onChange={(e) => {
                    const f = e.target.files?.[0];
                    if (f) replaceVideo(l.id, l.video_url, f);
                  }}
                />
              </label>
              <button
                disabled={busy}
                onClick={() => deleteLesson(l.id, l.video_url)}
                className="rounded-full bg-destructive/10 p-2 text-destructive disabled:opacity-60"
                aria-label={t("deleteLesson")}
              >
                <Trash2 className="size-4" />
              </button>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}
