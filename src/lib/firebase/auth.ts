import {
  signInWithPopup,
  signInWithRedirect,
  signOut,
  type UserCredential,
} from "firebase/auth";
import { getFirebaseAuth, getGoogleProvider } from "./client";

/**
 * Google sign-in (PDR §8).
 *
 * Popup rather than redirect, deliberately. The app is hosted on Vercel while
 * Firebase's auth handler lives on <project>.firebaseapp.com, so a redirect
 * round-trip crosses origins — and browsers that partition third-party storage
 * (Safari's ITP, Chrome's third-party cookie changes) drop the state and land
 * the user back signed out. Popup keeps the exchange in one window.
 *
 * If popup ever proves unworkable inside the installed iOS PWA, the fix is a
 * Next rewrite proxying /__/auth/:path* to the Firebase auth domain, which
 * makes the handler same-origin and redirect viable again.
 */
export async function signInWithGoogle(): Promise<UserCredential | null> {
  const auth = getFirebaseAuth();
  try {
    return await signInWithPopup(auth, getGoogleProvider());
  } catch (error) {
    if (isPopupUnavailable(error)) {
      // Some in-app browsers (WhatsApp's own, most notably — the exact place
      // interns will open a shared link from) refuse popups outright. Fall
      // back rather than dead-ending them on the login screen.
      await signInWithRedirect(auth, getGoogleProvider());
      return null;
    }
    throw error;
  }
}

const POPUP_FAILURE_CODES = new Set([
  "auth/popup-blocked",
  "auth/operation-not-supported-in-this-environment",
]);

function isPopupUnavailable(error: unknown): boolean {
  return (
    typeof error === "object" &&
    error !== null &&
    "code" in error &&
    typeof (error as { code: unknown }).code === "string" &&
    POPUP_FAILURE_CODES.has((error as { code: string }).code)
  );
}

/** True when the user simply dismissed the Google window — not a real error. */
export function isUserCancelledAuth(error: unknown): boolean {
  if (typeof error !== "object" || error === null || !("code" in error)) {
    return false;
  }
  const code = (error as { code: unknown }).code;
  return (
    code === "auth/popup-closed-by-user" ||
    code === "auth/cancelled-popup-request" ||
    code === "auth/user-cancelled"
  );
}

export async function signOutUser(): Promise<void> {
  await signOut(getFirebaseAuth());
}
