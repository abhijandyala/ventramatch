"use client";

/**
 * Verification & references panel on /build and /build/investor.
 *
 * Two collapsible sections:
 *   1. Claims — submit self-attested verification claims (pending status
 *      until a future verifier worker confirms them). Existing claims shown
 *      with current status badge.
 *   2. References — request a magic-link reference from a colleague.
 *      Lists all own reference requests (sent / confirmed / declined /
 *      expired) with cancel option for pending ones.
 *
 * Follows the same SectionShell + SaveBar patterns as
 * components/profile/founder-depth-editor.tsx.
 */

import { useState, useTransition } from "react";
import {
  submitVerificationAction,
  requestReferenceAction,
  cancelReferenceAction,
} from "@/app/build/verification-actions";
import type { VerificationKind, VerificationStatus, ReferenceStatus } from "@/types/database";
import type {
  SubmitVerificationInput,
  RequestReferenceInput,
} from "@/lib/validation/depth";

// ──────────────────────────────────────────────────────────────────────────
//  Prop shapes (plain serialisable so they cross the server/client boundary)
// ──────────────────────────────────────────────────────────────────────────

export type OwnVerification = {
  id: string;
  kind: VerificationKind;
  status: VerificationStatus;
  claim_summary: string | null;
  evidence_url: string | null;
  created_at: string;
};

export type OwnReference = {
  id: string;
  referee_name: string;
  referee_email: string;
  relationship: string;
  status: ReferenceStatus;
  endorsement: string | null;
  expires_at: string;
  created_at: string;
};

// ──────────────────────────────────────────────────────────────────────────
//  Shared layout primitives (mirror depth-editor style exactly)
// ──────────────────────────────────────────────────────────────────────────

function SectionShell({
  title,
  hint,
  children,
}: {
  title: string;
  hint: string;
  children: React.ReactNode;
}) {
  const [open, setOpen] = useState(false);
  return (
    <div className="border border-[var(--color-border)]">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="flex w-full items-center justify-between gap-3 px-5 py-4 text-left"
      >
        <div>
          <p className="text-[13.5px] font-semibold tracking-tight text-[var(--color-text-strong)]">
            {title}
          </p>
          <p className="mt-0.5 text-[11.5px] text-[var(--color-text-muted)]">{hint}</p>
        </div>
        <span
          className="shrink-0 text-[var(--color-text-faint)] transition-transform"
          style={{ transform: open ? "rotate(180deg)" : "rotate(0deg)" }}
          aria-hidden
        >
          ▾
        </span>
      </button>
      {open ? (
        <div className="border-t border-[var(--color-border)] px-5 pb-6 pt-4">{children}</div>
      ) : null}
    </div>
  );
}

function ActionBar({
  saving,
  result,
  onAction,
  label = "Submit",
}: {
  saving: boolean;
  result: { ok: boolean; message: string } | null;
  onAction: () => void;
  label?: string;
}) {
  return (
    <div className="mt-4 flex items-center gap-3">
      <button
        type="button"
        disabled={saving}
        onClick={onAction}
        className="h-9 px-4 text-[13px] font-medium text-white disabled:opacity-50"
        style={{ background: "var(--color-brand)" }}
      >
        {saving ? "Saving…" : label}
      </button>
      {result ? (
        <p
          className={`text-[12.5px] ${result.ok ? "text-[var(--color-text-muted)]" : "text-red-600"}`}
        >
          {result.message}
        </p>
      ) : null}
    </div>
  );
}

function FieldRow({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="grid grid-cols-1 gap-1 sm:grid-cols-[160px_1fr]">
      <label className="pt-2 text-[12px] font-medium uppercase tracking-[0.1em] text-[var(--color-text-faint)]">
        {label}
      </label>
      <div>{children}</div>
    </div>
  );
}

function TextInput({
  value,
  onChange,
  placeholder,
  type = "text",
}: {
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  type?: "text" | "url" | "email";
}) {
  return (
    <input
      type={type}
      value={value}
      placeholder={placeholder}
      onChange={(e) => onChange(e.target.value)}
      className="h-9 w-full rounded-[8px] border border-[var(--color-border)] bg-[var(--color-surface)] px-3 text-[13.5px] text-[var(--color-text-strong)] placeholder:text-[var(--color-text-faint)] focus:outline-none focus:ring-1 focus:ring-[var(--color-text-strong)]"
    />
  );
}

