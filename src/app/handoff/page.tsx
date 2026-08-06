"use client";

import { RequireAuth } from "@/components/auth/RequireAuth";
import { AppShell } from "@/components/layout/AppShell";
import { HandoffForm } from "@/components/handoff/HandoffForm";

export default function HandoffPage() {
  return (
    <RequireAuth>
      <AppShell showBack title="מסירת תורנות">
        <div className="mx-auto w-full max-w-xl">
          <header className="mb-6">
            <h1 className="text-2xl font-bold text-text">למסור תורנות</h1>
            <p className="mt-1 text-sm text-muted">
              התורנות תופיע בלוח, ומי שירצה לקחת אותה יפנה אליך בוואטסאפ.
            </p>
          </header>
          <HandoffForm />
        </div>
      </AppShell>
    </RequireAuth>
  );
}
