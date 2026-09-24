import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const phoneToEmail = (phone: string) => `u${phone.replace(/\D/g, "")}@etqan-academy.app`;

export type AdminAccess = {
  isSuperAdmin: boolean;
  categoryIds: string[];
  permissions: { codes: boolean; catalog: boolean; videos: boolean; users: boolean };
};

type RpcClient = {
  rpc: (fn: string, args?: Record<string, unknown>) => Promise<{ data: unknown; error: { message: string } | null }>;
};

async function readRpc(supabase: unknown, fn: string, args?: Record<string, unknown>) {
  const { data, error } = await (supabase as RpcClient).rpc(fn, args);
  if (error) throw new Error(error.message);
  return data;
}

async function assertAdmin(supabase: { rpc: (fn: string, args: Record<string, unknown>) => Promise<{ data: unknown }> }, userId: string) {
  const { data } = await supabase.rpc("has_role", { _user_id: userId, _role: "admin" });
  if (data !== true) throw new Error("forbidden");
}

async function assertSuperAdmin(supabase: unknown) {
  if ((await readRpc(supabase, "is_super_admin")) !== true) throw new Error("forbidden");
}

export const getAdminAccess = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertAdmin(context.supabase as never, context.userId);
    const data = (await readRpc(context.supabase, "get_admin_access")) as {
      isSuperAdmin?: boolean;
      categoryIds?: unknown;
      permissions?: Partial<AdminAccess["permissions"]>;
    };
    return {
      isSuperAdmin: data.isSuperAdmin === true,
      categoryIds: Array.isArray(data.categoryIds) ? data.categoryIds.filter((id): id is string => typeof id === "string") : [],
      permissions: {
        codes: data.permissions?.codes === true,
        catalog: data.permissions?.catalog === true,
        videos: data.permissions?.videos === true,
        users: data.permissions?.users === true,
      },
    } satisfies AdminAccess;
  });

export const listAdmins = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertSuperAdmin(context.supabase);
    const rows = (await readRpc(context.supabase, "admin_list_admins")) as Array<{
      id: string;
      full_name: string;
      phone: string;
      category_id: string | null;
      can_codes: boolean;
      can_catalog: boolean;
      can_videos: boolean;
      can_users: boolean;
      is_super_admin: boolean;
    }>;
    return rows.map((row) => ({
      id: row.id,
      fullName: row.full_name ?? "",
      phone: row.phone ?? "",
      categoryId: row.category_id,
      permissions: { codes: row.can_codes, catalog: row.can_catalog, videos: row.can_videos, users: row.can_users },
      isSuperAdmin: row.is_super_admin,
    }));
  });

export const addAdmin = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data) =>
    z
      .object({
        fullName: z.string().min(2),
        phone: z.string().min(6),
        password: z.string().min(8),
        categoryId: z.string().uuid(),
        permissions: z.object({ codes: z.boolean(), catalog: z.boolean(), videos: z.boolean(), users: z.boolean() }),
      })
      .parse(data),
  )
  .handler(async ({ context, data }) => {
    await assertSuperAdmin(context.supabase);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: created, error } = await supabaseAdmin.auth.admin.createUser({
      email: phoneToEmail(data.phone),
      password: data.password,
      email_confirm: true,
      user_metadata: { full_name: data.fullName, phone: data.phone, guardian_phone: "" },
    });
    if (error || !created.user) throw new Error(error?.message ?? "create_failed");
    const { error: profileError } = await supabaseAdmin
      .from("profiles")
      .upsert({ id: created.user.id, full_name: data.fullName, phone: data.phone, guardian_phone: "" });
    if (profileError) {
      await supabaseAdmin.auth.admin.deleteUser(created.user.id);
      throw new Error(profileError.message);
    }
    const { error: roleError } = await supabaseAdmin
      .from("user_roles")
      .upsert({ user_id: created.user.id, role: "admin" }, { onConflict: "user_id,role" });
    if (roleError) {
      await supabaseAdmin.from("profiles").delete().eq("id", created.user.id);
      await supabaseAdmin.auth.admin.deleteUser(created.user.id);
      throw new Error(roleError.message);
    }
    try {
      await readRpc(context.supabase, "save_admin_scope", {
        _user_id: created.user.id,
        _category_id: data.categoryId,
        _can_codes: data.permissions.codes,
        _can_catalog: data.permissions.catalog,
        _can_videos: data.permissions.videos,
        _can_users: data.permissions.users,
      });
    } catch (error) {
      await supabaseAdmin.from("user_roles").delete().eq("user_id", created.user.id);
      await supabaseAdmin.from("profiles").delete().eq("id", created.user.id);
      await supabaseAdmin.auth.admin.deleteUser(created.user.id);
      throw error;
    }
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
        categoryId: z.string().uuid().optional(),
        permissions: z.object({ codes: z.boolean(), catalog: z.boolean(), videos: z.boolean(), users: z.boolean() }).optional(),
      })
      .parse(data),
  )
  .handler(async ({ context, data }) => {
    await assertSuperAdmin(context.supabase);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const payload: { email?: string; password?: string } = {};
    if (data.phone) payload.email = phoneToEmail(data.phone);
    if (data.password) payload.password = data.password;
    if (Object.keys(payload).length > 0) {
      const { error } = await supabaseAdmin.auth.admin.updateUserById(data.userId, payload);
      if (error) throw new Error(error.message);
      const profilePatch: { phone?: string } = {};
      if (data.phone) profilePatch.phone = data.phone;
      if (Object.keys(profilePatch).length > 0) {
        const { error: profileError } = await supabaseAdmin.from("profiles").update(profilePatch).eq("id", data.userId);
        if (profileError) throw new Error(profileError.message);
      }
    }
    if (data.categoryId && data.permissions) {
      await readRpc(context.supabase, "save_admin_scope", {
        _user_id: data.userId,
        _category_id: data.categoryId,
        _can_codes: data.permissions.codes,
        _can_catalog: data.permissions.catalog,
        _can_videos: data.permissions.videos,
        _can_users: data.permissions.users,
      });
    }
    return { ok: true };
  });