function TextareaInput({
  value,
  onChange,
  placeholder,
}: {
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
}) {
  return (
    <textarea
      value={value}
      placeholder={placeholder}
      rows={3}
      onChange={(e) => onChange(e.target.value)}
      className="w-full resize-none rounded-[8px] border border-[var(--color-border)] bg-[var(--color-surface)] px-3 py-2.5 text-[13.5px] leading-relaxed text-[var(--color-text-strong)] placeholder:text-[var(--color-text-faint)] focus:outline-none focus:ring-1 focus:ring-[var(--color-text-strong)]"
    />
  );
}

function Select<T extends string>({
  value,
  onChange,
  options,
  placeholder,
}: {
  value: T | "";
  onChange: (v: T) => void;
  options: { value: T; label: string }[];
  placeholder?: string;
}) {
  return (
    <select
      value={value}
      onChange={(e) => onChange(e.target.value as T)}
      className="h-9 w-full rounded-[8px] border border-[var(--color-border)] bg-[var(--color-surface)] px-3 text-[13.5px] text-[var(--color-text-strong)] focus:outline-none focus:ring-1 focus:ring-[var(--color-text-strong)]"
    >
      {placeholder ? (
        <option value="" disabled>
          {placeholder}
        </option>
      ) : null}
      {options.map((o) => (
        <option key={o.value} value={o.value}>
          {o.label}
        </option>
      ))}
    </select>
  );
}

// ──────────────────────────────────────────────────────────────────────────
//  Status badges
// ──────────────────────────────────────────────────────────────────────────

const VERIF_STATUS_LABEL: Record<VerificationStatus, string> = {
  pending: "Pending review",
  confirmed: "Confirmed",
  rejected: "Rejected",
  expired: "Expired",
};

const VERIF_STATUS_COLOR: Record<VerificationStatus, string> = {
  pending: "text-amber-700 bg-amber-50 border-amber-200",
  confirmed: "text-green-700 bg-green-50 border-green-200",
  rejected: "text-red-700 bg-red-50 border-red-200",
  expired: "text-[var(--color-text-faint)] bg-[var(--color-surface)] border-[var(--color-border)]",
};

const REF_STATUS_LABEL: Record<ReferenceStatus, string> = {
  sent: "Awaiting response",
  confirmed: "Confirmed",
  declined: "Declined",
  expired: "Expired",
};

const REF_STATUS_COLOR: Record<ReferenceStatus, string> = {
  sent: "text-sky-700 bg-sky-50 border-sky-200",
  confirmed: "text-green-700 bg-green-50 border-green-200",
  declined: "text-red-700 bg-red-50 border-red-200",
  expired: "text-[var(--color-text-faint)] bg-[var(--color-surface)] border-[var(--color-border)]",
};

function StatusBadge({
  label,
  colorClass,
}: {
  label: string;
  colorClass: string;
}) {
  return (
    <span
      className={`inline-flex items-center rounded-full border px-2 py-0.5 text-[11px] font-medium ${colorClass}`}
    >
      {label}
    </span>
  );
}

// ──────────────────────────────────────────────────────────────────────────
//  Verification kind options
// ──────────────────────────────────────────────────────────────────────────

const KIND_OPTIONS: { value: VerificationKind; label: string; note: string }[] = [
  { value: "linkedin_employment", label: "LinkedIn employment", note: "Verify your current role via LinkedIn" },
  { value: "github_account",      label: "GitHub account",      note: "Prove ownership of your GitHub handle" },
  { value: "domain_ownership",    label: "Domain ownership",    note: "Confirm you control your company domain" },
  { value: "sec_form_d",          label: "SEC Form D",          note: "Public filing on SEC EDGAR" },
  { value: "crunchbase_listing",  label: "Crunchbase listing",  note: "Company profile URL on Crunchbase" },
  { value: "self_attestation",    label: "Self attestation",    note: "Statement to be reviewed manually" },
];

const KIND_LABEL: Record<VerificationKind, string> = Object.fromEntries(
  KIND_OPTIONS.map((o) => [o.value, o.label]),
) as Record<VerificationKind, string>;

// ──────────────────────────────────────────────────────────────────────────
//  Claims section
// ──────────────────────────────────────────────────────────────────────────

