import { getApp, getApps, initializeApp, type FirebaseApp } from "firebase/app";
import {
  connectAuthEmulator,
  getAuth,
  GoogleAuthProvider,
  type Auth,
} from "firebase/auth";
import {
  connectFirestoreEmulator,
  getFirestore,
  type Firestore,
} from "firebase/firestore";

/**
 * Firebase is initialised lazily rather than at module scope.
 *
 * `next build` prerenders pages, which would execute a top-level
 * `initializeApp()` — so eager init makes the build fail on any machine or CI
 * runner without the env vars present. Deferring to first use means the
 * credentials are only ever needed at runtime, in the browser.
 */

const REQUIRED_ENV_KEYS = [
  "NEXT_PUBLIC_FIREBASE_API_KEY",
  "NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN",
  "NEXT_PUBLIC_FIREBASE_PROJECT_ID",
  "NEXT_PUBLIC_FIREBASE_APP_ID",
] as const;

/**
 * Read explicitly rather than via a loop over `process.env[key]` — Next inlines
 * NEXT_PUBLIC_* vars by static analysis of literal member access, so dynamic
 * lookups come back undefined in the browser bundle.
 */
const firebaseConfig = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
  storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
} as const;

const ENV_VALUES: Record<(typeof REQUIRED_ENV_KEYS)[number], string | undefined> =
  {
    NEXT_PUBLIC_FIREBASE_API_KEY: firebaseConfig.apiKey,
    NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN: firebaseConfig.authDomain,
    NEXT_PUBLIC_FIREBASE_PROJECT_ID: firebaseConfig.projectId,
    NEXT_PUBLIC_FIREBASE_APP_ID: firebaseConfig.appId,
  };

export function isFirebaseConfigured(): boolean {
  return REQUIRED_ENV_KEYS.every((key) => Boolean(ENV_VALUES[key]));
}

export function getMissingFirebaseEnvKeys(): string[] {
  return REQUIRED_ENV_KEYS.filter((key) => !ENV_VALUES[key]);
}

let cachedApp: FirebaseApp | null = null;
let emulatorsConnected = false;

function getFirebaseApp(): FirebaseApp {
  if (cachedApp) return cachedApp;

  const missing = getMissingFirebaseEnvKeys();
  if (missing.length > 0) {
    throw new Error(
      `Firebase is not configured. Missing: ${missing.join(", ")}. ` +
        "Copy .env.local.example to .env.local and fill in the values from " +
        "the Firebase console (Project settings → Your apps → Web app).",
    );
  }

  cachedApp = getApps().length ? getApp() : initializeApp(firebaseConfig);
  return cachedApp;
}

const useEmulators = process.env.NEXT_PUBLIC_USE_FIREBASE_EMULATOR === "1";

export function getFirebaseAuth(): Auth {
  const auth = getAuth(getFirebaseApp());
  connectEmulatorsOnce(auth, getFirestore(getFirebaseApp()));
  return auth;
}

export function getDb(): Firestore {
  const db = getFirestore(getFirebaseApp());
  connectEmulatorsOnce(getAuth(getFirebaseApp()), db);
  return db;
}

function connectEmulatorsOnce(auth: Auth, db: Firestore): void {
  if (!useEmulators || emulatorsConnected || typeof window === "undefined") {
    return;
  }
  emulatorsConnected = true;
  connectAuthEmulator(auth, "http://127.0.0.1:9099", { disableWarnings: true });
  connectFirestoreEmulator(db, "127.0.0.1", 8080);
}

export function getGoogleProvider(): GoogleAuthProvider {
  const provider = new GoogleAuthProvider();
  // Always let the intern pick an account — many have a personal and a
  // hospital Google account and silently reusing the last one is confusing.
  provider.setCustomParameters({ prompt: "select_account" });
  return provider;
}