export const removeAdminAccess = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data) => z.object({ userId: z.string().uuid() }).parse(data))
  .handler(async ({ context, data }) => {
    await assertSuperAdmin(context.supabase);
    if (data.userId === context.userId) throw new Error("cannot_remove_self");
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await supabaseAdmin.from("user_roles").delete().match({ user_id: data.userId, role: "admin" });
    if (error) throw new Error(error.message);
    await supabaseAdmin.from("admin_scopes").delete().eq("user_id", data.userId);
    return { ok: true };
  });

export const listPlatformUsers = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const access = (await getAdminAccess({})) as AdminAccess;
    if (!access.isSuperAdmin && !access.permissions.users) return [];
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const [{ data: profiles }, { data: roles }, { data: subs }, { data: enrolls }, { data: cats }, { data: courses }] =
      await Promise.all([
        supabaseAdmin.from("profiles").select("id, full_name, phone, guardian_phone, created_at"),
        supabaseAdmin.from("user_roles").select("user_id, role"),
        supabaseAdmin.from("category_subscriptions").select("user_id, category_id"),
        supabaseAdmin.from("enrollments").select("user_id, course_id"),
        supabaseAdmin.from("categories").select("id, name_ar"),
        supabaseAdmin.from("courses").select("id, title_ar"),
      ]);
    const catName = new Map((cats ?? []).map((c) => [c.id, c.name_ar]));
    const courseName = new Map((courses ?? []).map((c) => [c.id, c.title_ar]));
    const adminIds = new Set((roles ?? []).filter((r) => r.role === "admin").map((r) => r.user_id));
    const visibleUserIds = access.isSuperAdmin
      ? new Set((profiles ?? []).map((p) => p.id))
      : new Set([
          ...(subs ?? []).filter((s) => access.categoryIds.includes(s.category_id)).map((s) => s.user_id),
          ...(enrolls ?? [])
            .filter((e) => access.categoryIds.includes((courses ?? []).find((c) => c.id === e.course_id)?.category_id ?? ""))
            .map((e) => e.user_id),
        ]);
    return (profiles ?? []).filter((p) => visibleUserIds.has(p.id) && (access.isSuperAdmin || !adminIds.has(p.id))).map((p) => ({
      id: p.id,
      fullName: p.full_name ?? "",
      phone: access.isSuperAdmin ? p.phone ?? "" : "",
      guardianPhone: access.isSuperAdmin ? p.guardian_phone ?? "" : "",
      isAdmin: adminIds.has(p.id),
      createdAt: p.created_at,
      categories: (subs ?? [])
        .filter((s) => s.user_id === p.id)
        .filter((s) => access.isSuperAdmin || access.categoryIds.includes(s.category_id))
        .map((s) => catName.get(s.category_id) ?? "")
        .filter(Boolean),
      courses: (enrolls ?? [])
        .filter((e) => e.user_id === p.id)
        .filter((e) => access.isSuperAdmin || access.categoryIds.includes((courses ?? []).find((c) => c.id === e.course_id)?.category_id ?? ""))
        .map((e) => courseName.get(e.course_id) ?? "")
        .filter(Boolean),
    }));
  });

