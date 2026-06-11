type SpinnerProps = {
  /** Diameter in pixels. Defaults to 16. */
  size?: number;
  className?: string;
};

/**
 * Inline SVG spinner. Inherits `currentColor`, so it tints to whatever text
 * color the parent sets — drop it inside a button, link, or muted block.
 */
export default function Spinner({ size = 16, className }: SpinnerProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      role="status"
      aria-label="Loading"
      className={className}
      style={{ animation: "spin 0.7s linear infinite" }}
    >
      <circle
        cx="12"
        cy="12"
        r="9"
        stroke="currentColor"
        strokeWidth="2.5"
        opacity="0.2"
      />
      <path
        d="M21 12a9 9 0 0 0-9-9"
        stroke="currentColor"
        strokeWidth="2.5"
        strokeLinecap="round"
      />
      <style>{"@keyframes spin{to{transform:rotate(360deg)}}"}</style>
    </svg>
  );
}
