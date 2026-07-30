import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Search, Users } from "lucide-react";
import { useI18n } from "@/lib/i18n";
import { listUsers } from "@/lib/admin.functions";

export function AdminUsers() {
  const { t } = useI18n();
  const fetchUsers = useServerFn(listUsers);
  const [query, setQuery] = useState("");

  const { data: users, isLoading } = useQuery({ queryKey: ["admin-users"], queryFn: () => fetchUsers({}) });

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return users ?? [];
    return (users ?? []).filter(
      (u) => u.fullName.toLowerCase().includes(q) || u.phone.toLowerCase().includes(q),
    );
  }, [users, query]);

  return (
    <section className="rounded-3xl border border-border bg-card p-7 shadow-soft">
      <h2 className="flex items-center gap-2 text-lg font-extrabold">
        <Users className="size-5 text-primary" /> {t("usersList")}
      </h2>

      <div className="relative mt-5">
        <Search className="pointer-events-none absolute top-1/2 size-4 -translate-y-1/2 text-muted-foreground ltr:left-4 rtl:right-4" />
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder={t("searchUsers")}
          className="w-full rounded-2xl border border-border bg-background py-3 text-sm outline-none focus:border-primary ltr:pl-11 ltr:pr-4 rtl:pr-11 rtl:pl-4"
        />
      </div>

      <div className="mt-6 overflow-x-auto">
        <table className="w-full min-w-[820px] text-start text-sm">
          <thead className="text-xs text-muted-foreground">
            <tr className="border-b border-border">
              <Th>{t("fullName")}</Th>
              <Th>{t("phone")}</Th>
              <Th>{t("guardianPhone")}</Th>
              <Th>{t("savedPassword")}</Th>
              <Th>{t("myCategories")}</Th>
              <Th>{t("myCourses")}</Th>
            </tr>
          </thead>
          <tbody>
            {isLoading ? (
              <tr>
                <td colSpan={6} className="py-6 text-muted-foreground">
                  {t("loading")}
                </td>
              </tr>
            ) : filtered.length === 0 ? (
              <tr>
                <td colSpan={6} className="py-6 text-muted-foreground">
                  {t("noItems")}
                </td>
              </tr>
            ) : (
              filtered.map((u) => (
                <tr key={u.id} className="border-b border-border/60 align-top">
                  <Td className="font-bold">{u.fullName || "—"}</Td>
                  <Td dir="ltr">{u.phone || "—"}</Td>
                  <Td dir="ltr">{u.guardianPhone || "—"}</Td>
                  <Td dir="ltr">{u.password || "—"}</Td>
                  <Td>{u.categories.length ? u.categories.join("، ") : "—"}</Td>
                  <Td>{u.courses.length ? u.courses.join("، ") : "—"}</Td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </section>
  );
}

function Th({ children }: { children: React.ReactNode }) {
  return <th className="whitespace-nowrap py-3 text-start font-bold">{children}</th>;
}

function Td({ children, className = "", dir }: { children: React.ReactNode; className?: string; dir?: string }) {
  return (
    <td dir={dir} className={`py-3 pe-4 text-start ${className}`}>
      {children}
    </td>
  );
}
