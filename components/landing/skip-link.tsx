/**
 * SkipLink — keyboard accessibility. Hidden until focused; on focus, jumps
 * the user past the nav directly to the main landing content.
 */
export function SkipLink() {
  return (
    <a
      href="#main-content"
      className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-50 focus:rounded-[8px] focus:bg-[color:var(--color-text-strong)] focus:px-4 focus:py-2 focus:text-[14px] focus:font-medium focus:text-white"
    >
      Skip to main content
    </a>
  );
}
