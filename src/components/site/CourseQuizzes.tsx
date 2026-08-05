import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { CheckCircle2, ClipboardList, Lock, Send } from "lucide-react";
import { useI18n } from "@/lib/i18n";
import { supabase } from "@/integrations/supabase/client";

type Quiz = {
  id: string;
  title_ar: string;
  description_ar: string;
  position: number;
  pass_score: number;
};

type Question = {
  id: string;
  prompt: string;
  kind: string;
  options: unknown;
  points: number;
  sort_order: number;
};

export function CourseQuizzes({
  courseId,
  lessonsDone,
  lessonPositions,
}: {
  courseId: string;
  lessonsDone: Set<string>;
  lessonPositions: { id: string; position: number }[];
}) {
  const { t } = useI18n();
  const [active, setActive] = useState<string | null>(null);

  const { data: quizzes } = useQuery({
    queryKey: ["course-quizzes", courseId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("quizzes")
        .select("id, title_ar, description_ar, position, pass_score")
        .eq("course_id", courseId)
        .order("position");
      if (error) throw error;
      return (data ?? []) as Quiz[];
    },
  });

  const { data: attempts } = useQuery({
    queryKey: ["course-attempts", courseId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("quiz_attempts")
        .select("id, quiz_id, score, max_score, has_essay, created_at")
        .eq("course_id", courseId)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data ?? [];
    },
  });

  if (!quizzes?.length) return null;

  const isUnlocked = (quiz: Quiz) =>
    lessonPositions.filter((l) => l.position <= quiz.position).every((l) => lessonsDone.has(l.id));

  return (
    <section className="space-y-3">
      <h2 className="flex items-center gap-2 text-lg font-extrabold">
        <ClipboardList className="size-5 text-primary" /> {t("quizzes")}
      </h2>

      {quizzes.map((quiz) => {
        const unlocked = isUnlocked(quiz);
        const best = (attempts ?? []).find((a) => a.quiz_id === quiz.id);
        return (
          <div key={quiz.id} className="rounded-3xl border border-border bg-card p-6 shadow-soft">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <p className="text-base font-extrabold">{quiz.title_ar}</p>
                {quiz.description_ar && (
                  <p className="mt-1 text-sm text-muted-foreground">{quiz.description_ar}</p>
                )}
                {best && (
                  <p className="mt-2 inline-flex items-center gap-1.5 rounded-full bg-secondary px-3 py-1 text-xs font-bold text-primary">
                    <CheckCircle2 className="size-3.5" /> {t("quizResult")}: {Number(best.score)}/
                    {Number(best.max_score)}
                  </p>
                )}
              </div>
              {unlocked ? (
                <button
                  onClick={() => setActive(active === quiz.id ? null : quiz.id)}
                  className="rounded-full bg-primary px-6 py-2.5 text-sm font-extrabold text-primary-foreground"
                >
                  {t("startQuiz")}
                </button>
              ) : (
                <span className="inline-flex items-center gap-1.5 rounded-full bg-muted px-4 py-2 text-xs font-bold text-muted-foreground">
                  <Lock className="size-3.5" /> {t("quizLocked")}
                </span>
              )}
            </div>

            {unlocked && active === quiz.id && <QuizRunner quiz={quiz} courseId={courseId} />}
          </div>
        );
      })}
    </section>
  );
}

function QuizRunner({ quiz, courseId }: { quiz: Quiz; courseId: string }) {
  const { t } = useI18n();
  const queryClient = useQueryClient();
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<{ score: number; max: number; hasEssay: boolean } | null>(null);

  const { data: questions, isLoading } = useQuery({
    queryKey: ["quiz-questions", quiz.id],
    queryFn: async () => {
      const { data, error } = await supabase.rpc("get_quiz_questions", { _quiz_id: quiz.id });
      if (error) throw error;
      return (data ?? []) as Question[];
    },
  });

  const submit = async () => {
    setBusy(true);
    try {
      const { data, error } = await supabase.rpc("submit_quiz", { _quiz_id: quiz.id, _answers: answers });
      if (error) throw error;
      const res = data as { ok: boolean; error?: string; score?: number; max?: number; hasEssay?: boolean };
      if (!res.ok) throw new Error(res.error ?? "error");
      setResult({ score: res.score ?? 0, max: res.max ?? 0, hasEssay: Boolean(res.hasEssay) });
      toast.success(t("savedOk"));
      await queryClient.invalidateQueries({ queryKey: ["course-attempts", courseId] });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  };

  if (isLoading) return <p className="mt-5 text-sm text-muted-foreground">{t("loading")}</p>;
  if (!questions?.length) return <p className="mt-5 text-sm text-muted-foreground">{t("noItems")}</p>;

  if (result) {
    const percent = result.max ? Math.round((result.score / result.max) * 100) : 0;
    return (
      <div className="mt-5 rounded-2xl border border-border bg-secondary/60 p-6 text-center">
        <p className="text-sm font-bold text-muted-foreground">{t("quizResult")}</p>
        <p className="mt-2 text-4xl font-extrabold text-primary">
          {result.score}/{result.max}
        </p>
        <p className="mt-1 text-sm font-bold">
          {percent}% — {percent >= quiz.pass_score ? "✅" : "❌"}
        </p>
        {result.hasEssay && <p className="mt-2 text-xs text-muted-foreground">{t("essayPending")}</p>}
      </div>
    );
  }

  return (
    <div className="mt-5 space-y-4">
      {questions.map((q, i) => (
        <div key={q.id} className="rounded-2xl border border-border bg-background p-5">
          <p className="text-sm font-extrabold">
            {i + 1}. {q.prompt}
            <span className="ms-2 text-xs font-normal text-muted-foreground">
              ({q.points} {t("points")})
            </span>
          </p>
          {q.kind === "mcq" ? (
            <div className="mt-3 space-y-2">
              {((q.options as string[]) ?? []).map((opt, oi) => (
                <label
                  key={oi}
                  className={`flex cursor-pointer items-center gap-3 rounded-xl border p-3 text-sm transition ${
                    answers[q.id] === String(oi) ? "border-primary bg-secondary" : "border-border"
                  }`}
                >
                  <input
                    type="radio"
                    name={q.id}
                    checked={answers[q.id] === String(oi)}
                    onChange={() => setAnswers((a) => ({ ...a, [q.id]: String(oi) }))}
                  />
                  {opt}
                </label>
              ))}
            </div>
          ) : (
            <textarea
              rows={4}
              value={answers[q.id] ?? ""}
              onChange={(e) => setAnswers((a) => ({ ...a, [q.id]: e.target.value }))}
              className="mt-3 w-full rounded-2xl border border-border bg-card px-4 py-3 text-sm"
            />
          )}
        </div>
      ))}

      <button
        disabled={busy}
        onClick={submit}
        className="inline-flex w-full items-center justify-center gap-2 rounded-full bg-primary px-7 py-3 text-sm font-extrabold text-primary-foreground disabled:opacity-60"
      >
        <Send className="size-4" /> {t("submitQuiz")}
      </button>
    </div>
  );
}
