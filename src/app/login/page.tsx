"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/components/providers/AuthProvider";
import { isUserCancelledAuth, signInWithGoogle } from "@/lib/firebase/auth";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { ErrorBanner, PageLoader, Spinner } from "@/components/ui/Feedback";

export default function LoginPage() {
  const { user, loading, configError } = useAuth();
  const router = useRouter();
  const [signingIn, setSigningIn] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!loading && user) router.replace("/");
  }, [loading, user, router]);

  async function handleSignIn() {
    setError(null);
    setSigningIn(true);
    try {
      await signInWithGoogle();
    } catch (caught) {
      // Closing the Google window is a decision, not a failure — showing an
      // error for it would be noise.
      if (!isUserCancelledAuth(caught)) {
        setError("ההתחברות נכשלה. יש לנסות שוב.");
      }
    } finally {
      setSigningIn(false);
    }
  }

  if (loading || user) return <PageLoader />;

  return (
    <main className="flex min-h-full flex-1 items-center justify-center p-4">
      <Card className="w-full max-w-md text-center">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src="/icons/icon.svg"
          alt=""
          aria-hidden="true"
          className="mx-auto mb-5 size-20 rounded-2xl"
        />
        <h1 className="text-2xl font-bold text-text">Swapp</h1>
        {/* String expression, not raw JSX text — see the note on the landing page. */}
        <p className="mt-2 text-sm leading-relaxed text-muted">
          {"המקום שבו סטאז'רים מוסרים ולוקחים תורנויות. מפרסמים תורנות שצריך " +
            "למסור, או מוצאים אחת לקחת — ומתחברים ישירות בוואטסאפ."}
        </p>

        {configError ? (
          <div className="mt-6">
            <ErrorBanner>{configError}</ErrorBanner>
          </div>
        ) : (
          <>
            <Button
              size="lg"
              onClick={handleSignIn}
              disabled={signingIn}
              className="mt-7 w-full"
            >
              {signingIn ? (
                <Spinner className="size-5 border-primary-fg/30 border-t-primary-fg" />
              ) : (
                <GoogleMark />
              )}
              התחברות עם Google
            </Button>
            {error && (
              <div className="mt-4 text-start">
                <ErrorBanner>{error}</ErrorBanner>
              </div>
            )}
          </>
        )}
      </Card>
    </main>
  );
}

function GoogleMark() {
  return (
    <svg viewBox="0 0 24 24" className="size-5" aria-hidden="true">
      <path
        fill="#4285F4"
        d="M23.5 12.3c0-.9-.1-1.5-.2-2.2H12v4.1h6.6c-.1 1.1-.9 2.8-2.5 3.9l3.8 3c2.3-2.1 3.6-5.2 3.6-8.8z"
      />
      <path
        fill="#34A853"
        d="M12 24c3.2 0 6-1.1 8-2.9l-3.8-3c-1 .7-2.4 1.2-4.2 1.2-3.2 0-5.9-2.1-6.8-5l-3.9 3C3.3 21.3 7.3 24 12 24z"
      />
      <path
        fill="#FBBC05"
        d="M5.2 14.3c-.2-.7-.4-1.5-.4-2.3s.1-1.6.4-2.3l-4-3.1C.4 8.2 0 10 0 12s.4 3.8 1.2 5.4l4-3.1z"
      />
      <path
        fill="#EA4335"
        d="M12 4.8c2.3 0 3.8 1 4.7 1.8l3.4-3.3C18 1.2 15.2 0 12 0 7.3 0 3.3 2.7 1.2 6.6l4 3.1c.9-2.9 3.6-4.9 6.8-4.9z"
      />
    </svg>
  );
}
