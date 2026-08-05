import { useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { Download, Eye, EyeOff, Trash2, Users, X } from "lucide-react";
import { useI18n } from "@/lib/i18n";
import { deletePlatformUser, getPlatformUserDetail, listPlatformUsers } from "@/lib/admin.functions";

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
  const [busy, setBusy] = useState(false);
  const [openUser, setOpenUser] = useState<string | null>(null);

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
      setOpenUser(null);
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
        <button
          onClick={exportExcel}
          className="flex items-center justify-center gap-2 rounded-2xl bg-primary px-4 py-3 text-xs font-extrabold text-primary-foreground"
        >
          <Download className="size-4" /> {t("exportExcel")}
        </button>
      </div>

      <div className="mt-6 overflow-hidden rounded-2xl border border-border">
        <table className="w-full text-start text-sm">
          <thead className="bg-secondary text-secondary-foreground">
            <tr>
              <th className="p-3 text-start">{t("fullName")}</th>
              <th className="p-3 text-start">{t("deleteLabel")}</th>
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 && (
              <tr>
                <td colSpan={2} className="p-4 text-muted-foreground">
                  {t("noItems")}
                </td>
              </tr>
            )}
            {rows.map((u) => (
              <tr key={u.id} className="border-t border-border">
                <td className="p-3">
                  <button onClick={() => setOpenUser(u.id)} className="font-bold text-primary hover:underline">
                    {u.fullName || u.phone || "—"}
                  </button>
                </td>
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

      {openUser && <UserDialog userId={openUser} onClose={() => setOpenUser(null)} />}
    </section>
  );
}

function UserDialog({ userId, onClose }: { userId: string; onClose: () => void }) {
  const { t } = useI18n();
  const fetchDetail = useServerFn(getPlatformUserDetail);
  const [showPassword, setShowPassword] = useState(false);

  const { data, isLoading } = useQuery({
    queryKey: ["admin-user-detail", userId],
    queryFn: () => fetchDetail({ data: { userId } }),
    refetchInterval: 20_000,
  });

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4"
      role="dialog"
      aria-modal="true"
      onClick={onClose}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="max-h-[85vh] w-full max-w-2xl overflow-y-auto rounded-3xl border border-border bg-card p-7 shadow-lift"
      >
        <div className="flex items-center justify-between">
          <h3 className="text-lg font-extrabold">{t("userDetails")}</h3>
          <button onClick={onClose} aria-label={t("close")} className="rounded-full bg-secondary p-2">
            <X className="size-4" />
          </button>
        </div>

        {isLoading || !data ? (
          <p className="mt-6 text-sm text-muted-foreground">{t("loading")}</p>
        ) : (
          <div className="mt-6 space-y-6">
            <dl className="grid gap-3 sm:grid-cols-2">
              <Info label={t("fullName")} value={data.fullName || "—"} />
              <Info label={t("phone")} value={data.phone || "—"} ltr />
              <Info label={t("guardianPhone")} value={data.guardianPhone || "—"} ltr />
              <div className="rounded-2xl border border-border p-4">
                <dt className="text-xs font-bold text-muted-foreground">{t("password")}</dt>
                <dd className="mt-1 flex items-center gap-2 font-mono text-sm" dir="ltr">
                  {data.password ? (showPassword ? data.password : "••••••••") : "—"}
                  {data.password && (
                    <button
                      onClick={() => setShowPassword((v) => !v)}
                      aria-label={showPassword ? t("hidePassword") : t("showPassword")}
                      className="text-primary"
                    >
                      {showPassword ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
                    </button>
                  )}
                </dd>
              </div>
            </dl>

            <div>
              <h4 className="text-sm font-extrabold">{t("subscribedCategories")}</h4>
              <p className="mt-1 text-sm text-muted-foreground">{data.categories.join("، ") || "—"}</p>
            </div>

            <div>
              <h4 className="text-sm font-extrabold">{t("progressInCourses")}</h4>
              <div className="mt-2 space-y-2">
                {data.courses.length === 0 && <p className="text-sm text-muted-foreground">{t("noCourses")}</p>}
                {data.courses.map((c) => (
                  <div key={c.id} className="rounded-2xl border border-border p-4">
                    <div className="flex items-center justify-between text-sm font-bold">
                      <span>
                        {c.title}
                        {c.category && <span className="ms-2 text-xs text-muted-foreground">({c.category})</span>}
                      </span>
                      <span className="text-primary">
                        {c.completed}/{c.total} — {c.percent}%
                      </span>
                    </div>
                    <div className="mt-2 h-2 overflow-hidden rounded-full bg-secondary">
                      <div className="h-full rounded-full bg-accent-gradient" style={{ width: `${c.percent}%` }} />
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div>
              <h4 className="text-sm font-extrabold">{t("quizResults")}</h4>
              <div className="mt-2 space-y-2">
                {data.attempts.length === 0 && <p className="text-sm text-muted-foreground">{t("noAttempts")}</p>}
                {data.attempts.map((a) => (
                  <div
                    key={a.id}
                    className="flex flex-wrap items-center justify-between gap-2 rounded-2xl border border-border p-4 text-sm"
                  >
                    <span className="font-bold">
                      {a.quiz}
                      <span className="ms-2 text-xs font-normal text-muted-foreground">{a.course}</span>
                    </span>
                    <span className="font-extrabold text-primary">
                      {a.score}/{a.maxScore}
                      {a.hasEssay && (
                        <span className="ms-2 text-xs font-normal text-muted-foreground">{t("essayPending")}</span>
                      )}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function Info({ label, value, ltr }: { label: string; value: string; ltr?: boolean }) {
  return (
    <div className="rounded-2xl border border-border p-4">
      <dt className="text-xs font-bold text-muted-foreground">{label}</dt>
      <dd className="mt-1 text-sm font-bold" dir={ltr ? "ltr" : undefined}>
        {value}
      </dd>
    </div>
  );
}
