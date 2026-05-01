"use client";

import { useState, useTransition } from "react";
import { Loader2, Linkedin, Check, X } from "lucide-react";
import type { LinkedInConnectionStatus, ApplyLinkedInResult } from "@/app/build/connect-actions";

type LinkedInFillModalProps = {
  status: LinkedInConnectionStatus;
  onApply: (selectedFields: {
    name: boolean;
    picture: boolean;
    email: boolean;
  }) => Promise<ApplyLinkedInResult>;
  onClose: () => void;
  currentValues: {
    name: string;
    picture: string;
    email: string;
  };
};

type FieldKey = "name" | "picture" | "email";

export function LinkedInFillModal({
  status,
  onApply,
  onClose,
  currentValues,
}: LinkedInFillModalProps) {
  const [isPending, startTransition] = useTransition();
  const [selected, setSelected] = useState<Record<FieldKey, boolean>>({
    name: true,
    picture: true,
    email: false,
  });
  const [error, setError] = useState<string | null>(null);

  if (!status.connected || !status.profile) {
    return null;
  }

  const profile = status.profile;

  const fields: {
    key: FieldKey;
    label: string;
    linkedInValue: string | null;
    currentValue: string;
  }[] = [
    {
      key: "name",
      label: "Full Name",
      linkedInValue: profile.name,
      currentValue: currentValues.name,
    },
    {
      key: "picture",
      label: "Profile Picture",
      linkedInValue: profile.picture,
      currentValue: currentValues.picture,
    },
    {
      key: "email",
      label: "Email",
      linkedInValue: profile.email,
      currentValue: currentValues.email,
    },
  ];

  const availableFields = fields.filter((f) => f.linkedInValue);
  const selectedCount = availableFields.filter((f) => selected[f.key]).length;

  function toggleField(key: FieldKey) {
    setSelected((s) => ({ ...s, [key]: !s[key] }));
  }

  function handleApply() {
    setError(null);
    startTransition(async () => {
      const result = await onApply(selected);
      if (!result.ok) {
        setError(result.error ?? "Failed to apply LinkedIn data");
        return;
      }
      onClose();
    });
  }

  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-black/50 p-4 backdrop-blur-[2px]">
      <div
        className="flex w-full max-w-[480px] flex-col gap-5 border bg-[var(--color-bg)] p-6"
        style={{ borderColor: "var(--color-border)" }}
      >
        <header>
          <div className="flex items-center gap-2">
            <Linkedin
              className="h-5 w-5 text-[#0A66C2]"
              strokeWidth={0}
              fill="#0A66C2"
            />
            <p className="font-mono text-[10.5px] uppercase tracking-[0.16em] text-[var(--color-text-faint)]">
              LinkedIn Import
            </p>
          </div>
          <h2 className="mt-2 font-serif text-[20px] font-semibold tracking-tight text-[var(--color-text-strong)]">
            Fill profile from LinkedIn
          </h2>
          <p className="mt-2 text-[13.5px] leading-[1.6] text-[var(--color-text-muted)]">
            Select which fields to import. Existing data will be replaced.
          </p>
        </header>

        <ul className="flex flex-col gap-2">
          {availableFields.map((field) => {
            const willReplace =
              field.currentValue && field.linkedInValue !== field.currentValue;

            return (
              <li key={field.key}>
                <button
                  type="button"
                  onClick={() => toggleField(field.key)}
                  className={[
                    "flex w-full items-start justify-between gap-3 border px-4 py-3 text-left transition-colors",
                    selected[field.key]
                      ? "border-[var(--color-brand)] bg-[var(--color-brand-tint)]"
                      : "border-[var(--color-border)] bg-[var(--color-surface)] hover:border-[var(--color-text-faint)]",
                  ].join(" ")}
                >
                  <div className="flex-1 min-w-0">
                    <span className="text-[13.5px] font-medium text-[var(--color-text-strong)]">
                      {field.label}
                    </span>
                    {field.key === "picture" && field.linkedInValue ? (
                      <div className="mt-1.5 flex items-center gap-2">
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img
                          src={field.linkedInValue}
                          alt="LinkedIn profile"
                          className="h-8 w-8 rounded-full object-cover"
                        />
                        <span className="text-[12px] text-[var(--color-text-muted)]">
                          From LinkedIn
                        </span>
                      </div>
                    ) : (
                      <p className="mt-0.5 truncate text-[12px] text-[var(--color-text-muted)]">
                        {field.linkedInValue}
                      </p>
                    )}
                    {willReplace && selected[field.key] && (
                      <p className="mt-1 text-[11px] text-[var(--color-warning)]">
                        Replaces: {field.currentValue}
                      </p>
                    )}
                  </div>
                  <div
                    className={[
                      "mt-0.5 flex h-5 w-5 flex-shrink-0 items-center justify-center border transition-colors",
                      selected[field.key]
                        ? "border-[var(--color-brand)] bg-[var(--color-brand)] text-white"
                        : "border-[var(--color-border)] bg-white",
                    ].join(" ")}
                  >
                    {selected[field.key] && (
                      <Check className="h-3 w-3" strokeWidth={2.5} />
                    )}
                  </div>
                </button>
              </li>
            );
          })}
        </ul>

        {availableFields.length === 0 && (
          <p className="text-center text-[13px] text-[var(--color-text-muted)]">
            No additional data available from LinkedIn. Your current profile
            data is up to date.
          </p>
        )}

        {error && (
          <p className="text-[12px] text-[var(--color-danger)]">{error}</p>
        )}

        <div className="flex items-center justify-end gap-3">
          <button
            type="button"
            onClick={onClose}
            disabled={isPending}
            className="inline-flex h-10 items-center justify-center px-4 text-[13px] font-medium text-[var(--color-text-muted)] transition-colors hover:text-[var(--color-text)] disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleApply}
            disabled={isPending || selectedCount === 0}
            className="inline-flex h-10 items-center justify-center gap-1.5 bg-[var(--color-text)] px-5 text-[13px] font-semibold text-white transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {isPending ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
            ) : (
              <Linkedin className="h-3.5 w-3.5" strokeWidth={0} fill="white" />
            )}
            Fill with LinkedIn
          </button>
        </div>

        <p className="text-[11px] leading-[1.55] text-[var(--color-text-faint)]">
          Data is imported from your connected LinkedIn account. Only fields
          you select will be updated.
        </p>
      </div>
    </div>
  );
}
