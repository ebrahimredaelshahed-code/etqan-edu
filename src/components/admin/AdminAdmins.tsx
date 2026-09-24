import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { ShieldPlus, UserCog, UserMinus } from "lucide-react";
import { useI18n } from "@/lib/i18n";
import { addAdmin, listAdmins, removeAdminAccess, updateAdminCredentials } from "@/lib/admin.functions";

type Category = { id: string; name_ar: string; name_en: string };
type Permissions = { codes: boolean; catalog: boolean; videos: boolean; users: boolean };

export function AdminAdmins({ categories, lang }: { categories: Category[]; lang: "ar" | "en" }) {
  const { t } = useI18n();
  const queryClient = useQueryClient();
  const fetchAdmins = useServerFn(listAdmins);
  const createAdmin = useServerFn(addAdmin);
  const updateAdmin = useServerFn(updateAdminCredentials);
  const revokeAdmin = useServerFn(removeAdminAccess);

  const [fullName, setFullName] = useState("");
  const [phone, setPhone] = useState("");
  const [password, setPassword] = useState("");
  const [categoryId, setCategoryId] = useState("");
  const [permissions, setPermissions] = useState<Permissions>({ codes: false, catalog: false, videos: false, users: false });
  const [busy, setBusy] = useState(false);

  const { data: admins } = useQuery({
    queryKey: ["admin-admins"],
    queryFn: () => fetchAdmins({}),
    staleTime: 60_000,
    gcTime: 30 * 60_000,
    retry: 3,
    refetchOnWindowFocus: false,
    placeholderData: (previous) => previous,
  });

  const field = "rounded-2xl border border-border bg-background px-4 py-3 text-sm";

  const submit = async () => {
    setBusy(true);
    try {
      if (!categoryId) throw new Error(t("selectAdminCategory"));
      if (!Object.values(permissions).some(Boolean)) throw new Error(t("adminPermissions"));
      await createAdmin({ data: { fullName, phone, password, categoryId, permissions } });
      toast.success(t("savedOk"));
      setFullName("");
      setPhone("");
      setPassword("");
      setCategoryId("");
      setPermissions({ codes: false, catalog: false, videos: false, users: false });
      await queryClient.invalidateQueries({ queryKey: ["admin-admins"] });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="space-y-8">
      <section className="rounded-3xl border border-border bg-card p-7 shadow-soft">
        <h2 className="flex items-center gap-2 text-lg font-extrabold">
          <ShieldPlus className="size-5 text-primary" /> {t("addAdmin")}
        </h2>
        <div className="mt-5 grid gap-3 sm:grid-cols-3">
          <input value={fullName} onChange={(e) => setFullName(e.target.value)} placeholder={t("fullName")} className={field} />
          <input value={phone} dir="ltr" onChange={(e) => setPhone(e.target.value)} placeholder={t("phone")} className={field} />
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder={t("password")}
            className={field}
          />
          <select value={categoryId} onChange={(e) => setCategoryId(e.target.value)} className={field}>
            <option value="">{t("selectAdminCategory")}</option>
            {categories.map((category) => (
              <option key={category.id} value={category.id}>
                {lang === "ar" ? category.name_ar : category.name_en}
              </option>
            ))}
          </select>
          <div className="flex flex-wrap items-center gap-3 rounded-2xl border border-border bg-background px-4 py-3 text-sm sm:col-span-2">
            <span className="w-full font-bold">{t("adminPermissions")}</span>
            {permissionFields.map(({ key, label }) => (
              <label key={key} className="inline-flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={permissions[key]}
                  onChange={(e) => setPermissions((current) => ({ ...current, [key]: e.target.checked }))}
                />
                {t(label)}
              </label>
            ))}
          </div>
          <button
            disabled={busy}
            onClick={submit}
            className="rounded-2xl bg-primary px-7 py-3 text-sm font-extrabold text-primary-foreground disabled:opacity-60 sm:col-span-3"
          >
            {busy ? t("loading") : t("addAdmin")}
          </button>
        </div>
      </section>

      <section className="rounded-3xl border border-border bg-card p-7 shadow-soft">
        <h2 className="flex items-center gap-2 text-lg font-extrabold">
          <UserCog className="size-5 text-primary" /> {t("adminsList")}
        </h2>
        <div className="mt-5 space-y-3">
          {(admins ?? []).length === 0 && <p className="text-sm text-muted-foreground">{t("noItems")}</p>}
          {(admins ?? []).map((a) => (
            <AdminRow
              key={a.id}
              admin={a}
              onSave={async (input) => {
                await updateAdmin({ data: { userId: a.id, ...input } });
                toast.success(t("savedOk"));
                await queryClient.invalidateQueries({ queryKey: ["admin-admins"] });
              }}
              categories={categories}
              lang={lang}
              onRevoke={async () => {
                if (!window.confirm(t("confirmRevokeAdmin"))) return;
                await revokeAdmin({ data: { userId: a.id } });
                toast.success(t("deletedOk"));
                await queryClient.invalidateQueries({ queryKey: ["admin-admins"] });
              }}
            />
          ))}
        </div>
      </section>
    </div>
  );
}

const permissionFields: Array<{ key: keyof Permissions; label: "permissionCodes" | "permissionCatalog" | "permissionVideos" | "permissionUsers" }> = [
  { key: "codes", label: "permissionCodes" },
  { key: "catalog", label: "permissionCatalog" },
  { key: "videos", label: "permissionVideos" },
  { key: "users", label: "permissionUsers" },
];

function AdminRow({
  admin,
  categories,
  lang,
  onSave,
  onRevoke,
}: {
  admin: { id: string; fullName: string; phone: string; categoryId: string | null; permissions: Permissions; isSuperAdmin: boolean };
  categories: Category[];
  lang: "ar" | "en";
  onSave: (input: { phone?: string; password?: string; categoryId?: string; permissions?: Permissions }) => Promise<void>;
  onRevoke: () => Promise<void>;
}) {
  const { t } = useI18n();
  const [phone, setPhone] = useState(admin.phone);
  const [password, setPassword] = useState("");
  const [categoryId, setCategoryId] = useState(admin.categoryId ?? "");
  const [permissions, setPermissions] = useState<Permissions>(admin.permissions);
  const [busy, setBusy] = useState(false);

  const save = async () => {
    setBusy(true);
    try {
      await onSave({
        phone: phone && phone !== admin.phone ? phone : undefined,
        password: password || undefined,
        categoryId: categoryId || undefined,
        permissions: categoryId ? permissions : undefined,
      });
      setPassword("");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="flex flex-wrap items-center gap-3 rounded-2xl border border-border bg-background p-4">
      <span className="w-full text-sm font-bold sm:w-auto sm:flex-1">{admin.fullName || admin.phone}</span>
      <input
        value={phone}
        dir="ltr"
        onChange={(e) => setPhone(e.target.value)}
        placeholder={t("newPhone")}
        className="min-w-0 flex-1 rounded-full border border-border bg-card px-4 py-2 text-xs"
      />
      <select value={categoryId} onChange={(e) => setCategoryId(e.target.value)} disabled={admin.isSuperAdmin} className="min-w-0 flex-1 rounded-full border border-border bg-card px-4 py-2 text-xs">
        <option value="">{t("adminCategory")}</option>
        {categories.map((category) => (
          <option key={category.id} value={category.id}>
            {lang === "ar" ? category.name_ar : category.name_en}
          </option>
        ))}
      </select>
      <div className="flex flex-wrap gap-2 text-xs">
        {permissionFields.map(({ key, label }) => (
          <label key={key} className="inline-flex items-center gap-1">
            <input
              type="checkbox"
              checked={permissions[key]}
              onChange={(e) => setPermissions((current) => ({ ...current, [key]: e.target.checked }))}
            />
            {t(label)}
          </label>
        ))}
      </div>
      <input
        type="password"
        value={password}
        onChange={(e) => setPassword(e.target.value)}
        placeholder={t("newPassword")}
        className="min-w-0 flex-1 rounded-full border border-border bg-card px-4 py-2 text-xs"
      />
      <button
        disabled={busy}
        onClick={save}
        className="rounded-full border border-border px-4 py-1.5 text-xs font-bold disabled:opacity-60"
      >
        {t("update")}
      </button>
      {!admin.isSuperAdmin && (
        <button onClick={onRevoke} aria-label={t("revokeAdmin")} className="rounded-full bg-destructive/10 p-2 text-destructive">
          <UserMinus className="size-4" />
        </button>
      )}
    </div>
  );
}
