import { supabase } from "@/integrations/supabase/client";

export const LESSON_VIDEO_BUCKET = "lesson-videos";
const STORAGE_PREFIX = "storage:";

export const toStorageRef = (path: string) => `${STORAGE_PREFIX}${path}`;

export const isStorageRef = (url: string) => url.startsWith(STORAGE_PREFIX);

export const storagePathOf = (url: string) =>
  isStorageRef(url) ? url.slice(STORAGE_PREFIX.length) : null;

/** Extracts the YouTube video id from any common YouTube URL form. */
export function youtubeIdOf(url: string | null | undefined): string | null {
  if (!url) return null;
  const value = url.trim();
  if (/^[\w-]{11}$/.test(value)) return value;
  const match = value.match(
    /(?:youtube\.com\/(?:watch\?(?:.*&)?v=|embed\/|shorts\/|live\/|v\/)|youtu\.be\/)([\w-]{11})/,
  );
  return match ? match[1] : null;
}

export const isYoutube = (url: string | null | undefined) => Boolean(youtubeIdOf(url));

export const youtubeEmbedUrl = (id: string) =>
  `https://www.youtube-nocookie.com/embed/${id}?rel=0&modestbranding=1&controls=1&playsinline=1&iv_load_policy=3&fs=1&enablejsapi=1`;



/** Returns a playable URL: signed URL for uploaded files, or the raw external URL. */
export async function resolveLessonVideoUrl(videoUrl: string | null | undefined) {
  if (!videoUrl) return null;
  const path = storagePathOf(videoUrl);
  if (!path) return videoUrl;
  const { data, error } = await supabase.storage
    .from(LESSON_VIDEO_BUCKET)
    .createSignedUrl(path, 60 * 60 * 4);
  if (error) return null;
  return data?.signedUrl ?? null;
}

export async function uploadLessonVideo(courseId: string, file: File) {
  const ext = file.name.split(".").pop()?.toLowerCase() || "mp4";
  const path = `${courseId}/${crypto.randomUUID()}.${ext}`;
  const { error } = await supabase.storage
    .from(LESSON_VIDEO_BUCKET)
    .upload(path, file, { cacheControl: "3600", upsert: false, contentType: file.type });
  if (error) throw error;
  return toStorageRef(path);
}

export async function removeLessonVideo(videoUrl: string | null | undefined) {
  const path = videoUrl ? storagePathOf(videoUrl) : null;
  if (!path) return;
  await supabase.storage.from(LESSON_VIDEO_BUCKET).remove([path]);
}
