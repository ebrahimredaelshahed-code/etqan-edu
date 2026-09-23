import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { ShieldPlus, UserCog } from "lucide-react";
import { useI18n } from "@/lib/i18n";
import { addAdmin, listAdmins, updateAdminCredentials, updateAdminPermissions, type AdminPermissions } from "@/lib/admin.functions";

type Category = { id: string; name_ar: string; name_en: string };
type PermissionInput = Omit<AdminPermissions, "fullAccess">;

export function AdminAdmins({ categories }: { categories: Category[] }) {
  const { t } = useI18n();
  const queryClient = useQueryClient();
  const fetchAdmins = useServerFn(listAdmins);
  const createAdmin = useServerFn(addAdmin);
  const updateAdmin = useServerFn(updateAdminCredentials);
  const savePermissions = useServerFn(updateAdminPermissions);

  const [fullName, setFullName] = useState("");
  const [phone, setPhone] = useState("");
  const [password, setPassword] = useState("");
  const [permissions, setPermissions] = useState<PermissionInput>({
    canCodes: false,
    canCatalog: false,
    canVideos: false,
    canUsers: false,
    canAdmins: false,
    categoryIds: [],
  });
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
      await createAdmin({ data: { fullName, phone, password, ...permissions } });
      toast.success(t("savedOk"));
      setFullName("");
      setPhone("");
      setPassword("");
      setPermissions({ canCodes: false, canCatalog: false, canVideos: false, canUsers: false, canAdmins: false, categoryIds: [] });
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
          <PermissionPicker value={permissions} categories={categories} onChange={setPermissions} />
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
              categories={categories}
              onSave={async (input) => {
                await savePermissions({ data: { userId: a.id, ...input.permissions } });
                if (input.password) await updateAdmin({ data: { userId: a.id, password: input.password } });
                toast.success(t("savedOk"));
                await queryClient.invalidateQueries({ queryKey: ["admin-admins"] });
              }}
            />
          ))}
        </div>
      </section>
    </div>
  );
}

function AdminRow({
  admin,
  categories,
  onSave,
}: {
  admin: { id: string; fullName: string; permissions: AdminPermissions };
  categories: Category[];
  onSave: (input: { permissions: PermissionInput; password?: string }) => Promise<void>;
}) {
  const { t } = useI18n();
  const [password, setPassword] = useState("");
  const [permissions, setPermissions] = useState<PermissionInput>({
    canCodes: admin.permissions.canCodes,
    canCatalog: admin.permissions.canCatalog,
    canVideos: admin.permissions.canVideos,
    canUsers: admin.permissions.canUsers,
    canAdmins: admin.permissions.canAdmins,
    categoryIds: admin.permissions.categoryIds,
  });
  const [busy, setBusy] = useState(false);

  const save = async () => {
    setBusy(true);
    try {
      await onSave({
        permissions,
        password: password || undefined,
      });
      setPassword("");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="space-y-4 rounded-2xl border border-border bg-background p-4">
      <span className="block text-sm font-bold">{admin.fullName || t("adminAccount")}</span>
      <PermissionPicker value={permissions} categories={categories} onChange={setPermissions} />
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
    </div>
  );
}

function PermissionPicker({
  value,
  categories,
  onChange,
}: {
  value: PermissionInput;
  categories: Category[];
  onChange: (value: PermissionInput) => void;
}) {
  const { t, lang } = useI18n();
  const permissions = [
    ["canCodes", "tabCodes"],
    ["canCatalog", "tabCatalog"],
    ["canVideos", "tabVideos"],
    ["canUsers", "tabUsers"],
    ["canAdmins", "tabAdmins"],
  ] as const;

  const toggleCategory = (categoryId: string) => {
    const categoryIds = value.categoryIds.includes(categoryId)
      ? value.categoryIds.filter((id) => id !== categoryId)
      : [...value.categoryIds, categoryId];
    onChange({ ...value, categoryIds });
  };

  return (
    <div className="space-y-3 rounded-2xl border border-border bg-secondary/40 p-4 sm:col-span-3">
      <p className="text-sm font-extrabold">{t("adminPermissions")}</p>
      <div className="flex flex-wrap gap-4">
        {permissions.map(([key, label]) => (
          <label key={key} className="flex items-center gap-2 text-sm font-bold">
            <input
              type="checkbox"
              checked={value[key]}
              onChange={(event) => onChange({ ...value, [key]: event.target.checked })}
            />
            {t(label)}
          </label>
        ))}
      </div>
      <div className="flex flex-wrap gap-3 border-t border-border pt-3">
        <span className="text-xs font-bold text-muted-foreground">{t("adminCategories")}</span>
        {categories.map((category) => (
          <label key={category.id} className="flex items-center gap-2 text-xs font-bold">
            <input
              type="checkbox"
              checked={value.categoryIds.includes(category.id)}
              onChange={() => toggleCategory(category.id)}
            />
            {lang === "ar" ? category.name_ar : category.name_en}
          </label>
        ))}
      </div>
    </div>
  );
}
