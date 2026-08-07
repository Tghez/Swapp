"use client";

import { Suspense } from "react";
import { useSearchParams } from "next/navigation";
import { RequireAuth } from "@/components/auth/RequireAuth";
import { AppShell } from "@/components/layout/AppShell";
import { MyShiftsSidebar } from "@/components/sidebar/MyShiftsSidebar";
import { ButtonLink } from "@/components/ui/Button";
import { SuccessBanner } from "@/components/ui/Feedback";
import {
  firstNameOf,
  useDisplayName,
} from "@/components/providers/AuthProvider";

export default function LandingPage() {
  return (
    <RequireAuth>
      <AppShell sidebar={<MyShiftsSidebar />}>
        <Suspense>
          <PostedBanner />
        </Suspense>
        <Greeting />
      </AppShell>
    </RequireAuth>
  );
}

/** Confirms the handoff submission that redirected here. */
function PostedBanner() {
  const params = useSearchParams();
  if (params.get("posted") !== "1") return null;
  return (
    <div className="mb-6">
      <SuccessBanner>
        התורנות פורסמה. היא מופיעה עכשיו בלוח, וגם ברשימה שלך.
      </SuccessBanner>
    </div>
  );
}

function Greeting() {
  const displayName = useDisplayName();
  const firstName = firstNameOf(displayName);

  return (
    <section className="flex flex-col items-center justify-center py-6 text-center lg:py-16">
      <h1 className="text-3xl font-normal text-text sm:text-4xl">
        {firstName ? `היי ${firstName}, מה תרצה לעשות היום?` : "מה תרצה לעשות היום?"}
      </h1>
      {/*
        Held as a string expression rather than raw JSX text: the apostrophe in
        סטאז'רים is an unescaped entity in JSX, which lint rejects. Escaping it
        as &apos; would make the Hebrew unreadable in source.
      */}
      <p className="mt-4 max-w-md text-base leading-relaxed text-muted">
        {"Swapp הוא המקום שבו סטאז'רים באיכילוב מוסרים ולוקחים תורנויות. " +
          "מפרסמים תורנות שצריך למסור, או מוצאים אחת לקחת — והקשר נסגר ישירות בוואטסאפ."}
      </p>

      <div className="mt-10 flex w-full max-w-md flex-col gap-4 sm:flex-row sm:justify-center">
        <ButtonLink href="/handoff" size="lg" className="flex-1">
          למסור תורנות
        </ButtonLink>
        <ButtonLink
          href="/board"
          size="lg"
          variant="secondaryFilled"
          className="flex-1"
        >
          לקחת תורנות
        </ButtonLink>
      </div>
    </section>
  );
}