export const getPlatformUserDetail = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data) => z.object({ userId: z.string().uuid() }).parse(data))
  .handler(async ({ context, data }) => {
    const access = (await getAdminAccess({})) as AdminAccess;
    if (!access.isSuperAdmin && !access.permissions.users) throw new Error("forbidden");
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const uid = data.userId;
    const [
      { data: profile },
      { data: subs },
      { data: enrolls },
      { data: cats },
      { data: courses },
      { data: lessons },
      { data: progress },
      { data: quizzes },
      { data: attempts },
    ] = await Promise.all([
      supabaseAdmin.from("profiles").select("*").eq("id", uid).maybeSingle(),
      supabaseAdmin.from("category_subscriptions").select("category_id").eq("user_id", uid),
      supabaseAdmin.from("enrollments").select("course_id").eq("user_id", uid),
      supabaseAdmin.from("categories").select("id, name_ar"),
      supabaseAdmin.from("courses").select("id, title_ar, category_id"),
      supabaseAdmin.from("lessons").select("id, course_id"),
      supabaseAdmin.from("lesson_progress").select("lesson_id, course_id").eq("user_id", uid),
      supabaseAdmin.from("quizzes").select("id, title_ar, course_id"),
      supabaseAdmin
        .from("quiz_attempts")
        .select("id, quiz_id, course_id, score, max_score, has_essay, created_at")
        .eq("user_id", uid)
        .order("created_at", { ascending: false }),
    ]);

    const catName = new Map((cats ?? []).map((c) => [c.id, c.name_ar]));
    const courseById = new Map((courses ?? []).map((c) => [c.id, c]));
    const quizById = new Map((quizzes ?? []).map((q) => [q.id, q]));
    const doneIds = new Set((progress ?? []).map((p) => p.lesson_id));
    const enrolledCourseIds = (enrolls ?? []).map((e) => e.course_id);

    const targetIsAdmin = access.isSuperAdmin
      ? false
      : (await supabaseAdmin.from("user_roles").select("user_id").eq("user_id", uid).eq("role", "admin")).data?.length;
    if (targetIsAdmin) throw new Error("forbidden");
    const visibleCourses = access.isSuperAdmin
      ? enrolledCourseIds
      : enrolledCourseIds.filter((courseId) => access.categoryIds.includes(courseById.get(courseId)?.category_id ?? ""));

    return {
      id: uid,
      fullName: profile?.full_name ?? "",
      phone: access.isSuperAdmin ? profile?.phone ?? "" : "",
      guardianPhone: access.isSuperAdmin ? profile?.guardian_phone ?? "" : "",
      createdAt: profile?.created_at ?? null,
      categories: (subs ?? [])
        .filter((s) => access.isSuperAdmin || access.categoryIds.includes(s.category_id))
        .map((s) => catName.get(s.category_id) ?? "")
        .filter(Boolean),
      courses: visibleCourses.map((courseId) => {
        const course = courseById.get(courseId);
        const courseLessons = (lessons ?? []).filter((l) => l.course_id === courseId);
        const completed = courseLessons.filter((l) => doneIds.has(l.id)).length;
        return {
          id: courseId,
          title: course?.title_ar ?? "",
          category: course ? (catName.get(course.category_id) ?? "") : "",
          total: courseLessons.length,
          completed,
          percent: courseLessons.length ? Math.round((completed / courseLessons.length) * 100) : 0,
        };
      }),
      attempts: (attempts ?? []).map((a) => ({
        id: a.id,
        quiz: quizById.get(a.quiz_id)?.title_ar ?? "",
        course: courseById.get(a.course_id)?.title_ar ?? "",
        score: Number(a.score),
        maxScore: Number(a.max_score),
        hasEssay: a.has_essay,
        createdAt: a.created_at,
      })),
    };
  });

export const deletePlatformUser = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data) => z.object({ userId: z.string().uuid() }).parse(data))
  .handler(async ({ context, data }) => {
    await assertSuperAdmin(context.supabase);
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
