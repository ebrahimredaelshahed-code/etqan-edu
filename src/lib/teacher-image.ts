import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

export const TEACHER_IMAGE_BUCKET = "teacher-images";
const STORAGE_PREFIX = "storage:";

const storagePathOf = (value: string) =>
  value.startsWith(STORAGE_PREFIX) ? value.slice(STORAGE_PREFIX.length) : null;

/** Uploads a teacher photo and returns the reference stored in the database. */
export async function uploadTeacherImage(file: File) {
  const ext = file.name.split(".").pop()?.toLowerCase() || "jpg";
  const path = `${crypto.randomUUID()}.${ext}`;
  const { error } = await supabase.storage
    .from(TEACHER_IMAGE_BUCKET)
    .upload(path, file, { cacheControl: "3600", upsert: false, contentType: file.type });
  if (error) throw error;
  return `${STORAGE_PREFIX}${path}`;
}

/** Resolves a stored reference (or plain URL) into a displayable image URL. */
export async function resolveTeacherImageUrl(value: string | null | undefined) {
  if (!value) return null;
  const path = storagePathOf(value);
  if (!path) return value;
  const { data } = await supabase.storage
    .from(TEACHER_IMAGE_BUCKET)
    .createSignedUrl(path, 60 * 60 * 24);
  return data?.signedUrl ?? null;
}

/** React helper for rendering a teacher photo from a stored reference. */
export function useTeacherImageUrl(value: string | null | undefined) {
  const [url, setUrl] = useState<string | null>(
    value && !value.startsWith(STORAGE_PREFIX) ? value : null,
  );

  useEffect(() => {
    let active = true;
    resolveTeacherImageUrl(value).then((resolved) => {
      if (active) setUrl(resolved);
    });
    return () => {
      active = false;
    };
  }, [value]);

  return url;
}
