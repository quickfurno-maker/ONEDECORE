import Image from "next/image";
import type { CSSProperties, ReactNode } from "react";
import type { ImageFrameRatio } from "../../tokens";
import { cn } from "../../utils/cn";

export interface ImageFrameProps {
  src: string;
  alt: string;
  width: number;
  height: number;
  ratio?: ImageFrameRatio;
  priority?: boolean;
  sizes?: string;
  objectPosition?: string;
  className?: string;
  children?: ReactNode;
}

const RATIO_CLASS: Record<ImageFrameRatio, string> = {
  hero: "aspect-[16/9]",
  service: "aspect-[4/3]",
  portfolio: "aspect-[3/2]",
  square: "aspect-square",
  material: "aspect-[3/2]",
};

export function ImageFrame({
  src,
  alt,
  width,
  height,
  ratio = "service",
  priority = false,
  sizes = "100vw",
  objectPosition = "center",
  className,
  children,
}: ImageFrameProps) {
  const style = { objectPosition } satisfies CSSProperties;

  return (
    <figure
      className={cn(
        "relative overflow-hidden rounded-[var(--radius-none)] bg-[var(--color-stone)]",
        RATIO_CLASS[ratio],
        className
      )}
    >
      <Image
        src={src}
        alt={alt}
        width={width}
        height={height}
        priority={priority}
        sizes={sizes}
        className="h-full w-full object-cover"
        style={style}
      />
      {children}
    </figure>
  );
}
