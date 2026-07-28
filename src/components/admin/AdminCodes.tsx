import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Copy, KeyRound } from "lucide-react";
import { useI18n } from "@/lib/i18n";
import { supabase } from "@/integrations/supabase/client";

type Category = { id: string; name_ar: string; name_en: string };
type Course = { id: string; category_id: string; title_ar: string; title_en: string };

export function AdminCodes({
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
  const [count, setCount] = useState(5);
  const [busy, setBusy] = useState(false);

  const filtered = courses.filter((c) => c.category_id === categoryId);

  const { data: codes } = useQuery({
    queryKey: ["admin-codes"],
    queryFn: async () => {
      const { data, error } = await supabase.rpc("admin_list_codes");
      if (error) throw error;
      return data ?? [];
    },
  });

  const generate = async () => {
    if (!categoryId) {
      toast.error(t("selectCategoryFirst"));
      return;
    }
    if (!courseId) {
      toast.error(t("selectCourseFirst"));
      return;
    }
    setBusy(true);
    const { error } = await supabase.rpc("generate_codes", { _course_id: courseId, _count: count });
    setBusy(false);
    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success(t("codeSuccess"));
    await queryClient.invalidateQueries({ queryKey: ["admin-codes"] });
  };

  const field = "rounded-2xl border border-border bg-background px-4 py-3 text-sm";

  return (
    <div className="space-y-8">
      <section className="rounded-3xl border border-border bg-card p-7 shadow-soft">
        <h2 className="flex items-center gap-2 text-lg font-extrabold">
          <KeyRound className="size-5 text-primary" /> {t("generateCodes")}
        </h2>
        <div className="mt-5 grid gap-3 sm:grid-cols-2">
          <select
            value={categoryId}
            onChange={(e) => {
              setCategoryId(e.target.value);
              setCourseId("");
            }}
            className={field}
          >
            <option value="">{t("selectCategory")}</option>
            {categories.map((c) => (
              <option key={c.id} value={c.id}>
                {lang === "ar" ? c.name_ar : c.name_en}
              </option>
            ))}
          </select>
          <select value={courseId} onChange={(e) => setCourseId(e.target.value)} className={field} disabled={!categoryId}>
            <option value="">{t("course")}</option>
            {filtered.map((c) => (
              <option key={c.id} value={c.id}>
                {lang === "ar" ? c.title_ar : c.title_en}
              </option>
            ))}
          </select>
          <input
            type="number"
            min={1}
            max={100}
            value={count}
            onChange={(e) => setCount(Number(e.target.value))}
            className={field}
            placeholder={t("count")}
          />
          <button
            disabled={busy}
            onClick={generate}
            className="rounded-2xl bg-primary px-7 py-3 text-sm font-extrabold text-primary-foreground disabled:opacity-60"
          >
            {busy ? t("loading") : t("generate")}
          </button>
        </div>
      </section>

      <section className="overflow-hidden rounded-3xl border border-border bg-card shadow-soft">
        <table className="w-full text-start text-sm">
          <thead className="bg-secondary text-secondary-foreground">
            <tr>
              <th className="p-4 text-start">{t("code")}</th>
              <th className="p-4 text-start">{t("course")}</th>
              <th className="p-4 text-start">{t("status")}</th>
            </tr>
          </thead>
          <tbody>
            {codes?.map((c) => (
              <tr key={c.id} className="border-t border-border">
                <td className="p-4 font-mono font-bold tracking-widest">
                  <button
                    className="inline-flex items-center gap-2"
                    onClick={() => {
                      navigator.clipboard.writeText(c.code);
                      toast.success(c.code);
                    }}
                  >
                    {c.code} <Copy className="size-3.5 text-muted-foreground" />
                  </button>
                </td>
                <td className="p-4">{c.course_title}</td>
                <td className="p-4">
                  {c.used_by ? (
                    <span className="rounded-full bg-secondary px-3 py-1 text-xs font-bold">
                      {t("used")} — {c.used_by_name || t("usedBy")}
                    </span>
                  ) : (
                    <span className="rounded-full bg-accent-gradient px-3 py-1 text-xs font-bold text-accent-foreground">
                      {t("available")}
                    </span>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>
    </div>
  );
}
