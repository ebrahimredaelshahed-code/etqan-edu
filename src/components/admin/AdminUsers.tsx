import { useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { Download, Eye, EyeOff, Trash2, Users } from "lucide-react";
import { useI18n } from "@/lib/i18n";
import { deletePlatformUser, listPlatformUsers } from "@/lib/admin.functions";

type Category = { id: string; name_ar: string; name_en: string };
type Course = { id: string; category_id: string; title_ar: string; title_en: string };

export function AdminUsers({ categories, courses }: { categories: Category[]; courses: Course[] }) {
  const { t } = useI18n();
  const queryClient = useQueryClient();
  const fetchUsers = useServerFn(listPlatformUsers);
  const removeUser = useServerFn(deletePlatformUser);

  const [search, setSearch] = useState("");
  const [categoryName, setCategoryName] = useState("");
  const [courseName, setCourseName] = useState("");
  const [showPasswords, setShowPasswords] = useState(false);
  const [busy, setBusy] = useState(false);

  const { data: users } = useQuery({
    queryKey: ["admin-users"],
    queryFn: () => fetchUsers({}),
    refetchInterval: 15_000,
    staleTime: 10_000,
    placeholderData: (previous) => previous,
  });

  const rows = useMemo(() => {
    const term = search.trim();
    return (users ?? []).filter(
      (u) =>
        (!term || u.fullName.includes(term) || u.phone.includes(term)) &&
        (!categoryName || u.categories.includes(categoryName)) &&
        (!courseName || u.courses.includes(courseName)),
    );
  }, [users, search, categoryName, courseName]);

  const exportExcel = () => {
    const head = [
      t("fullName"),
      t("phone"),
      t("guardianPhone"),
      t("password"),
      t("subscribedCategories"),
      t("subscribedCourses"),
    ];
    const esc = (v: string) => v.replace(/&/g, "&amp;").replace(/</g, "&lt;");
    const body = rows
      .map(
        (u) =>
          `<tr>${[u.fullName, u.phone, u.guardianPhone, u.password, u.categories.join("، "), u.courses.join("، ")]
            .map((v) => `<td>${esc(String(v ?? ""))}</td>`)
            .join("")}</tr>`,
      )
      .join("");
    const html = `<html dir="rtl"><head><meta charset="utf-8" /></head><body><table border="1"><thead><tr>${head
      .map((h) => `<th>${esc(h)}</th>`)
      .join("")}</tr></thead><tbody>${body}</tbody></table></body></html>`;
    const blob = new Blob(["\ufeff", html], { type: "application/vnd.ms-excel;charset=utf-8" });
    const link = document.createElement("a");
    link.href = URL.createObjectURL(blob);
    link.download = `etqan-users-${new Date().toISOString().slice(0, 10)}.xls`;
    link.click();
    URL.revokeObjectURL(link.href);
  };

  const onDelete = async (id: string) => {
    if (!window.confirm(t("confirmDeleteUser"))) return;
    setBusy(true);
    try {
      await removeUser({ data: { userId: id } });
      toast.success(t("deletedOk"));
      await queryClient.invalidateQueries({ queryKey: ["admin-users"] });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  };

  const field = "rounded-2xl border border-border bg-background px-4 py-3 text-sm";

  return (
    <section className="rounded-3xl border border-border bg-card p-7 shadow-soft">
      <h2 className="flex items-center gap-2 text-lg font-extrabold">
        <Users className="size-5 text-primary" /> {t("usersList")} ({rows.length})
      </h2>

      <div className="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder={t("searchByName")} className={field} />
        <select value={categoryName} onChange={(e) => setCategoryName(e.target.value)} className={field}>
          <option value="">{t("allCategories")}</option>
          {categories.map((c) => (
            <option key={c.id} value={c.name_ar}>
              {c.name_ar}
            </option>
          ))}
        </select>
        <select value={courseName} onChange={(e) => setCourseName(e.target.value)} className={field}>
          <option value="">{t("allCourses")}</option>
          {courses.map((c) => (
            <option key={c.id} value={c.title_ar}>
              {c.title_ar}
            </option>
          ))}
        </select>
        <div className="flex gap-2">
          <button
            onClick={() => setShowPasswords((v) => !v)}
            className="flex flex-1 items-center justify-center gap-2 rounded-2xl border border-border px-4 py-3 text-xs font-bold"
          >
            {showPasswords ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
            {showPasswords ? t("hidePassword") : t("showPassword")}
          </button>
          <button
            onClick={exportExcel}
            className="flex flex-1 items-center justify-center gap-2 rounded-2xl bg-primary px-4 py-3 text-xs font-extrabold text-primary-foreground"
          >
            <Download className="size-4" /> {t("exportExcel")}
          </button>
        </div>
      </div>

      <div className="mt-6 overflow-x-auto rounded-2xl border border-border">
        <table className="w-full min-w-[860px] text-start text-sm">
          <thead className="bg-secondary text-secondary-foreground">
            <tr>
              <th className="p-3 text-start">{t("fullName")}</th>
              <th className="p-3 text-start">{t("phone")}</th>
              <th className="p-3 text-start">{t("guardianPhone")}</th>
              <th className="p-3 text-start">{t("password")}</th>
              <th className="p-3 text-start">{t("subscribedCategories")}</th>
              <th className="p-3 text-start">{t("subscribedCourses")}</th>
              <th className="p-3 text-start">{t("deleteLabel")}</th>
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 && (
              <tr>
                <td colSpan={7} className="p-4 text-muted-foreground">
                  {t("noItems")}
                </td>
              </tr>
            )}
            {rows.map((u) => (
              <tr key={u.id} className="border-t border-border align-top">
                <td className="p-3 font-bold">{u.fullName || "—"}</td>
                <td className="p-3" dir="ltr">
                  {u.phone || "—"}
                </td>
                <td className="p-3" dir="ltr">
                  {u.guardianPhone || "—"}
                </td>
                <td className="p-3 font-mono" dir="ltr">
                  {u.password ? (showPasswords ? u.password : "••••••••") : "—"}
                </td>
                <td className="p-3">{u.categories.join("، ") || "—"}</td>
                <td className="p-3">{u.courses.join("، ") || "—"}</td>
                <td className="p-3">
                  <button
                    disabled={busy}
                    onClick={() => onDelete(u.id)}
                    aria-label={t("deleteUser")}
                    className="rounded-full bg-destructive/10 p-2 text-destructive disabled:opacity-60"
                  >
                    <Trash2 className="size-4" />
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}
