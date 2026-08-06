"use client";

import { useEffect, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/components/providers/AuthProvider";
import { ErrorBanner, PageLoader } from "@/components/ui/Feedback";

/**
 * Gate for the three signed-in screens.
 *
 * Firestore rules are the real authorization boundary — this only decides what
 * to render, so a user who bypassed it would see an empty page and permission
 * errors rather than anyone's data.
 */
export function RequireAuth({ children }: { children: ReactNode }) {
  const { user, loading, configError } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!loading && !user && !configError) {
      router.replace("/login");
    }
  }, [loading, user, configError, router]);

  if (configError) {
    return (
      <div className="mx-auto max-w-md p-6">
        <ErrorBanner>{configError}</ErrorBanner>
      </div>
    );
  }

  // Also covers the brief moment after `loading` clears but before the
  // redirect runs, which would otherwise flash an empty signed-out screen.
  if (loading || !user) return <PageLoader />;

  return <>{children}</>;
}
