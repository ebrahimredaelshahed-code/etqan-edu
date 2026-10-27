import { useState, type FormEvent } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { CheckCircle2, Film, Link2, Pencil, Trash2, VideoOff } from "lucide-react";
import { useI18n } from "@/lib/i18n";
import { supabase } from "@/integrations/supabase/client";
import { youtubeIdOf } from "@/lib/lesson-video";
import type { Database } from "@/integrations/supabase/types";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

type Course = { id: string; category_id: string; title_ar: string; title_en: string };
type Category = { id: string; name_ar: string; name_en: string };
type Lesson = Database["public"]["Tables"]["lessons"]["Row"];

function normalizedVideoUrl(raw: string) {
  const value = raw.trim();
  const youtubeId = youtubeIdOf(value);
  if (youtubeId) return `https://www.youtube.com/watch?v=${youtubeId}`;
  if (value.startsWith("storage:") && value.length > "storage:".length) return value;

  try {
    const url = new URL(value);
    if (url.protocol === "http:" || url.protocol === "https:") return value;
  } catch {
    return null;
  }

  return null;
}

export function AdminLessons({
  categories,
  courses,
  lang,
}: {
  categories: Category[];
  courses: Course[];
  lang: "ar" | "en";
}) {
  const { t } = useI18n();
  const queryClient = useQueryClient();
  const [categoryId, setCategoryId] = useState("");
  const [courseId, setCourseId] = useState("");
  const [titleAr, setTitleAr] = useState("");
  const [minutes, setMinutes] = useState(10);
  const [youtube, setYoutube] = useState("");
  const [busy, setBusy] = useState(false);
  const [editingLesson, setEditingLesson] = useState<Lesson | null>(null);

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

  const saveLesson = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!editingLesson) return;
    const rawVideoUrl = editingLesson.video_url.trim();
    const videoUrl = rawVideoUrl ? normalizedVideoUrl(rawVideoUrl) : "";
    if (videoUrl === null) {
      toast.error(t("invalidVideoUrl"));
      return;
    }

    setBusy(true);
    try {
      const { error } = await supabase
        .from("lessons")
        .update({
          course_id: editingLesson.course_id,
          title_ar: editingLesson.title_ar,
          title_en: editingLesson.title_en,
          video_url: videoUrl,
          duration_minutes: editingLesson.duration_minutes,
          position: editingLesson.position,
        })
        .eq("id", editingLesson.id);
      if (error) throw error;
      toast.success(t("lessonSaved"));
      setEditingLesson(null);
      const nextCourse = courses.find((course) => course.id === editingLesson.course_id);
      if (nextCourse) {
        setCategoryId(nextCourse.category_id);
        setCourseId(nextCourse.id);
      }
      await queryClient.invalidateQueries({ queryKey: ["admin-lessons"] });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  };

  const field = "rounded-2xl border border-border bg-background px-4 py-3 text-sm";
  const labelClass = "grid gap-1.5 text-sm font-bold";

  return (
    <section className="rounded-3xl border border-border bg-card p-7 shadow-soft">
      <h2 className="flex items-center gap-2 text-lg font-extrabold">
        <Film className="size-5 text-primary" /> {t("manageLessons")}
      </h2>

      <div className="mt-5 grid gap-3 sm:grid-cols-2">
        <select
          value={categoryId}
          onChange={(e) => {
            setCategoryId(e.target.value);
            setCourseId("");
          }}
          className="rounded-2xl border border-border bg-background px-4 py-3 text-sm sm:col-span-2"
        >
          <option value="">{t("selectCategory")}</option>
          {categories.map((c) => (
            <option key={c.id} value={c.id}>
              {lang === "ar" ? c.name_ar : c.name_en}
            </option>
          ))}
        </select>
        <select
          value={courseId}
          disabled={!categoryId}
          onChange={(e) => setCourseId(e.target.value)}
          className="rounded-2xl border border-border bg-background px-4 py-3 text-sm sm:col-span-2 disabled:opacity-60"
        >
          <option value="">{t("packageLabel")}</option>
          {courses
            .filter((c) => c.category_id === categoryId)
            .map((c) => (
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
          {(lessons ?? []).length === 0 && (
            <p className="text-sm text-muted-foreground">{t("noLessons")}</p>
          )}
          {(lessons ?? []).map((l, i) => (
            <LessonRow
              key={l.id}
              index={i}
              lesson={l}
              lang={lang}
              busy={busy}
              onEdit={setEditingLesson}
              onDelete={deleteLesson}
            />
          ))}
        </div>
      )}

      <Dialog
        open={Boolean(editingLesson)}
        onOpenChange={(open) => {
          if (!open && !busy) setEditingLesson(null);
        }}
      >
        <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle>{t("editLesson")}</DialogTitle>
          </DialogHeader>
          {editingLesson && (
            <form onSubmit={saveLesson} className="space-y-5">
              <div className="grid gap-3 sm:grid-cols-2">
                <label className={`${labelClass} sm:col-span-2`}>
                  <span>{t("packageLabel")}</span>
                  <select
                    required
                    value={editingLesson.course_id}
                    onChange={(e) =>
                      setEditingLesson({ ...editingLesson, course_id: e.target.value })
                    }
                    className={field}
                  >
                    {courses.map((course) => {
                      const category = categories.find((item) => item.id === course.category_id);
                      const categoryName = category
                        ? lang === "ar"
                          ? category.name_ar
                          : category.name_en
                        : "";
                      const courseName = lang === "ar" ? course.title_ar : course.title_en;
                      return (
                        <option key={course.id} value={course.id}>
                          {categoryName ? `${categoryName} · ${courseName}` : courseName}
                        </option>
                      );
                    })}
                  </select>
                </label>
                <label className={labelClass}>
                  <span>{t("lessonTitleAr")}</span>
                  <input
                    required
                    value={editingLesson.title_ar}
                    onChange={(e) =>
                      setEditingLesson({ ...editingLesson, title_ar: e.target.value })
                    }
                    className={field}
                  />
                </label>
                <label className={labelClass}>
                  <span>{t("lessonTitleEn")}</span>
                  <input
                    required
                    dir="ltr"
                    value={editingLesson.title_en}
                    onChange={(e) =>
                      setEditingLesson({ ...editingLesson, title_en: e.target.value })
                    }
                    className={field}
                  />
                </label>
                <label className={labelClass}>
                  <span>{t("durationMinutes")}</span>
                  <input
                    type="number"
                    min={0}
                    step={1}
                    value={editingLesson.duration_minutes}
                    onChange={(e) =>
                      setEditingLesson({
                        ...editingLesson,
                        duration_minutes: Number(e.target.value),
                      })
                    }
                    className={field}
                  />
                </label>
                <label className={labelClass}>
                  <span>{t("lessonPosition")}</span>
                  <input
                    type="number"
                    min={0}
                    step={1}
                    value={editingLesson.position}
                    onChange={(e) =>
                      setEditingLesson({ ...editingLesson, position: Number(e.target.value) })
                    }
                    className={field}
                  />
                </label>
                <label className={`${labelClass} sm:col-span-2`}>
                  <span>{t("videoSource")}</span>
                  <input
                    dir="ltr"
                    value={editingLesson.video_url}
                    onChange={(e) =>
                      setEditingLesson({ ...editingLesson, video_url: e.target.value })
                    }
                    className={field}
                  />
                </label>
              </div>
              <DialogFooter>
                <button
                  type="button"
                  disabled={busy}
                  onClick={() => setEditingLesson(null)}
                  className="rounded-2xl border border-border px-5 py-3 text-sm font-bold disabled:opacity-60"
                >
                  {t("cancel")}
                </button>
                <button
                  type="submit"
                  disabled={busy}
                  className="rounded-2xl bg-primary px-5 py-3 text-sm font-extrabold text-primary-foreground disabled:opacity-60"
                >
                  {busy ? t("uploading") : t("saveChanges")}
                </button>
              </DialogFooter>
            </form>
          )}
        </DialogContent>
      </Dialog>
    </section>
  );
}

