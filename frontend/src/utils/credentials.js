// Credential Management API helper.
//
// Goal: only offer to save the login to the browser's password manager AFTER a CONFIRMED
// successful sign-in — never on a failed attempt. We call this from the success path only.
// Using navigator.credentials.store() is the standards-based way for an app (especially an
// SPA that authenticates via fetch/XHR) to control *when* the save prompt is shown; Chromium
// defers its automatic heuristic to this explicit call.
//
// Safe no-op when unsupported: Firefox/Safari lack `PasswordCredential`, and the API only
// works in a secure context (https or localhost). Any failure is swallowed.
export async function offerToSaveLogin(email, password) {
  try {
    if (typeof window === 'undefined' || !window.PasswordCredential) return;
    if (!navigator.credentials || typeof navigator.credentials.store !== 'function') return;
    if (!email || !password) return;
    const credential = new window.PasswordCredential({ id: email, password, name: email });
    await navigator.credentials.store(credential);
  } catch {
    // unsupported browser, insecure context, or user dismissed — ignore
  }
}
