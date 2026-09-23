import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { ShieldPlus, Trash2, UserCog } from "lucide-react";
import { useI18n } from "@/lib/i18n";
import { addAdmin, listAdmins, removeAdminAccess, updateAdminCategories, updateAdminCredentials } from "@/lib/admin.functions";

type Category = { id: string; name_ar: string; name_en: string };

export function AdminAdmins({ categories }: { categories: Category[] }) {
  const { t } = useI18n();
  const queryClient = useQueryClient();
  const fetchAdmins = useServerFn(listAdmins);
  const createAdmin = useServerFn(addAdmin);
  const updateAdmin = useServerFn(updateAdminCredentials);
  const updateCategories = useServerFn(updateAdminCategories);
  const removeAdmin = useServerFn(removeAdminAccess);

  const [fullName, setFullName] = useState("");
  const [phone, setPhone] = useState("");
  const [password, setPassword] = useState("");
  const [categoryIds, setCategoryIds] = useState<string[]>([]);
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
      await createAdmin({ data: { fullName, phone, password, categoryIds } });
      toast.success(t("savedOk"));
      setFullName("");
      setPhone("");
      setPassword("");
      setCategoryIds([]);
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
          <CategoryPicker categories={categories} value={categoryIds} onChange={setCategoryIds} />
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
                await updateAdmin({ data: { userId: a.id, ...input } });
                toast.success(t("savedOk"));
                await queryClient.invalidateQueries({ queryKey: ["admin-admins"] });
              }}
              onCategoriesSave={async (nextCategoryIds) => {
                await updateCategories({ data: { userId: a.id, categoryIds: nextCategoryIds } });
                toast.success(t("savedOk"));
                await queryClient.invalidateQueries({ queryKey: ["admin-admins"] });
              }}
              onRemove={async () => {
                if (!window.confirm(t("confirmRemoveAdmin"))) return;
                await removeAdmin({ data: { userId: a.id } });
                toast.success(t("adminRemoved"));
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
  onCategoriesSave,
  onRemove,
}: {
  admin: { id: string; fullName: string; phone: string; categoryIds: string[] };
  categories: Category[];
  onSave: (input: { phone?: string; password?: string }) => Promise<void>;
  onCategoriesSave: (categoryIds: string[]) => Promise<void>;
  onRemove: () => Promise<void>;
}) {
  const { t } = useI18n();
  const [phone, setPhone] = useState(admin.phone);
  const [password, setPassword] = useState("");
  const [categoryIds, setCategoryIds] = useState(admin.categoryIds);
  const [busy, setBusy] = useState(false);

  const save = async () => {
    setBusy(true);
    try {
      await onSave({
        phone: phone && phone !== admin.phone ? phone : undefined,
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
    <div className="flex flex-wrap items-center gap-3 rounded-2xl border border-border bg-background p-4">
      <span className="w-full text-sm font-bold sm:w-auto sm:flex-1">{admin.fullName || admin.phone}</span>
      <input
        value={phone}
        dir="ltr"
        onChange={(e) => setPhone(e.target.value)}
        placeholder={t("newPhone")}
        className="min-w-0 flex-1 rounded-full border border-border bg-card px-4 py-2 text-xs"
      />
      <input
        type="password"
        value={password}
        onChange={(e) => setPassword(e.target.value)}
        placeholder={t("newPassword")}
        className="min-w-0 flex-1 rounded-full border border-border bg-card px-4 py-2 text-xs"
      />
      <CategoryPicker categories={categories} value={categoryIds} onChange={setCategoryIds} />
      <button
        disabled={busy}
        onClick={save}
        className="rounded-full border border-border px-4 py-1.5 text-xs font-bold disabled:opacity-60"
      >
        {t("update")}
      </button>
      <button
        disabled={busy}
        onClick={async () => {
          setBusy(true);
          try {
            await onCategoriesSave(categoryIds);
          } catch (e) {
            toast.error(e instanceof Error ? e.message : String(e));
          } finally {
            setBusy(false);
          }
        }}
        className="rounded-full border border-primary px-4 py-1.5 text-xs font-bold text-primary disabled:opacity-60"
      >
        {t("saveSubjects")}
      </button>
      <button
        disabled={busy}
        onClick={async () => {
          setBusy(true);
          try {
            await onRemove();
          } catch (e) {
            toast.error(e instanceof Error ? e.message : String(e));
          } finally {
            setBusy(false);
          }
        }}
        aria-label={t("removeAdmin")}
        className="rounded-full bg-destructive/10 p-2 text-destructive disabled:opacity-60"
      >
        <Trash2 className="size-4" />
      </button>
    </div>
  );
}

function CategoryPicker({
  categories,
  value,
  onChange,
}: {
  categories: Category[];
  value: string[];
  onChange: (value: string[]) => void;
}) {
  const { t, lang } = useI18n();
  return (
    <fieldset className="w-full rounded-2xl border border-border bg-secondary/40 p-3 sm:col-span-3">
      <legend className="px-1 text-xs font-extrabold">{t("adminSubjects")}</legend>
      <div className="flex flex-wrap gap-3">
        {categories.map((category) => {
          const checked = value.includes(category.id);
          return (
            <label key={category.id} className="flex items-center gap-2 text-xs font-bold">
              <input
                type="checkbox"
                checked={checked}
                onChange={() => onChange(checked ? value.filter((id) => id !== category.id) : [...value, category.id])}
              />
              {lang === "ar" ? category.name_ar : category.name_en}
            </label>
          );
        })}
      </div>
    </fieldset>
  );
}
