import { useTeacherImageUrl } from "@/lib/teacher-image";

/** Renders an image stored either as a plain URL or as a private-storage reference. */
export function StoredImage({
  value,
  alt,
  className,
  width,
  height,
}: {
  value: string | null | undefined;
  alt: string;
  className?: string;
  width?: number;
  height?: number;
}) {
  const url = useTeacherImageUrl(value);
  if (!url) return <div className={`${className ?? ""} bg-secondary`} aria-hidden />;
  return <img src={url} alt={alt} className={className} width={width} height={height} loading="lazy" />;
}
