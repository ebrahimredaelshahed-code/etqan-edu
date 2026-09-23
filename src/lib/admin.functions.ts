import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const phoneToEmail = (phone: string) => `u${phone.replace(/\D/g, "")}@etqan-academy.app`;

export type AdminPermissionKey = "codes" | "catalog" | "videos" | "users" | "admins";

export type AdminPermissions = {
  fullAccess: boolean;
  canCodes: boolean;
  canCatalog: boolean;
  canVideos: boolean;
  canUsers: boolean;
  canAdmins: boolean;
  categoryIds: string[];
};

const permissionColumn: Record<AdminPermissionKey, keyof AdminPermissions> = {
  codes: "canCodes",
  catalog: "canCatalog",
  videos: "canVideos",
  users: "canUsers",
  admins: "canAdmins",
};

async function assertAdmin(supabase: { rpc: (fn: string, args: Record<string, unknown>) => Promise<{ data: unknown }> }, userId: string) {
  const { data } = await supabase.rpc("has_role", { _user_id: userId, _role: "admin" });
  if (data !== true) throw new Error("forbidden");
}

async function assertPermission(
  supabase: { rpc: (fn: string, args: Record<string, unknown>) => Promise<{ data: unknown }> },
  userId: string,
  permission: AdminPermissionKey,
) {
  const { data } = await supabase.rpc("admin_has_permission", {
    _user_id: userId,
    _permission: permission,
  });
  if (data !== true) throw new Error("forbidden");
}

async function readPermissions(supabaseAdmin: any, userId: string): Promise<AdminPermissions> {
  const { data } = await supabaseAdmin
    .from("admin_permissions")
    .select("full_access, can_codes, can_catalog, can_videos, can_users, can_admins, category_ids")
    .eq("user_id", userId)
    .maybeSingle();
  if (!data) {
    return { fullAccess: true, canCodes: true, canCatalog: true, canVideos: true, canUsers: true, canAdmins: true, categoryIds: [] };
  }
  return {
    fullAccess: data.full_access,
    canCodes: data.can_codes,
    canCatalog: data.can_catalog,
    canVideos: data.can_videos,
    canUsers: data.can_users,
    canAdmins: data.can_admins,
    categoryIds: data.category_ids ?? [],
  };
}

const hasPermission = (permissions: AdminPermissions, permission: AdminPermissionKey) =>
  permissions.fullAccess || permissions[permissionColumn[permission]] === true;

async function assertGrantable(
  supabaseAdmin: any,
  actorId: string,
  input: { canCodes: boolean; canCatalog: boolean; canVideos: boolean; canUsers: boolean; canAdmins: boolean; categoryIds: string[] },
) {
  const actor = await readPermissions(supabaseAdmin, actorId);
  for (const permission of ["codes", "catalog", "videos", "users", "admins"] as const) {
    if (input[permissionColumn[permission]] && !hasPermission(actor, permission)) throw new Error("cannot_grant_permission");
  }
  if (!actor.fullAccess && input.categoryIds.some((id) => !actor.categoryIds.includes(id))) {
    throw new Error("cannot_grant_category");
  }
}

export const getAdminAccess = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertAdmin(context.supabase as never, context.userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const permissions = await readPermissions(supabaseAdmin, context.userId);
    const { data: allCategories } = await supabaseAdmin.from("categories").select("*").order("sort_order");
    const categories = (allCategories ?? []).filter(
      (category) => permissions.fullAccess || permissions.categoryIds.includes(category.id),
    );
    const categoryIds = categories.map((category) => category.id);
    const { data: allCourses } = await supabaseAdmin.from("courses").select("*").order("title_ar");
    const courses = (allCourses ?? []).filter((course) => categoryIds.includes(course.category_id));
    return { permissions, categories, courses };
  });

