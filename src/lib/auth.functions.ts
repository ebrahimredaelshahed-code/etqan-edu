import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

const phoneToEmail = (phone: string) => `u${phone.replace(/\D/g, "")}@etqan-academy.app`;

export const registerUser = createServerFn({ method: "POST" })
  .inputValidator((data) =>
    z
      .object({
        fullName: z.string().trim().min(2),
        phone: z.string().trim().min(6),
        guardianPhone: z.string().trim().min(6),
        password: z.string().min(8),
      })
      .parse(data),
  )
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: created, error: authError } = await supabaseAdmin.auth.admin.createUser({
      email: phoneToEmail(data.phone),
      password: data.password,
      email_confirm: true,
      user_metadata: {
        full_name: data.fullName,
        phone: data.phone,
        guardian_phone: data.guardianPhone,
      },
    });

    if (authError || !created.user) {
      throw new Error(authError?.message ?? "create_failed");
    }

    const { error: profileError } = await supabaseAdmin.from("profiles").upsert(
      {
        id: created.user.id,
        full_name: data.fullName,
        phone: data.phone,
        guardian_phone: data.guardianPhone,
      },
      { onConflict: "id" },
    );

    if (profileError) {
      await supabaseAdmin.auth.admin.deleteUser(created.user.id);
      throw new Error(profileError.message);
    }

    return { ok: true };
  });
