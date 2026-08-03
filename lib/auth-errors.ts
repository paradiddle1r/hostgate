export type AuthErrorCopy = "providerNotConfigured" | "generic";

/**
 * Provider configuration errors are safe to explain to the user. Other OAuth
 * failures stay generic so callback query strings never leak provider details.
 */
export function classifyAuthError(message: string): AuthErrorCopy {
  return /(provider.*(?:not enabled|not supported|not found|configured)|unsupported provider|validation failed.*provider)/i.test(
    message
  )
    ? "providerNotConfigured"
    : "generic";
}

/** Returns a same-origin path, rejecting protocol-relative and slash-confusion URLs. */
export function safeNextPath(value: string | null, origin: string): string | null {
  if (!value?.startsWith("/")) return null;

  try {
    const target = new URL(value, origin);
    return target.origin === origin ? `${target.pathname}${target.search}${target.hash}` : null;
  } catch {
    return null;
  }
}
