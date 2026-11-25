/**
 * KaryaDEX — Deep Link Security Validator (Phase 11.6)
 *
 * Prevents open redirects, protocol smuggling, encoded path traversal,
 * and unauthorized destination routing.
 */

export function isSafeInternalRoute(target?: string): boolean {
  if (!target || typeof target !== 'string') return false;

  // Reject excessive length
  if (target.length > 256) return false;

  let decoded = target;
  try {
    decoded = decodeURIComponent(target);
  } catch {
    return false; // Malformed percent-encoding rejected
  }

  // Must begin with a single slash (internal relative path)
  if (!decoded.startsWith('/') || decoded.startsWith('//')) {
    return false;
  }

  // Strictly forbid protocol schemes (e.g. javascript:, file:, data:),
  // path traversal (../), and Windows backslashes
  if (decoded.includes(':') || decoded.includes('..') || decoded.includes('\\')) {
    return false;
  }

  // Allow only standard alphanumeric URL paths, query parameters, and fragments
  if (!/^\/[a-zA-Z0-9_\-\/\(\)\?=&@%#\.]+$/.test(decoded)) {
    return false;
  }

  return true;
}
