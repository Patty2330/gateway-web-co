import Image from "next/image";

export function BrandMark({
  variant = "light",
  size = 46,
  className,
}: {
  variant?: "light" | "dark";
  size?: number;
  className?: string;
}) {
  const src =
    variant === "dark" ? "/images/logo-riverbend-dark.svg" : "/images/logo-riverbend-light.svg";
  return (
    <Image
      src={src}
      alt="Two Forks Studio"
      width={size}
      height={size}
      className={className ?? "brand-mark"}
      unoptimized
      priority={size >= 40}
    />
  );
}

export function BrandLockup({
  variant = "light",
  name = "Two Forks",
  kicker = "Studio · Clarksville",
  href = "/",
}: {
  variant?: "light" | "dark";
  name?: string;
  kicker?: string;
  href?: string;
}) {
  const Tag = href ? "a" : "div";
  return (
    <Tag className="brand" href={href || undefined} aria-label="Two Forks Studio home">
      <BrandMark variant={variant} />
      <span>
        <b>{name}</b>
        <small>{kicker}</small>
      </span>
    </Tag>
  );
}
