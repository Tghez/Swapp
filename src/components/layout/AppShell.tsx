"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import type { ReactNode } from "react";
import { useAuth } from "@/components/providers/AuthProvider";
import { signOutUser } from "@/lib/firebase/auth";
import { cn } from "@/lib/cn";

interface AppShellProps {
  children: ReactNode;
  /** Sidebar content — landing page only (PDR §6.1). */
  sidebar?: ReactNode;
  /** Shows a back arrow to the landing page on the two inner screens. */
  showBack?: boolean;
  title?: string;
}

export function AppShell({ children, sidebar, showBack, title }: AppShellProps) {
  const { user } = useAuth();
  const router = useRouter();

  async function handleSignOut() {
    await signOutUser();
    router.replace("/login");
  }

  return (
    <div className="flex min-h-full flex-col">
      <header className="sticky top-0 z-30 border-b border-border bg-bg/95 backdrop-blur">
        <div className="mx-auto flex h-16 w-full max-w-6xl items-center gap-3 px-4">
          {showBack ? (
            <Link
              href="/"
              aria-label="חזרה לדף הבית"
              className="flex size-9 items-center justify-center rounded-pill text-muted transition-colors hover:bg-border/50 hover:text-text"
            >
              {/* RTL: "back" points right */}
              <svg
                viewBox="0 0 20 20"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
                className="size-5"
                aria-hidden="true"
              >
                <path d="M8 4l6 6-6 6" />
              </svg>
            </Link>
          ) : null}

          <Link href="/" className="flex items-center gap-2">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/icons/icon.svg" alt="" aria-hidden="true" className="size-8 rounded-lg" />
            <span className="text-xl font-bold tracking-tight text-text">Swapp</span>
          </Link>

          {title && (
            <span className="hidden text-base text-muted sm:inline">
              · {title}
            </span>
          )}

          <div className="ms-auto flex items-center gap-3">
            {user && (
              <button
                type="button"
                onClick={handleSignOut}
                className="rounded-pill px-3 py-1.5 text-sm font-medium text-muted transition-colors hover:bg-border/50 hover:text-text"
              >
                התנתקות
              </button>
            )}
          </div>
        </div>
      </header>

      <div
        className={cn(
          "mx-auto flex w-full max-w-6xl flex-1 flex-col gap-6 px-4 py-6",
          sidebar && "lg:flex-row-reverse lg:items-start lg:gap-8",
        )}
      >
        <main className="flex-1">{children}</main>
        {sidebar && (
          <aside className="w-full lg:sticky lg:top-24 lg:w-80 lg:shrink-0">
            {sidebar}
          </aside>
        )}
      </div>
    </div>
  );
}
