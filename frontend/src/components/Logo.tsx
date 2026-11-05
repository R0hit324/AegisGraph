import type { SVGProps } from "react";

/**
 * AegisGraph mark: a shield outline containing a small asset graph.
 * Pure inline SVG — no external asset requests.
 */
export function Logo({ size = 32, ...rest }: { size?: number } & SVGProps<SVGSVGElement>) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 48 48"
      fill="none"
      role="img"
      aria-label="AegisGraph logo"
      {...rest}
    >
      <path
        d="M24 3 L41 10.5 V24 C41 34.5 33.5 42 24 45 C14.5 42 7 34.5 7 24 V10.5 Z"
        stroke="currentColor"
        strokeWidth="2.6"
        strokeLinejoin="round"
        fill="none"
      />
      {/* Nodes */}
      <circle cx="24" cy="16" r="3.2" fill="currentColor" stroke="none" />
      <circle cx="16" cy="31" r="3.2" fill="none" stroke="currentColor" strokeWidth="2" />
      <circle cx="32" cy="31" r="3.2" fill="none" stroke="currentColor" strokeWidth="2" />
      {/* Edges */}
      <line x1="22.4" y1="19" x2="17.3" y2="27.9" stroke="currentColor" strokeWidth="1.6" />
      <line x1="25.6" y1="19" x2="30.7" y2="27.9" stroke="currentColor" strokeWidth="1.6" />
      <line x1="19.2" y1="31" x2="28.8" y2="31" stroke="currentColor" strokeWidth="1.6" />
    </svg>
  );
}
