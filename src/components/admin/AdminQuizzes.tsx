import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { ClipboardList, Plus, Trash2 } from "lucide-react";
import { useI18n } from "@/lib/i18n";
import { supabase } from "@/integrations/supabase/client";

type Course = { id: string; category_id: string; title_ar: string; title_en: string };
type Category = { id: string; name_ar: string; name_en: string };

const field = "rounded-2xl border border-border bg-background px-4 py-3 text-sm";

export function AdminQuizzes({
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
  const [activeQuiz, setActiveQuiz] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [afterLesson, setAfterLesson] = useState(1);
  const [passScore, setPassScore] = useState(50);

  const { data: quizzes } = useQuery({
    queryKey: ["admin-quizzes", courseId],
    enabled: Boolean(courseId),
    queryFn: async () => {
      const { data, error } = await supabase
        .from("quizzes")
        .select("*")
        .eq("course_id", courseId)
        .order("position");
      if (error) throw error;
      return data ?? [];
    },
  });

  const refresh = () => queryClient.invalidateQueries({ queryKey: ["admin-quizzes", courseId] });

  const addQuiz = async () => {
    if (!courseId) return toast.error(t("selectCourseFirst"));
    if (!title.trim()) return toast.error(t("quizTitle"));
    setBusy(true);
    try {
      const { error } = await supabase.from("quizzes").insert({
        course_id: courseId,
        title_ar: title.trim(),
        description_ar: description.trim(),
        position: afterLesson,
        pass_score: passScore,
      });
      if (error) throw error;
      toast.success(t("savedOk"));
      setTitle("");
      setDescription("");
      await refresh();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  };

  const removeQuiz = async (id: string) => {
    setBusy(true);
    try {
      const { error } = await supabase.from("quizzes").delete().eq("id", id);
      if (error) throw error;
      if (activeQuiz === id) setActiveQuiz(null);
      toast.success(t("deletedOk"));
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
        <ClipboardList className="size-5 text-primary" /> {t("manageQuizzes")}
      </h2>

      <div className="mt-5 grid gap-3 sm:grid-cols-2">
        <select
          value={categoryId}
          onChange={(e) => {
            setCategoryId(e.target.value);
            setCourseId("");
            setActiveQuiz(null);
          }}
          className={`${field} sm:col-span-2`}
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
          onChange={(e) => {
            setCourseId(e.target.value);
            setActiveQuiz(null);
          }}
          className={`${field} sm:col-span-2 disabled:opacity-60`}
        >
          <option value="">{t("course")}</option>
          {courses
            .filter((c) => c.category_id === categoryId)
            .map((c) => (
              <option key={c.id} value={c.id}>
                {lang === "ar" ? c.title_ar : c.title_en}
              </option>
            ))}
        </select>

        <input value={title} onChange={(e) => setTitle(e.target.value)} placeholder={t("quizTitle")} className={field} />
        <input
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          placeholder={t("quizDescription")}
          className={field}
        />
        <label className="flex items-center gap-2 text-xs font-bold text-muted-foreground">
          {t("quizAfterLesson")}
          <input
            type="number"
            min={0}
            value={afterLesson}
            onChange={(e) => setAfterLesson(Number(e.target.value))}
            className={`${field} w-24`}
          />
        </label>
        <label className="flex items-center gap-2 text-xs font-bold text-muted-foreground">
          {t("passScore")}
          <input
            type="number"
            min={0}
            max={100}
            value={passScore}
            onChange={(e) => setPassScore(Number(e.target.value))}
            className={`${field} w-24`}
          />
        </label>
        <button
          disabled={busy}
          onClick={addQuiz}
          className="inline-flex items-center justify-center gap-2 rounded-2xl bg-primary px-7 py-3 text-sm font-extrabold text-primary-foreground disabled:opacity-60 sm:col-span-2"
        >
          <Plus className="size-4" /> {t("addQuiz")}
        </button>
      </div>

      {courseId && (
        <div className="mt-6 space-y-3">
          {(quizzes ?? []).length === 0 && <p className="text-sm text-muted-foreground">{t("noItems")}</p>}
          {(quizzes ?? []).map((q) => (
            <div key={q.id} className="rounded-2xl border border-border bg-background p-4">
              <div className="flex flex-wrap items-center gap-3">
                <button
                  onClick={() => setActiveQuiz(activeQuiz === q.id ? null : q.id)}
                  className="flex-1 text-start text-sm font-extrabold"
                >
                  {q.title_ar}
                  <span className="ms-2 text-xs font-normal text-muted-foreground">
                    ({t("quizAfterLesson")} {q.position} — {t("passScore")} {q.pass_score})
                  </span>
                </button>
                <button
                  disabled={busy}
                  onClick={() => removeQuiz(q.id)}
                  aria-label={t("deleteQuiz")}
                  className="rounded-full bg-destructive/10 p-2 text-destructive disabled:opacity-60"
                >
                  <Trash2 className="size-4" />
                </button>
              </div>
              {activeQuiz === q.id && <QuestionsEditor quizId={q.id} />}
            </div>
          ))}
        </div>
      )}
    </section>
  );
}

function QuestionsEditor({ quizId }: { quizId: string }) {
  const { t } = useI18n();
  const queryClient = useQueryClient();
  const [kind, setKind] = useState<"mcq" | "essay">("mcq");
  const [prompt, setPrompt] = useState("");
  const [options, setOptions] = useState(["", "", "", ""]);
  const [correct, setCorrect] = useState(0);
  const [points, setPoints] = useState(1);
  const [busy, setBusy] = useState(false);

  const { data: questions } = useQuery({
    queryKey: ["admin-quiz-questions", quizId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("quiz_questions")
        .select("*")
        .eq("quiz_id", quizId)
        .order("position");
      if (error) throw error;
      return data ?? [];
    },
  });

  const refresh = () => queryClient.invalidateQueries({ queryKey: ["admin-quiz-questions", quizId] });

  const addQuestion = async () => {
    if (!prompt.trim()) return toast.error(t("questionText"));
    const cleaned = options.map((o) => o.trim()).filter(Boolean);
    if (kind === "mcq" && cleaned.length < 2) return toast.error(t("optionLabel"));
    setBusy(true);
    try {
      const { error } = await supabase.from("quiz_questions").insert({
        quiz_id: quizId,
        prompt: prompt.trim(),
        kind,
        options: kind === "mcq" ? cleaned : [],
        correct_index: kind === "mcq" ? Math.min(correct, cleaned.length - 1) : null,
        points,
        position: (questions?.length ?? 0) + 1,
      });
      if (error) throw error;
      toast.success(t("savedOk"));
      setPrompt("");
      setOptions(["", "", "", ""]);
      setCorrect(0);
      await refresh();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  };

  const removeQuestion = async (id: string) => {
    setBusy(true);
    try {
      const { error } = await supabase.from("quiz_questions").delete().eq("id", id);
      if (error) throw error;
      await refresh();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="mt-4 space-y-4 rounded-2xl border border-dashed border-border p-4">
      <div className="space-y-2">
        {(questions ?? []).map((q, i) => (
          <div key={q.id} className="flex items-start gap-3 rounded-xl bg-card p-3 text-sm">
            <span className="flex-1">
              <b>
                {i + 1}. {q.prompt}
              </b>
              <span className="ms-2 text-xs text-muted-foreground">
                {q.kind === "mcq" ? t("mcqType") : t("essayType")} — {q.points} {t("points")}
              </span>
              {q.kind === "mcq" && (
                <ul className="mt-1 space-y-0.5 text-xs text-muted-foreground">
                  {((q.options as string[]) ?? []).map((o, oi) => (
                    <li key={oi} className={oi === q.correct_index ? "font-bold text-primary" : ""}>
                      {oi + 1}. {o}
                    </li>
                  ))}
                </ul>
              )}
            </span>
            <button
              disabled={busy}
              onClick={() => removeQuestion(q.id)}
              aria-label={t("deleteQuestion")}
              className="rounded-full bg-destructive/10 p-1.5 text-destructive disabled:opacity-60"
            >
              <Trash2 className="size-3.5" />
            </button>
          </div>
        ))}
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        <select value={kind} onChange={(e) => setKind(e.target.value as "mcq" | "essay")} className={field}>
          <option value="mcq">{t("mcqType")}</option>
          <option value="essay">{t("essayType")}</option>
        </select>
        <input
          type="number"
          min={1}
          value={points}
          onChange={(e) => setPoints(Number(e.target.value))}
          placeholder={t("points")}
          className={field}
        />
        <textarea
          value={prompt}
          onChange={(e) => setPrompt(e.target.value)}
          placeholder={t("questionText")}
          rows={2}
          className={`${field} sm:col-span-2`}
        />
        {kind === "mcq" &&
          options.map((o, i) => (
            <label key={i} className="flex items-center gap-2">
              <input
                type="radio"
                name={`correct-${quizId}`}
                checked={correct === i}
                onChange={() => setCorrect(i)}
                aria-label={t("correctAnswer")}
              />
              <input
                value={o}
                onChange={(e) => setOptions(options.map((v, vi) => (vi === i ? e.target.value : v)))}
                placeholder={`${t("optionLabel")} ${i + 1}`}
                className={`${field} flex-1`}
              />
            </label>
          ))}
        <button
          disabled={busy}
          onClick={addQuestion}
          className="inline-flex items-center justify-center gap-2 rounded-2xl border border-border px-6 py-3 text-sm font-extrabold sm:col-span-2"
        >
          <Plus className="size-4" /> {t("addQuestion")}
        </button>
      </div>
    </div>
  );
}