function ClaimsSection({ initial }: { initial: OwnVerification[] }) {
  const [verifications, setVerifications] = useState<OwnVerification[]>(initial);
  const [form, setForm] = useState<SubmitVerificationInput>({
    kind: "linkedin_employment",
    evidence_url: "",
    claim_summary: "",
  });
  const [saving, startSaving] = useTransition();
  const [result, setResult] = useState<{ ok: boolean; message: string } | null>(null);

  function handleSubmit() {
    setResult(null);
    startSaving(async () => {
      const res = await submitVerificationAction(form);
      if (res.ok) {
        setResult({ ok: true, message: "Claim submitted. We'll review it shortly." });
        // Optimistically prepend so the user sees it immediately.
        const kind = form.kind as VerificationKind;
        setVerifications((prev) => [
          {
            id: `optimistic-${Date.now()}`,
            kind,
            status: "pending",
            claim_summary: form.claim_summary ?? null,
            evidence_url: form.evidence_url ?? null,
            created_at: new Date().toISOString(),
          },
          ...prev,
        ]);
        setForm({ kind: "linkedin_employment", evidence_url: "", claim_summary: "" });
      } else {
        setResult({ ok: false, message: res.error });
      }
    });
  }

  return (
    <div className="space-y-6">
      <p className="text-[12.5px] leading-relaxed text-[var(--color-text-muted)]">
        Verification claims are self-attested and will be reviewed before badges appear on your
        profile. Include an evidence URL where possible — it speeds up review.
      </p>

      {/* Existing claims */}
      {verifications.length > 0 ? (
        <div className="space-y-2">
          {verifications.map((v) => (
            <div
              key={v.id}
              className="flex items-center justify-between gap-3 rounded-[8px] border border-[var(--color-border)] px-4 py-3"
            >
              <div className="min-w-0">
                <p className="truncate text-[13px] font-medium text-[var(--color-text-strong)]">
                  {KIND_LABEL[v.kind] ?? v.kind}
                </p>
                {v.claim_summary ? (
                  <p className="mt-0.5 truncate text-[12px] text-[var(--color-text-muted)]">
                    {v.claim_summary}
                  </p>
                ) : null}
              </div>
              <StatusBadge
                label={VERIF_STATUS_LABEL[v.status]}
                colorClass={VERIF_STATUS_COLOR[v.status]}
              />
            </div>
          ))}
        </div>
      ) : null}

      {/* New claim form */}
      <div className="space-y-4">
        <p className="text-[12px] font-medium uppercase tracking-[0.1em] text-[var(--color-text-faint)]">
          Submit a new claim
        </p>
        <FieldRow label="Claim type">
          <Select
            value={form.kind ?? ""}
            onChange={(v) => setForm((f) => ({ ...f, kind: v }))}
            options={KIND_OPTIONS.map((o) => ({ value: o.value, label: o.label }))}
          />
        </FieldRow>
        <FieldRow label="Evidence URL">
          <TextInput
            type="url"
            placeholder="https://linkedin.com/in/you or SEC EDGAR link"
            value={form.evidence_url ?? ""}
            onChange={(v) => setForm((f) => ({ ...f, evidence_url: v || undefined }))}
          />
        </FieldRow>
        <FieldRow label="Summary">
          <TextareaInput
            placeholder="Brief description of what you're verifying (max 200 chars)"
            value={form.claim_summary ?? ""}
            onChange={(v) => setForm((f) => ({ ...f, claim_summary: v || undefined }))}
          />
        </FieldRow>
      </div>

      <ActionBar
        saving={saving}
        result={result}
        onAction={handleSubmit}
        label="Submit claim"
      />
    </div>
  );
}

// ──────────────────────────────────────────────────────────────────────────
//  References section
// ──────────────────────────────────────────────────────────────────────────

