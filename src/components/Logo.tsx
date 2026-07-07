/* eslint-disable @next/next/no-img-element */

// Andeverywhere logo (real artwork in /public).
// - light backgrounds (navbar): navy-text variant
// - dark backgrounds (footer): white-text variant (pass onDark)
export default function Logo({
  onDark = false,
  className = "h-9 w-auto",
}: {
  onDark?: boolean;
  className?: string;
}) {
  return (
    <img
      src={onDark ? "/andeverywhere-logo.png" : "/andeverywhere-logo-dark.png"}
      alt="Andeverywhere"
      className={className}
    />
  );
}
