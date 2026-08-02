import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const phoneToEmail = (phone: string) => `u${phone.replace(/\D/g, "")}@etqan-academy.app`;

async function assertAdmin(supabase: { rpc: (fn: string, args: Record<string, unknown>) => Promise<{ data: unknown }> }, userId: string) {
  const { data } = await supabase.rpc("has_role", { _user_id: userId, _role: "admin" });
  if (data !== true) throw new Error("forbidden");
}

export const listAdmins = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertAdmin(context.supabase as never, context.userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: roles } = await supabaseAdmin.from("user_roles").select("user_id").eq("role", "admin");
    const ids = (roles ?? []).map((r) => r.user_id);
    if (ids.length === 0) return [];
    const { data: profiles } = await supabaseAdmin
      .from("profiles")
      .select("id, full_name, phone")
      .in("id", ids);
    const byId = new Map((profiles ?? []).map((p) => [p.id, p]));
    const rows = await Promise.all(
      ids.map(async (id) => {
        const profile = byId.get(id);
        if (profile) return { id, fullName: profile.full_name ?? "", phone: profile.phone ?? "" };
        const { data: authUser } = await supabaseAdmin.auth.admin.getUserById(id);
        const meta = (authUser?.user?.user_metadata ?? {}) as { full_name?: string; phone?: string };
        return { id, fullName: meta.full_name ?? "", phone: meta.phone ?? authUser?.user?.email ?? "" };
      }),
    );
    return rows;
  });

export const addAdmin = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data) =>
    z
      .object({
        fullName: z.string().min(2),
        phone: z.string().min(6),
        password: z.string().min(8),
      })
      .parse(data),
  )
  .handler(async ({ context, data }) => {
    await assertAdmin(context.supabase as never, context.userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: created, error } = await supabaseAdmin.auth.admin.createUser({
      email: phoneToEmail(data.phone),
      password: data.password,
      email_confirm: true,
      user_metadata: { full_name: data.fullName, phone: data.phone, guardian_phone: "" },
    });
    if (error || !created.user) throw new Error(error?.message ?? "create_failed");
    await supabaseAdmin
      .from("profiles")
      .upsert({ id: created.user.id, full_name: data.fullName, phone: data.phone, guardian_phone: "", password_plain: data.password });
    const { error: roleError } = await supabaseAdmin
      .from("user_roles")
      .upsert({ user_id: created.user.id, role: "admin" }, { onConflict: "user_id,role" });
    if (roleError) throw new Error(roleError.message);
    return { ok: true };
  });

export const updateAdminCredentials = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data) =>
    z
      .object({
        userId: z.string().uuid(),
        phone: z.string().min(6).optional(),
        password: z.string().min(8).optional(),
      })
      .parse(data),
  )
  .handler(async ({ context, data }) => {
    await assertAdmin(context.supabase as never, context.userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const payload: { email?: string; password?: string } = {};
    if (data.phone) payload.email = phoneToEmail(data.phone);
    if (data.password) payload.password = data.password;
    if (Object.keys(payload).length === 0) return { ok: true };
    const { error } = await supabaseAdmin.auth.admin.updateUserById(data.userId, payload);
    if (error) throw new Error(error.message);
    const profilePatch: { phone?: string; password_plain?: string } = {};
    if (data.phone) profilePatch.phone = data.phone;
    if (data.password) profilePatch.password_plain = data.password;
    if (Object.keys(profilePatch).length > 0) {
      await supabaseAdmin.from("profiles").update(profilePatch).eq("id", data.userId);
    }
    return { ok: true };
  });

export const listPlatformUsers = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertAdmin(context.supabase as never, context.userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const [{ data: profiles }, { data: roles }, { data: subs }, { data: enrolls }, { data: cats }, { data: courses }] =
      await Promise.all([
        supabaseAdmin.from("profiles").select("id, full_name, phone, guardian_phone, password_plain, created_at"),
        supabaseAdmin.from("user_roles").select("user_id, role"),
        supabaseAdmin.from("category_subscriptions").select("user_id, category_id"),
        supabaseAdmin.from("enrollments").select("user_id, course_id"),
        supabaseAdmin.from("categories").select("id, name_ar"),
        supabaseAdmin.from("courses").select("id, title_ar"),
      ]);
    const catName = new Map((cats ?? []).map((c) => [c.id, c.name_ar]));
    const courseName = new Map((courses ?? []).map((c) => [c.id, c.title_ar]));
    const adminIds = new Set((roles ?? []).filter((r) => r.role === "admin").map((r) => r.user_id));
    return (profiles ?? []).map((p) => ({
      id: p.id,
      fullName: p.full_name ?? "",
      phone: p.phone ?? "",
      guardianPhone: p.guardian_phone ?? "",
      password: p.password_plain ?? "",
      isAdmin: adminIds.has(p.id),
      createdAt: p.created_at,
      categories: (subs ?? [])
        .filter((s) => s.user_id === p.id)
        .map((s) => catName.get(s.category_id) ?? "")
        .filter(Boolean),
      courses: (enrolls ?? [])
        .filter((e) => e.user_id === p.id)
        .map((e) => courseName.get(e.course_id) ?? "")
        .filter(Boolean),
    }));
  });

export const deletePlatformUser = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data) => z.object({ userId: z.string().uuid() }).parse(data))
  .handler(async ({ context, data }) => {
    await assertAdmin(context.supabase as never, context.userId);
    if (data.userId === context.userId) throw new Error("cannot_delete_self");
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    await supabaseAdmin.from("category_subscriptions").delete().eq("user_id", data.userId);
    await supabaseAdmin.from("lesson_progress").delete().eq("user_id", data.userId);
    await supabaseAdmin.from("enrollments").delete().eq("user_id", data.userId);
    await supabaseAdmin.from("user_roles").delete().eq("user_id", data.userId);
    await supabaseAdmin.from("profiles").delete().eq("id", data.userId);
    const { error } = await supabaseAdmin.auth.admin.deleteUser(data.userId);
    if (error) throw new Error(error.message);
    return { ok: true };
  });