function ReferencesSection({ initial }: { initial: OwnReference[] }) {
  const [refs, setRefs] = useState<OwnReference[]>(initial);
  const [form, setForm] = useState<RequestReferenceInput>({
    referee_email: "",
    referee_name: "",
    relationship: "",
  });
  const [saving, startSaving] = useTransition();
  const [cancelling, startCancelling] = useTransition();
  const [result, setResult] = useState<{ ok: boolean; message: string } | null>(null);
  const [cancellingId, setCancellingId] = useState<string | null>(null);

  function handleRequest() {
    setResult(null);
    startSaving(async () => {
      const res = await requestReferenceAction(form);
      if (res.ok) {
        setResult({ ok: true, message: `Reference request sent to ${form.referee_email}.` });
        setRefs((prev) => [
          {
            id: `optimistic-${Date.now()}`,
            referee_name: form.referee_name,
            referee_email: form.referee_email.toLowerCase(),
            relationship: form.relationship,
            status: "sent",
            endorsement: null,
            expires_at: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000).toISOString(),
            created_at: new Date().toISOString(),
          },
          ...prev,
        ]);
        setForm({ referee_email: "", referee_name: "", relationship: "" });
      } else {
        setResult({ ok: false, message: res.error });
      }
    });
  }

  function handleCancel(refId: string) {
    setCancellingId(refId);
    startCancelling(async () => {
      const res = await cancelReferenceAction(refId);
      if (res.ok) {
        setRefs((prev) =>
          prev.map((r) => (r.id === refId ? { ...r, status: "expired" as const } : r)),
        );
      }
      setCancellingId(null);
    });
  }

  return (
    <div className="space-y-6">
      <p className="text-[12.5px] leading-relaxed text-[var(--color-text-muted)]">
        References are magic-link requests sent to a colleague by email. When they confirm, the
        reference appears as a badge on your profile. One active request per email address.
      </p>

      {/* Existing references */}
      {refs.length > 0 ? (
        <div className="space-y-2">
          {refs.map((r) => (
            <div
              key={r.id}
              className="rounded-[8px] border border-[var(--color-border)] px-4 py-3"
            >
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="text-[13px] font-medium text-[var(--color-text-strong)]">
                    {r.referee_name}
                  </p>
                  <p className="text-[12px] text-[var(--color-text-muted)]">
                    {r.referee_email} · {r.relationship}
                  </p>
                  {r.endorsement ? (
                    <p className="mt-1 text-[12.5px] italic text-[var(--color-text-muted)]">
                      &ldquo;{r.endorsement}&rdquo;
                    </p>
                  ) : null}
                </div>
                <div className="flex shrink-0 flex-col items-end gap-1.5">
                  <StatusBadge
                    label={REF_STATUS_LABEL[r.status]}
                    colorClass={REF_STATUS_COLOR[r.status]}
                  />
                  {r.status === "sent" ? (
                    <button
                      type="button"
                      disabled={cancelling && cancellingId === r.id}
                      onClick={() => handleCancel(r.id)}
                      className="text-[11px] text-[var(--color-text-faint)] underline underline-offset-2 transition-colors hover:text-red-600 disabled:opacity-50"
                    >
                      {cancelling && cancellingId === r.id ? "Cancelling…" : "Cancel"}
                    </button>
                  ) : null}
                </div>
              </div>
            </div>
          ))}
        </div>
      ) : null}

      {/* New request form */}
      <div className="space-y-4">
        <p className="text-[12px] font-medium uppercase tracking-[0.1em] text-[var(--color-text-faint)]">
          Request a new reference
        </p>
        <FieldRow label="Their name">
          <TextInput
            placeholder="Jane Smith"
            value={form.referee_name}
            onChange={(v) => setForm((f) => ({ ...f, referee_name: v }))}
          />
        </FieldRow>
        <FieldRow label="Their email">
          <TextInput
            type="email"
            placeholder="jane@example.com"
            value={form.referee_email}
            onChange={(v) => setForm((f) => ({ ...f, referee_email: v }))}
          />
        </FieldRow>
        <FieldRow label="Your relationship">
          <TextInput
            placeholder="Former manager, co-founder, investor, etc."
            value={form.relationship}
            onChange={(v) => setForm((f) => ({ ...f, relationship: v }))}
          />
        </FieldRow>
      </div>

      <ActionBar
        saving={saving}
        result={result}
        onAction={handleRequest}
        label="Send request"
      />
    </div>
  );
}

// ──────────────────────────────────────────────────────────────────────────
//  Root export
// ──────────────────────────────────────────────────────────────────────────

export function VerificationPanel({
  ownVerifications,
  ownReferences,
}: {
  ownVerifications: OwnVerification[];
  ownReferences: OwnReference[];
}) {
  return (
    <div className="space-y-0 divide-y divide-[var(--color-border)]">
      <div className="pb-2">
        <p className="text-[12px] font-medium uppercase tracking-[0.16em] text-[var(--color-text-faint)]">
          Verifications &amp; References
        </p>
        <p className="mt-1 text-[12.5px] text-[var(--color-text-muted)]">
          Trust signals attached to your profile. Claims are reviewed; references are confirmed by
          your contacts directly.
        </p>
      </div>
      <div className="divide-y divide-[var(--color-border)] pt-2">
        <SectionShell
          title="Verification claims"
          hint="Self-attested signals reviewed before appearing as badges"
        >
          <ClaimsSection initial={ownVerifications} />
        </SectionShell>
        <SectionShell
          title="Reference requests"
          hint="Magic-link references sent to contacts — confirmed by them"
        >
          <ReferencesSection initial={ownReferences} />
        </SectionShell>
      </div>
    </div>
  );
}