export const listAdmins = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertPermission(context.supabase as never, context.userId, "admins");
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: roles } = await supabaseAdmin.from("user_roles").select("user_id").eq("role", "admin");
    const ids = (roles ?? []).map((r) => r.user_id);
    if (ids.length === 0) return [];
    const [{ data: profiles }, { data: permissionRows }] = await Promise.all([
      supabaseAdmin.from("profiles").select("id, full_name").in("id", ids),
      supabaseAdmin
        .from("admin_permissions")
        .select("user_id, full_access, can_codes, can_catalog, can_videos, can_users, can_admins, category_ids")
        .in("user_id", ids),
    ]);
    const byId = new Map((profiles ?? []).map((p) => [p.id, p]));
    const permissionById = new Map((permissionRows ?? []).map((row) => [row.user_id, row]));
    return ids.map((id) => {
      const profile = byId.get(id);
      const access = permissionById.get(id);
      return {
        id,
        fullName: profile?.full_name ?? "",
        permissions: {
          fullAccess: access?.full_access ?? true,
          canCodes: access?.can_codes ?? true,
          canCatalog: access?.can_catalog ?? true,
          canVideos: access?.can_videos ?? true,
          canUsers: access?.can_users ?? true,
          canAdmins: access?.can_admins ?? true,
          categoryIds: access?.category_ids ?? [],
        },
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
        canCodes: z.boolean(),
        canCatalog: z.boolean(),
        canVideos: z.boolean(),
        canUsers: z.boolean(),
        canAdmins: z.boolean(),
        categoryIds: z.array(z.string().uuid()),
      })
      .parse(data),
  )
  .handler(async ({ context, data }) => {
    await assertPermission(context.supabase as never, context.userId, "admins");
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    await assertGrantable(supabaseAdmin, context.userId, data);
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
    const { error: permissionError } = await supabaseAdmin.from("admin_permissions").insert({
      user_id: created.user.id,
      full_access: false,
      can_codes: data.canCodes,
      can_catalog: data.canCatalog,
      can_videos: data.canVideos,
      can_users: data.canUsers,
      can_admins: data.canAdmins,
      category_ids: data.categoryIds,
    });
    if (permissionError) {
      await supabaseAdmin.from("user_roles").delete().eq("user_id", created.user.id);
      await supabaseAdmin.from("profiles").delete().eq("id", created.user.id);
      await supabaseAdmin.auth.admin.deleteUser(created.user.id);
      throw new Error(permissionError.message);
    }
    return { ok: true };
  });

export const updateAdminPermissions = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data) =>
    z
      .object({
        userId: z.string().uuid(),
        canCodes: z.boolean(),
        canCatalog: z.boolean(),
        canVideos: z.boolean(),
        canUsers: z.boolean(),
        canAdmins: z.boolean(),
        categoryIds: z.array(z.string().uuid()),
      })
      .parse(data),
  )
  .handler(async ({ context, data }) => {
    await assertPermission(context.supabase as never, context.userId, "admins");
    if (data.userId === context.userId) throw new Error("cannot_change_self");
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const actor = await readPermissions(supabaseAdmin, context.userId);
    const target = await readPermissions(supabaseAdmin, data.userId);
    if (target.fullAccess && !actor.fullAccess) throw new Error("cannot_change_supervisor");
    await assertGrantable(supabaseAdmin, context.userId, data);
    const { error } = await supabaseAdmin
      .from("admin_permissions")
      .upsert({
        user_id: data.userId,
        full_access: false,
        can_codes: data.canCodes,
        can_catalog: data.canCatalog,
        can_videos: data.canVideos,
        can_users: data.canUsers,
        can_admins: data.canAdmins,
        category_ids: data.categoryIds,
        updated_at: new Date().toISOString(),
      });
    if (error) throw new Error(error.message);
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
    await assertPermission(context.supabase as never, context.userId, "admins");
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const payload: { email?: string; password?: string } = {};
    if (data.phone) payload.email = phoneToEmail(data.phone);
    if (data.password) payload.password = data.password;
    if (Object.keys(payload).length === 0) return { ok: true };
    const { error } = await supabaseAdmin.auth.admin.updateUserById(data.userId, payload);
    if (error) throw new Error(error.message);
    const profilePatch: { phone?: string } = {};
    if (data.phone) profilePatch.phone = data.phone;
    if (Object.keys(profilePatch).length > 0) {
      const { error: profileError } = await supabaseAdmin.from("profiles").update(profilePatch).eq("id", data.userId);
      if (profileError) throw new Error(profileError.message);
    }
    return { ok: true };
  });

