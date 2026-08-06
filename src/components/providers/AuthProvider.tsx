"use client";

import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { getRedirectResult, onAuthStateChanged, type User } from "firebase/auth";
import { getFirebaseAuth, isFirebaseConfigured } from "@/lib/firebase/client";
import { subscribeToProfile } from "@/lib/data/users";
import type { UserProfile } from "@/lib/domain/types";

interface AuthState {
  user: User | null;
  profile: UserProfile | null;
  /** True until the first auth callback fires — routes must not redirect before then. */
  loading: boolean;
  /** True once the profile subscription has produced a value (or there is no user). */
  profileLoaded: boolean;
  configError: string | null;
}

const AuthContext = createContext<AuthState | null>(null);

const CONFIG_ERROR =
  "Firebase אינו מוגדר. יש למלא את קובץ .env.local לפי .env.local.example";

/** Tags a profile with the uid it belongs to, so staleness is detectable. */
interface ProfileEntry {
  uid: string;
  profile: UserProfile | null;
}

export function AuthProvider({ children }: { children: ReactNode }) {
  // Derived at render rather than in an effect: the env vars are inlined at
  // build time, so this is a constant and identical on server and client.
  const configured = isFirebaseConfigured();
  const configError = configured ? null : CONFIG_ERROR;

  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(configured);
  const [profileEntry, setProfileEntry] = useState<ProfileEntry | null>(null);

  useEffect(() => {
    if (!configured) return;

    const auth = getFirebaseAuth();

    // Only resolves to a credential when the popup fallback took the redirect
    // path; harmless otherwise, but it must be awaited or the redirect result
    // is dropped on the reload that follows sign-in.
    void getRedirectResult(auth).catch(() => undefined);

    return onAuthStateChanged(auth, (nextUser) => {
      setUser(nextUser);
      setLoading(false);
    });
  }, [configured]);

  const uid = user?.uid ?? null;

  useEffect(() => {
    if (!uid) return;
    return subscribeToProfile(
      uid,
      (next) => setProfileEntry({ uid, profile: next }),
      // A read failure still counts as "loaded" — otherwise the handoff form
      // waits forever for autofill that is never coming.
      () => setProfileEntry({ uid, profile: null }),
    );
  }, [uid]);

  // Both derived, so a signed-out user needs no state reset and switching
  // accounts cannot briefly show the previous intern's details.
  const fresh = profileEntry?.uid === uid ? profileEntry : null;
  const profile = fresh?.profile ?? null;
  const profileLoaded = uid === null || fresh !== null;

  const value = useMemo<AuthState>(
    () => ({ user, profile, loading, profileLoaded, configError }),
    [user, profile, loading, profileLoaded, configError],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthState {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth must be used inside <AuthProvider>");
  }
  return context;
}

/**
 * Best available display name: the profile the intern filled in themselves
 * wins over whatever Google has on file, since the profile is what appears on
 * their posted shifts.
 */
export function useDisplayName(): string {
  const { user, profile } = useAuth();
  return profile?.displayName?.trim() || user?.displayName?.trim() || "";
}

export function firstNameOf(fullName: string): string {
  return fullName.trim().split(/\s+/)[0] ?? "";
}
