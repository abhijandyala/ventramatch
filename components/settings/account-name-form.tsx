"use client";

import { useState, useTransition } from "react";
import { Loader2 } from "lucide-react";
import { updateAccountAction } from "@/lib/account/actions";

export function AccountNameForm({ initialName }: { initialName: string }) {
  const [name, setName] = useState(initialName);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const dirty = name.trim() !== initialName.trim();

  function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSaved(false);
    startTransition(async () => {
      const res = await updateAccountAction({ name: name.trim() });
      if (!res.ok) {
        setError(res.error);
        return;
      }
      setSaved(true);
    });
  }

  return (
    <form onSubmit={submit} className="flex flex-col gap-4">
      <Field label="Display name" hint="Shown on your profile and in matches.">
        <input
          type="text"
          value={name}
          onChange={(e) => {
            setName(e.target.value);
            setSaved(false);
          }}
          maxLength={80}
          className="w-full border bg-[var(--color-bg)] px-3 py-2 text-[14px] text-[var(--color-text)] outline-none transition-colors focus:border-[var(--color-text)]"
          style={{ borderColor: "var(--color-border)" }}
        />
      </Field>

      {error ? (
        <p role="alert" className="border-l-2 border-[var(--color-danger)] pl-3 text-[12.5px] text-[var(--color-danger)]">
          {error}
        </p>
      ) : null}

      <div className="flex items-center gap-3">
        <button
          type="submit"
          disabled={!dirty || isPending}
          className="inline-flex h-9 items-center gap-1.5 px-4 text-[13px] font-medium text-white transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-40"
          style={{ background: "var(--color-text-strong)" }}
        >
          {isPending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : null}
          Save changes
        </button>
        {saved ? (
          <span className="text-[12px] text-[var(--color-brand-strong)]">Saved.</span>
        ) : null}
      </div>
    </form>
  );
}

function Field({
  label,
  hint,
  children,
}: {
  label: string;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <label className="flex flex-col gap-1.5">
      <span className="text-[11px] font-medium uppercase tracking-[0.08em] text-[var(--color-text-faint)]">
        {label}
      </span>
      {children}
      {hint ? <span className="text-[11.5px] text-[var(--color-text-faint)]">{hint}</span> : null}
    </label>
  );
}