export const listPlatformUsers = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertPermission(context.supabase as never, context.userId, "users");
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const permissions = await readPermissions(supabaseAdmin, context.userId);
    const [{ data: profiles }, { data: roles }, { data: subs }, { data: enrolls }, { data: cats }, { data: courses }] =
      await Promise.all([
        supabaseAdmin.from("profiles").select("id, full_name, phone, guardian_phone, created_at"),
        supabaseAdmin.from("user_roles").select("user_id, role"),
        supabaseAdmin.from("category_subscriptions").select("user_id, category_id"),
        supabaseAdmin.from("enrollments").select("user_id, course_id"),
        supabaseAdmin.from("categories").select("id, name_ar"),
        supabaseAdmin.from("courses").select("id, title_ar, category_id"),
      ]);
    const catName = new Map((cats ?? []).map((c) => [c.id, c.name_ar]));
    const courseName = new Map((courses ?? []).map((c) => [c.id, c.title_ar]));
    const adminIds = new Set((roles ?? []).filter((r) => r.role === "admin").map((r) => r.user_id));
    const allowedCategoryIds = new Set(permissions.categoryIds);
    const visibleProfiles = (profiles ?? []).filter((p) => {
      if (adminIds.has(p.id)) return false;
      if (permissions.fullAccess) return true;
      return (subs ?? []).some((subscription) => subscription.user_id === p.id && allowedCategoryIds.has(subscription.category_id));
    });
    return visibleProfiles.map((p) => ({
      id: p.id,
      fullName: p.full_name ?? "",
      phone: p.phone ?? "",
      guardianPhone: p.guardian_phone ?? "",
      createdAt: p.created_at,
      categories: (subs ?? [])
        .filter((s) => s.user_id === p.id)
        .filter((s) => permissions.fullAccess || allowedCategoryIds.has(s.category_id))
        .map((s) => catName.get(s.category_id) ?? "")
        .filter(Boolean),
      courses: (enrolls ?? [])
        .filter((e) => e.user_id === p.id)
        .filter((e) => {
          const course = (courses ?? []).find((item) => item.id === e.course_id);
          return permissions.fullAccess || Boolean(course && allowedCategoryIds.has(course.category_id));
        })
        .map((e) => courseName.get(e.course_id) ?? "")
        .filter(Boolean),
    }));
  });

export const getPlatformUserDetail = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data) => z.object({ userId: z.string().uuid() }).parse(data))
  .handler(async ({ context, data }) => {
    await assertPermission(context.supabase as never, context.userId, "users");
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const permissions = await readPermissions(supabaseAdmin, context.userId);
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

    const { data: targetRole } = await supabaseAdmin.from("user_roles").select("role").eq("user_id", uid).eq("role", "admin").maybeSingle();
    const targetCategoryIds = (subs ?? []).map((subscription) => subscription.category_id);
    if (targetRole || (!permissions.fullAccess && !targetCategoryIds.some((id) => permissions.categoryIds.includes(id)))) {
      throw new Error("forbidden");
    }

    const catName = new Map((cats ?? []).map((c) => [c.id, c.name_ar]));
    const courseById = new Map((courses ?? []).map((c) => [c.id, c]));
    const quizById = new Map((quizzes ?? []).map((q) => [q.id, q]));
    const doneIds = new Set((progress ?? []).map((p) => p.lesson_id));
    const visibleCourseIds = new Set(
      (enrolls ?? [])
        .map((enrollment) => courseById.get(enrollment.course_id))
        .filter((course) => Boolean(course && (permissions.fullAccess || permissions.categoryIds.includes(course.category_id))))
        .map((course) => course!.id),
    );

    return {
      id: uid,
      fullName: profile?.full_name ?? "",
      phone: profile?.phone ?? "",
      guardianPhone: profile?.guardian_phone ?? "",
      createdAt: profile?.created_at ?? null,
      categories: (subs ?? [])
        .filter((subscription) => permissions.fullAccess || permissions.categoryIds.includes(subscription.category_id))
        .map((s) => catName.get(s.category_id) ?? "")
        .filter(Boolean),
      courses: [...visibleCourseIds].map((courseId) => {
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
      attempts: (attempts ?? [])
        .filter((attempt) => visibleCourseIds.has(attempt.course_id))
        .map((a) => ({
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
    await assertPermission(context.supabase as never, context.userId, "users");
    if (data.userId === context.userId) throw new Error("cannot_delete_self");
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const permissions = await readPermissions(supabaseAdmin, context.userId);
    const { data: targetRole } = await supabaseAdmin.from("user_roles").select("role").eq("user_id", data.userId).eq("role", "admin").maybeSingle();
    const { data: targetSubscriptions } = await supabaseAdmin
      .from("category_subscriptions")
      .select("category_id")
      .eq("user_id", data.userId);
    if (
      targetRole ||
      (!permissions.fullAccess &&
        (!(targetSubscriptions ?? []).some((row) => permissions.categoryIds.includes(row.category_id)) ||
          (targetSubscriptions ?? []).some((row) => !permissions.categoryIds.includes(row.category_id))))
    ) {
      throw new Error("forbidden");
    }
    await supabaseAdmin.from("category_subscriptions").delete().eq("user_id", data.userId);
    await supabaseAdmin.from("lesson_progress").delete().eq("user_id", data.userId);
    await supabaseAdmin.from("enrollments").delete().eq("user_id", data.userId);
    await supabaseAdmin.from("user_roles").delete().eq("user_id", data.userId);
    await supabaseAdmin.from("profiles").delete().eq("id", data.userId);
    const { error } = await supabaseAdmin.auth.admin.deleteUser(data.userId);
    if (error) throw new Error(error.message);
    return { ok: true };
  });
