import { User } from "lucide-react";
import { useTeacherImageUrl } from "@/lib/teacher-image";

export function TeacherPhoto({
  value,
  alt,
  className,
  iconClassName = "size-16",
}: {
  value: string | null | undefined;
  alt: string;
  className?: string;
  iconClassName?: string;
}) {
  const url = useTeacherImageUrl(value);

  if (!url) {
    return (
      <span className="flex size-full items-center justify-center text-ink-foreground/40">
        <User className={iconClassName} />
      </span>
    );
  }

  return <img src={url} alt={alt} loading="lazy" className={className} />;
}
