import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { FolderPlus, GraduationCap, Trash2 } from "lucide-react";
import { useI18n } from "@/lib/i18n";
import { supabase } from "@/integrations/supabase/client";

export function AdminCatalog({ lang }: { lang: "ar" | "en" }) {
  const { t } = useI18n();
  const queryClient = useQueryClient();
  const [busy, setBusy] = useState(false);

  const [slug, setSlug] = useState("");
  const [nameAr, setNameAr] = useState("");

  const [categoryId, setCategoryId] = useState("");
  const [titleAr, setTitleAr] = useState("");
  const [price, setPrice] = useState(0);
  const [hours, setHours] = useState(1);
  const [instructor, setInstructor] = useState("");
  const [image, setImage] = useState("");

  const { data: categories } = useQuery({
    queryKey: ["admin-categories"],
    queryFn: async () => (await supabase.from("categories").select("*").order("sort_order")).data ?? [],
  });

  const { data: courses } = useQuery({
    queryKey: ["admin-catalog-courses", categoryId],
    enabled: Boolean(categoryId),
    queryFn: async () =>
      (await supabase.from("courses").select("*").eq("category_id", categoryId).order("title_ar")).data ?? [],
  });

  const run = async (fn: () => Promise<void>, keys: string[][]) => {
    setBusy(true);
    try {
      await fn();
      for (const key of keys) await queryClient.invalidateQueries({ queryKey: key });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  };

  const addCategory = () =>
    run(async () => {
      const { error } = await supabase.from("categories").insert({
        slug: slug.trim().toLowerCase(),
        name_ar: nameAr,
        name_en: nameAr,
      });
      if (error) throw error;
      toast.success(t("savedOk"));
      setSlug("");
      setNameAr("");
    }, [["admin-categories"]]);

  const deleteCategory = (id: string) =>
    run(async () => {
      const { error } = await supabase.from("categories").delete().eq("id", id);
      if (error) throw error;
      toast.success(t("deletedOk"));
    }, [["admin-categories"]]);

  const addCourse = () =>
    run(async () => {
      if (!categoryId) throw new Error(t("selectCategoryFirst"));
      const { error } = await supabase.from("courses").insert({
        category_id: categoryId,
        title_ar: titleAr,
        title_en: titleAr,
        price,
        duration_hours: hours,
        instructor,
        image_url: image,
      });
      if (error) throw error;
      toast.success(t("savedOk"));
      setTitleAr("");
      setInstructor("");
      setImage("");
    }, [["admin-catalog-courses", categoryId], ["admin-courses"]]);

  const deleteCourse = (id: string) =>
    run(async () => {
      const { error } = await supabase.from("courses").delete().eq("id", id);
      if (error) throw error;
      toast.success(t("deletedOk"));
    }, [["admin-catalog-courses", categoryId], ["admin-courses"]]);

  const field = "rounded-2xl border border-border bg-background px-4 py-3 text-sm";

  return (
    <div className="space-y-8">
      <section className="rounded-3xl border border-border bg-card p-7 shadow-soft">
        <h2 className="flex items-center gap-2 text-lg font-extrabold">
          <FolderPlus className="size-5 text-primary" /> {t("addCategory")}
        </h2>
        <div className="mt-5 grid gap-3 sm:grid-cols-3">
          <input value={nameAr} onChange={(e) => setNameAr(e.target.value)} placeholder={t("categoryNameAr")} className={field} />
          <input value={slug} dir="ltr" onChange={(e) => setSlug(e.target.value)} placeholder={t("slug")} className={field} />
          <button
            disabled={busy}
            onClick={addCategory}
            className="rounded-2xl bg-primary px-7 py-3 text-sm font-extrabold text-primary-foreground disabled:opacity-60 sm:col-span-3"
          >
            {busy ? t("loading") : t("addCategory")}
          </button>
        </div>

        <div className="mt-6 space-y-2">
          {(categories ?? []).length === 0 && <p className="text-sm text-muted-foreground">{t("noItems")}</p>}
          {(categories ?? []).map((c) => (
            <div key={c.id} className="flex items-center gap-3 rounded-2xl border border-border bg-background p-4">
              <span className="flex-1 text-sm font-bold">{lang === "ar" ? c.name_ar : c.name_en}</span>
              <span className="text-xs text-muted-foreground" dir="ltr">
                /{c.slug}
              </span>
              <button
                disabled={busy}
                onClick={() => deleteCategory(c.id)}
                aria-label={t("deleteLabel")}
                className="rounded-full bg-destructive/10 p-2 text-destructive disabled:opacity-60"
              >
                <Trash2 className="size-4" />
              </button>
            </div>
          ))}
        </div>
      </section>

      <section className="rounded-3xl border border-border bg-card p-7 shadow-soft">
        <h2 className="flex items-center gap-2 text-lg font-extrabold">
          <GraduationCap className="size-5 text-primary" /> {t("addCourse")}
        </h2>
        <div className="mt-5 grid gap-3 sm:grid-cols-2">
          <select value={categoryId} onChange={(e) => setCategoryId(e.target.value)} className={`${field} sm:col-span-2`}>
            <option value="">{t("selectCategory")}</option>
            {(categories ?? []).map((c) => (
              <option key={c.id} value={c.id}>
                {lang === "ar" ? c.name_ar : c.name_en}
              </option>
            ))}
          </select>
          <input value={titleAr} onChange={(e) => setTitleAr(e.target.value)} placeholder={t("courseTitleAr")} className={field} />
          <input type="number" min={0} value={price} onChange={(e) => setPrice(Number(e.target.value))} placeholder={t("coursePrice")} className={field} />
          <input type="number" min={0} value={hours} onChange={(e) => setHours(Number(e.target.value))} placeholder={t("courseDuration")} className={field} />
          <input value={instructor} onChange={(e) => setInstructor(e.target.value)} placeholder={t("courseInstructor")} className={field} />
          <input value={image} dir="ltr" onChange={(e) => setImage(e.target.value)} placeholder={t("courseImage")} className={field} />
          <button
            disabled={busy}
            onClick={addCourse}
            className="rounded-2xl bg-primary px-7 py-3 text-sm font-extrabold text-primary-foreground disabled:opacity-60 sm:col-span-2"
          >
            {busy ? t("loading") : t("addCourse")}
          </button>
        </div>

        {categoryId && (
          <div className="mt-6 space-y-2">
            {(courses ?? []).length === 0 && <p className="text-sm text-muted-foreground">{t("noItems")}</p>}
            {(courses ?? []).map((c) => (
              <div key={c.id} className="flex items-center gap-3 rounded-2xl border border-border bg-background p-4">
                <span className="flex-1 text-sm font-bold">{lang === "ar" ? c.title_ar : c.title_en}</span>
                <button
                  disabled={busy}
                  onClick={() => deleteCourse(c.id)}
                  aria-label={t("deleteLabel")}
                  className="rounded-full bg-destructive/10 p-2 text-destructive disabled:opacity-60"
                >
                  <Trash2 className="size-4" />
                </button>
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
