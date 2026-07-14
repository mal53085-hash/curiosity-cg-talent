import Image from "next/image";
import { cn } from "@/lib/utils";

interface CandidateAvatarProps {
  name: string;
  imageUrl?: string | null;
  className?: string;
  priority?: boolean;
}

export function CandidateAvatar({
  name,
  imageUrl,
  className,
  priority = false,
}: CandidateAvatarProps) {
  const initials = name
    .split(/\s+/)
    .map((part) => part[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();

  return (
    <div
      className={cn(
        "relative grid shrink-0 place-items-center overflow-hidden rounded-xl bg-[#e8e6de] text-sm font-medium text-[#66655f]",
        className,
      )}
    >
      {imageUrl ? (
        <Image
          src={imageUrl}
          alt={`${name}の候補者画像`}
          fill
          sizes="(max-width: 768px) 96px, 320px"
          className="object-cover"
          priority={priority}
          unoptimized
        />
      ) : (
        <span aria-hidden="true">{initials || "—"}</span>
      )}
    </div>
  );
}
