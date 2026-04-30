/**
 * Current legal document versions. When either constant changes,
 * the LegalVersionBumpModal component forces re-acceptance on the
 * next page load for any user whose stored version doesn't match.
 *
 * Bump these atomically with the content update in app/legal/tos/page.tsx
 * or app/legal/privacy/page.tsx. Always increment, never decrement.
 */
export const LEGAL_TOS_VERSION = "1.0";
export const LEGAL_PRIVACY_VERSION = "1.0";