function LessonRow({
  index,
  lesson,
  lang,
  busy,
  onEdit,
  onDelete,
}: {
  index: number;
  lesson: Lesson;
  lang: "ar" | "en";
  busy: boolean;
  onEdit: (lesson: Lesson) => void;
  onDelete: (id: string) => Promise<void>;
}) {
  const { t } = useI18n();
  const linked = Boolean(lesson.video_url.trim());

  return (
    <div className="flex flex-wrap items-center gap-3 rounded-2xl border border-border bg-background p-4">
      <button
        type="button"
        disabled={busy}
        onClick={() => onEdit(lesson)}
        aria-label={`${t("editLesson")}: ${lang === "ar" ? lesson.title_ar : lesson.title_en}`}
        className="flex w-full min-w-0 items-center gap-2 text-start text-sm font-bold hover:text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring sm:flex-1"
      >
        <Pencil className="size-4 shrink-0" />
        <span className="truncate">
          {index + 1}. {lang === "ar" ? lesson.title_ar : lesson.title_en}{" "}
          <span className="text-xs font-normal text-muted-foreground">
            ({lesson.duration_minutes} {lang === "ar" ? "دقيقة" : "min"})
          </span>
        </span>
      </button>
      <span
        className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-bold ${
          linked ? "bg-secondary text-secondary-foreground" : "bg-muted text-muted-foreground"
        }`}
      >
        {linked ? <CheckCircle2 className="size-3.5" /> : <VideoOff className="size-3.5" />}
        {linked ? t("videoReady") : t("videoMissing")}
      </span>
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
