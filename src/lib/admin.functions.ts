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
    return (profiles ?? []).map((p) => ({ id: p.id, fullName: p.full_name, phone: p.phone }));
  });

export const listUsers = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertAdmin(context.supabase as never, context.userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const [{ data: profiles }, { data: enrollments }, { data: courses }, { data: categories }] = await Promise.all([
      supabaseAdmin.from("profiles").select("id, full_name, phone, guardian_phone, password_plain, created_at").order("created_at", { ascending: false }),
      supabaseAdmin.from("enrollments").select("user_id, course_id"),
      supabaseAdmin.from("courses").select("id, title_ar, category_id"),
      supabaseAdmin.from("categories").select("id, name_ar"),
    ]);

    const courseById = new Map((courses ?? []).map((c) => [c.id, c]));
    const categoryById = new Map((categories ?? []).map((c) => [c.id, c.name_ar]));

    return (profiles ?? []).map((p) => {
      const rows = (enrollments ?? []).filter((e) => e.user_id === p.id);
      const userCourses = rows.map((e) => courseById.get(e.course_id)).filter(Boolean) as { id: string; title_ar: string; category_id: string }[];
      const cats = Array.from(new Set(userCourses.map((c) => categoryById.get(c.category_id)).filter(Boolean) as string[]));
      return {
        id: p.id,
        fullName: p.full_name,
        phone: p.phone,
        guardianPhone: p.guardian_phone,
        password: p.password_plain,
        categories: cats,
        courses: userCourses.map((c) => c.title_ar),
      };
    });
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
      .upsert({ id: created.user.id, full_name: data.fullName, phone: data.phone, guardian_phone: "" });
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
    if (data.phone) {
      await supabaseAdmin.from("profiles").update({ phone: data.phone }).eq("id", data.userId);
    }
    return { ok: true };
  });
