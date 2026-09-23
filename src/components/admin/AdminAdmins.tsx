import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { ShieldPlus, UserCog } from "lucide-react";
import { useI18n } from "@/lib/i18n";
import { addAdmin, listAdmins, updateAdminCredentials } from "@/lib/admin.functions";

export function AdminAdmins() {
  const { t } = useI18n();
  const queryClient = useQueryClient();
  const fetchAdmins = useServerFn(listAdmins);
  const createAdmin = useServerFn(addAdmin);
  const updateAdmin = useServerFn(updateAdminCredentials);

  const [fullName, setFullName] = useState("");
  const [phone, setPhone] = useState("");
  const [password, setPassword] = useState("");
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
      await createAdmin({ data: { fullName, phone, password } });
      toast.success(t("savedOk"));
      setFullName("");
      setPhone("");
      setPassword("");
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
            />
          ))}
        </div>
      </section>
    </div>
  );
}

function AdminRow({
  admin,
  onSave,
}: {
  admin: { id: string; fullName: string; phone: string };
  onSave: (input: { phone?: string; password?: string }) => Promise<void>;
}) {
  const { t } = useI18n();
  const [phone, setPhone] = useState(admin.phone);
  const [password, setPassword] = useState("");
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
