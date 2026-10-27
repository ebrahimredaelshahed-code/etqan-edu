import { useState, type FormEvent } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { FolderPlus, GraduationCap, ImageUp, Pencil, Trash2 } from "lucide-react";
import { useI18n } from "@/lib/i18n";
import { supabase } from "@/integrations/supabase/client";
import type { Database } from "@/integrations/supabase/types";
import { uploadTeacherImage, useTeacherImageUrl } from "@/lib/teacher-image";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

type CategoryRecord = Database["public"]["Tables"]["categories"]["Row"];
type CourseRecord = Database["public"]["Tables"]["courses"]["Row"];

export function AdminCatalog({
  lang,
  categoryIds,
  isSuperAdmin,
}: {
  lang: "ar" | "en";
  categoryIds: string[];
  isSuperAdmin: boolean;
}) {
  const { t } = useI18n();
  const queryClient = useQueryClient();
  const [busy, setBusy] = useState(false);
  const [editingCategory, setEditingCategory] = useState<CategoryRecord | null>(null);
  const [editingCourse, setEditingCourse] = useState<CourseRecord | null>(null);

  const [slug, setSlug] = useState("");
  const [nameAr, setNameAr] = useState("");
  const [teacher, setTeacher] = useState("");
  const [teacherImg, setTeacherImg] = useState("");
  const [specialty, setSpecialty] = useState("");
  const [subscriptionPhone, setSubscriptionPhone] = useState("");

  const [categoryId, setCategoryId] = useState("");
  const [titleAr, setTitleAr] = useState("");
  const [price, setPrice] = useState(0);
  const [hours, setHours] = useState(1);
  const [instructor, setInstructor] = useState("");
  const [image, setImage] = useState("");

  const { data: categories } = useQuery({
    queryKey: ["admin-categories"],
    queryFn: async () =>
      (await supabase.from("categories").select("*").order("sort_order")).data ?? [],
  });

  const { data: courses } = useQuery({
    queryKey: ["admin-catalog-courses", categoryId],
    enabled: Boolean(categoryId),
    queryFn: async () =>
      (await supabase.from("courses").select("*").eq("category_id", categoryId).order("title_ar"))
        .data ?? [],
  });

  const visibleCategories = (categories ?? []).filter(
    (category) => isSuperAdmin || categoryIds.includes(category.id),
  );

  const run = async (fn: () => Promise<void>, keys: string[][]): Promise<boolean> => {
    setBusy(true);
    try {
      await fn();
      for (const key of keys) await queryClient.invalidateQueries({ queryKey: key });
      return true;
    } catch (e) {
      toast.error(e instanceof Error ? e.message : String(e));
      return false;
    } finally {
      setBusy(false);
    }
  };

  const addCategory = () =>
    run(async () => {
      const fallbackSlug = `cat-${Date.now().toString(36)}`;
      const cleanSlug =
        slug
          .trim()
          .toLowerCase()
          .replace(/[^a-z0-9-]+/g, "-")
          .replace(/^-+|-+$/g, "") || fallbackSlug;
      const { error } = await supabase.from("categories").insert({
        slug: cleanSlug,
        name_ar: nameAr,
        name_en: nameAr,
        teacher_name: teacher,
        teacher_image_url: teacherImg,
        description_ar: specialty,
        description_en: specialty,
        subscription_phone: subscriptionPhone,
      });
      if (error) throw error;
      toast.success(t("savedOk"));
      setSlug("");
      setNameAr("");
      setTeacher("");
      setTeacherImg("");
      setSpecialty("");
      setSubscriptionPhone("");
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
  const labelClass = "grid gap-1.5 text-sm font-bold";

  const saveCategory = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!editingCategory) return;
    const slug = editingCategory.slug
      .trim()
      .toLowerCase()
      .replace(/[^a-z0-9-]+/g, "-")
      .replace(/^-+|-+$/g, "");
    if (!slug) {
      toast.error(t("invalidSlug"));
      return;
    }

    const saved = await run(async () => {
      const { error } = await supabase
        .from("categories")
        .update({
          slug,
          name_ar: editingCategory.name_ar,
          name_en: editingCategory.name_en,
          description_ar: editingCategory.description_ar,
          description_en: editingCategory.description_en,
          icon: editingCategory.icon,
          sort_order: editingCategory.sort_order,
          teacher_name: editingCategory.teacher_name,
          teacher_image_url: editingCategory.teacher_image_url,
          subscription_phone: editingCategory.subscription_phone,
        })
        .eq("id", editingCategory.id);
      if (error) throw error;
      toast.success(t("savedOk"));
    }, [["admin-categories"]]);
    if (saved) setEditingCategory(null);
  };

  const saveCourse = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!editingCourse) return;

    const saved = await run(async () => {
      const { error } = await supabase
        .from("courses")
        .update({
          category_id: editingCourse.category_id,
          title_ar: editingCourse.title_ar,
          title_en: editingCourse.title_en,
          description_ar: editingCourse.description_ar,
          description_en: editingCourse.description_en,
          image_url: editingCourse.image_url,
          duration_hours: editingCourse.duration_hours,
          price: editingCourse.price,
          instructor: editingCourse.instructor,
        })
        .eq("id", editingCourse.id);
      if (error) throw error;
      toast.success(t("savedOk"));
    }, [["admin-catalog-courses"], ["admin-courses"]]);
    if (saved) setEditingCourse(null);
  };

  return (
    <div className="space-y-8">
      <section className="rounded-3xl border border-border bg-card p-7 shadow-soft">
        <h2 className="flex items-center gap-2 text-lg font-extrabold">
          <FolderPlus className="size-5 text-primary" /> {t("addCategory")}
        </h2>
        <div className="mt-5 grid gap-3 sm:grid-cols-3">
          <input
            value={nameAr}
            onChange={(e) => setNameAr(e.target.value)}
            placeholder={t("categoryNameAr")}
            className={field}
          />
          <input
            value={slug}
            dir="ltr"
            onChange={(e) => setSlug(e.target.value)}
            placeholder={t("slug")}
            className={field}
          />
          <input
            value={teacher}
            onChange={(e) => setTeacher(e.target.value)}
            placeholder={t("teacherName")}
            className={field}
          />
          <input
            value={specialty}
            onChange={(e) => setSpecialty(e.target.value)}
            placeholder={t("teacherSpecialty")}
            className={field}
          />
          <input
            value={subscriptionPhone}
            dir="ltr"
            onChange={(e) => setSubscriptionPhone(e.target.value)}
            placeholder={t("subscriptionPhone")}
            className={field}
          />
          <TeacherImageField
            value={teacherImg}
            onChange={setTeacherImg}
            label={t("teacherImage")}
            uploadingLabel={t("uploading")}
            className={field}
          />

          <button
            disabled={busy}
            onClick={addCategory}
            className="rounded-2xl bg-primary px-7 py-3 text-sm font-extrabold text-primary-foreground disabled:opacity-60 sm:col-span-3"
          >
            {busy ? t("loading") : t("addCategory")}
          </button>
        </div>

        <div className="mt-6 space-y-2">
          {(categories ?? []).length === 0 && (
            <p className="text-sm text-muted-foreground">{t("noItems")}</p>
          )}
          {visibleCategories.map((c) => (
            <div
              key={c.id}
              className="flex items-center gap-3 rounded-2xl border border-border bg-background p-4"
            >
              <button
                type="button"
                disabled={busy}
                onClick={() => setEditingCategory(c)}
                aria-label={`${t("editCategory")}: ${lang === "ar" ? c.name_ar : c.name_en}`}
                className="flex min-w-0 flex-1 items-center gap-2 text-start text-sm font-bold hover:text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              >
                <Pencil className="size-4 shrink-0" />
                <span className="truncate">{lang === "ar" ? c.name_ar : c.name_en}</span>
              </button>
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
          <select
            value={categoryId}
            onChange={(e) => setCategoryId(e.target.value)}
            className={`${field} sm:col-span-2`}
          >
            <option value="">{t("selectCategory")}</option>
            {visibleCategories.map((c) => (
              <option key={c.id} value={c.id}>
                {lang === "ar" ? c.name_ar : c.name_en}
              </option>
            ))}
          </select>
          <input
            value={titleAr}
            onChange={(e) => setTitleAr(e.target.value)}
            placeholder={t("courseTitleAr")}
            className={field}
          />
          <input
            type="number"
            min={0}
            value={price}
            onChange={(e) => setPrice(Number(e.target.value))}
            placeholder={t("coursePrice")}
            className={field}
          />
          <input
            type="number"
            min={0}
            value={hours}
            onChange={(e) => setHours(Number(e.target.value))}
            placeholder={t("courseDuration")}
            className={field}
          />
          <input
            value={instructor}
            onChange={(e) => setInstructor(e.target.value)}
            placeholder={t("courseInstructor")}
            className={field}
          />
          <TeacherImageField
            value={image}
            onChange={setImage}
            label={t("courseImageUpload")}
            uploadingLabel={t("uploading")}
            className={field}
          />
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
            {(courses ?? []).length === 0 && (
              <p className="text-sm text-muted-foreground">{t("noItems")}</p>
            )}
            {(courses ?? []).map((c) => (
              <div
                key={c.id}
                className="flex items-center gap-3 rounded-2xl border border-border bg-background p-4"
              >
                <button
                  type="button"
                  disabled={busy}
                  onClick={() => setEditingCourse(c)}
                  aria-label={`${t("editCourse")}: ${lang === "ar" ? c.title_ar : c.title_en}`}
                  className="flex min-w-0 flex-1 items-center gap-2 text-start text-sm font-bold hover:text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                >
                  <Pencil className="size-4 shrink-0" />
                  <span className="truncate">{lang === "ar" ? c.title_ar : c.title_en}</span>
                </button>
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

      <Dialog
        open={Boolean(editingCategory)}
        onOpenChange={(open) => {
          if (!open && !busy) setEditingCategory(null);
        }}
      >
        <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-3xl">
          <DialogHeader>
            <DialogTitle>{t("editCategory")}</DialogTitle>
          </DialogHeader>
          {editingCategory && (
            <form onSubmit={saveCategory} className="space-y-5">
              <div className="grid gap-3 sm:grid-cols-2">
                <label className={labelClass}>
                  <span>{t("categoryNameAr")}</span>
                  <input
                    required
                    value={editingCategory.name_ar}
                    onChange={(e) =>
                      setEditingCategory({ ...editingCategory, name_ar: e.target.value })
                    }
                    className={field}
                  />
                </label>
                <label className={labelClass}>
                  <span>{t("categoryNameEn")}</span>
                  <input
                    required
                    dir="ltr"
                    value={editingCategory.name_en}
                    onChange={(e) =>
                      setEditingCategory({ ...editingCategory, name_en: e.target.value })
                    }
                    className={field}
                  />
                </label>
                <label className={`${labelClass} sm:col-span-2`}>
                  <span>{t("slug")}</span>
                  <input
                    required
                    dir="ltr"
                    value={editingCategory.slug}
                    onChange={(e) =>
                      setEditingCategory({ ...editingCategory, slug: e.target.value })
                    }
                    className={field}
                  />
                </label>
                <label className={labelClass}>
                  <span>{t("categoryDescriptionAr")}</span>
                  <textarea
                    value={editingCategory.description_ar}
                    onChange={(e) =>
                      setEditingCategory({ ...editingCategory, description_ar: e.target.value })
                    }
                    className={field}
                    rows={3}
                  />
                </label>
                <label className={labelClass}>
                  <span>{t("categoryDescriptionEn")}</span>
                  <textarea
                    dir="ltr"
                    value={editingCategory.description_en}
                    onChange={(e) =>
                      setEditingCategory({ ...editingCategory, description_en: e.target.value })
                    }
                    className={field}
                    rows={3}
                  />
                </label>
                <label className={labelClass}>
                  <span>{t("categoryIcon")}</span>
                  <input
                    value={editingCategory.icon}
                    onChange={(e) =>
                      setEditingCategory({ ...editingCategory, icon: e.target.value })
                    }
                    className={field}
                  />
                </label>
                <label className={labelClass}>
                  <span>{t("sortOrder")}</span>
                  <input
                    type="number"
                    step={1}
                    value={editingCategory.sort_order}
                    onChange={(e) =>
                      setEditingCategory({ ...editingCategory, sort_order: Number(e.target.value) })
                    }
                    className={field}
                  />
                </label>
                <label className={labelClass}>
                  <span>{t("teacherName")}</span>
                  <input
                    value={editingCategory.teacher_name}
                    onChange={(e) =>
                      setEditingCategory({ ...editingCategory, teacher_name: e.target.value })
                    }
                    className={field}
                  />
                </label>
                <TeacherImageField
                  value={editingCategory.teacher_image_url}
                  onChange={(teacher_image_url) =>
                    setEditingCategory({ ...editingCategory, teacher_image_url })
                  }
                  label={t("teacherImage")}
                  uploadingLabel={t("uploading")}
                  className={field}
                />
                <label className={`${labelClass} sm:col-span-2`}>
                  <span>{t("subscriptionPhone")}</span>
                  <input
                    dir="ltr"
                    value={editingCategory.subscription_phone}
                    onChange={(e) =>
                      setEditingCategory({ ...editingCategory, subscription_phone: e.target.value })
                    }
                    className={field}
                  />
                </label>
              </div>
              <DialogFooter>
                <button
                  type="button"
                  disabled={busy}
                  onClick={() => setEditingCategory(null)}
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

      <Dialog
        open={Boolean(editingCourse)}
        onOpenChange={(open) => {
          if (!open && !busy) setEditingCourse(null);
        }}
      >
        <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-3xl">
          <DialogHeader>
            <DialogTitle>{t("editCourse")}</DialogTitle>
          </DialogHeader>
          {editingCourse && (
            <form onSubmit={saveCourse} className="space-y-5">
              <div className="grid gap-3 sm:grid-cols-2">
                <label className={`${labelClass} sm:col-span-2`}>
                  <span>{t("category")}</span>
                  <select
                    required
                    value={editingCourse.category_id}
                    onChange={(e) =>
                      setEditingCourse({ ...editingCourse, category_id: e.target.value })
                    }
                    className={field}
                  >
                    {visibleCategories.map((category) => (
                      <option key={category.id} value={category.id}>
                        {lang === "ar" ? category.name_ar : category.name_en}
                      </option>
                    ))}
                  </select>
                </label>
                <label className={labelClass}>
                  <span>{t("courseTitleAr")}</span>
                  <input
                    required
                    value={editingCourse.title_ar}
                    onChange={(e) =>
                      setEditingCourse({ ...editingCourse, title_ar: e.target.value })
                    }
                    className={field}
                  />
                </label>
                <label className={labelClass}>
                  <span>{t("courseTitleEn")}</span>
                  <input
                    required
                    dir="ltr"
                    value={editingCourse.title_en}
                    onChange={(e) =>
                      setEditingCourse({ ...editingCourse, title_en: e.target.value })
                    }
                    className={field}
                  />
                </label>
                <label className={labelClass}>
                  <span>{t("courseDescriptionAr")}</span>
                  <textarea
                    value={editingCourse.description_ar}
                    onChange={(e) =>
                      setEditingCourse({ ...editingCourse, description_ar: e.target.value })
                    }
                    className={field}
                    rows={3}
                  />
                </label>
                <label className={labelClass}>
                  <span>{t("courseDescriptionEn")}</span>
                  <textarea
                    dir="ltr"
                    value={editingCourse.description_en}
                    onChange={(e) =>
                      setEditingCourse({ ...editingCourse, description_en: e.target.value })
                    }
                    className={field}
                    rows={3}
                  />
                </label>
                <label className={labelClass}>
                  <span>{t("coursePrice")}</span>
                  <input
                    type="number"
                    min={0}
                    step="any"
                    value={editingCourse.price}
                    onChange={(e) =>
                      setEditingCourse({ ...editingCourse, price: Number(e.target.value) })
                    }
                    className={field}
                  />
                </label>
                <label className={labelClass}>
                  <span>{t("courseDuration")}</span>
                  <input
                    type="number"
                    min={0}
                    step="any"
                    value={editingCourse.duration_hours}
                    onChange={(e) =>
                      setEditingCourse({ ...editingCourse, duration_hours: Number(e.target.value) })
                    }
                    className={field}
                  />
                </label>
                <label className={labelClass}>
                  <span>{t("courseInstructor")}</span>
                  <input
                    value={editingCourse.instructor}
                    onChange={(e) =>
                      setEditingCourse({ ...editingCourse, instructor: e.target.value })
                    }
                    className={field}
                  />
                </label>
                <TeacherImageField
                  value={editingCourse.image_url}
                  onChange={(image_url) => setEditingCourse({ ...editingCourse, image_url })}
                  label={t("courseImageUpload")}
                  uploadingLabel={t("uploading")}
                  className={field}
                />
              </div>
              <DialogFooter>
                <button
                  type="button"
                  disabled={busy}
                  onClick={() => setEditingCourse(null)}
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
    </div>
  );
}

function TeacherImageField({
  value,
  onChange,
  label,
  uploadingLabel,
  className,
}: {
  value: string;
  onChange: (value: string) => void;
  label: string;
  uploadingLabel: string;
  className: string;
}) {
  const [uploading, setUploading] = useState(false);
  const preview = useTeacherImageUrl(value);

  const pick = async (file: File | undefined) => {
    if (!file) return;
    setUploading(true);
    try {
      onChange(await uploadTeacherImage(file));
    } catch (e) {
      toast.error(e instanceof Error ? e.message : String(e));
    } finally {
      setUploading(false);
    }
  };

  return (
    <label className={`${className} flex cursor-pointer items-center gap-3`}>
      {preview ? (
        <img src={preview} alt={label} className="size-8 shrink-0 rounded-lg object-cover" />
      ) : (
        <ImageUp className="size-5 shrink-0 text-primary" />
      )}
      <span className="truncate text-muted-foreground">{uploading ? uploadingLabel : label}</span>
      <input
        type="file"
        accept="image/*"
        className="hidden"
        disabled={uploading}
        onChange={(e) => pick(e.target.files?.[0])}
      />
    </label>
  );
}
