"use client";

import { useState, useRef, type ReactNode } from "react";
import type { Route } from "next";
import Link from "next/link";
import {
  ArrowRight,
  Check,
  Eye,
  Globe,
  Plus,
  ShieldCheck,
  Target,
  Upload,
  X,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Wordmark } from "@/components/landing/wordmark";

// ---------------------------------------------------------------------------
// Types & constants
// ---------------------------------------------------------------------------

type TabId = "personal" | "founder" | "investor" | "settings";
type Role = "founder" | "investor" | null;

const NAV_LINKS: Array<{ label: string; href: string }> = [
  { label: "Feed", href: "/feed" },
  { label: "Matches", href: "/matches" },
  { label: "Profiles", href: "/profile" },
  { label: "Dashboard", href: "/dashboard" },
];

const ALL_TABS: Array<{ id: TabId; label: string; roles: Role[] }> = [
  { id: "personal", label: "Personal", roles: ["founder", "investor", null] },
  { id: "founder", label: "Founder Profile", roles: ["founder", null] },
  { id: "investor", label: "Investor Profile", roles: ["investor", null] },
  { id: "settings", label: "Settings", roles: ["founder", "investor", null] },
];

function tabsForRole(role: Role) {
  return ALL_TABS.filter((t) => t.roles.includes(role));
}

const SECTORS = [
  "Fintech",
  "Healthtech",
  "AI / ML",
  "SaaS",
  "Consumer",
  "Edtech",
  "Cleantech",
  "Proptech",
  "Deeptech",
  "Gaming",
  "Marketplace",
  "Infrastructure",
];

const STAGES_OPTIONS = ["Pre-idea", "Pre-seed", "Seed", "Series A", "Series B+"];

// Mocked completion — replace with real data once DB is wired
const COMPLETION = {
  personal: 100,
  founder: 70,
  investor: 45,
  photo: true,
};

function overallCompletion(role: Role): number {
  if (role === "founder") return Math.round((COMPLETION.personal + COMPLETION.founder) / 2);
  if (role === "investor") return Math.round((COMPLETION.personal + COMPLETION.investor) / 2);
  return Math.round((COMPLETION.personal + COMPLETION.founder + COMPLETION.investor) / 3);
}

// ---------------------------------------------------------------------------
// Main export
// ---------------------------------------------------------------------------

type ProfileTabsProps = {
  role: Role;
  name: string;
  email: string;
};

export function ProfileTabs({ role, name, email }: ProfileTabsProps) {
  const tabs = tabsForRole(role);
  const defaultTab: TabId = role === "investor" ? "investor" : "founder";
  const [activeTab, setActiveTab] = useState<TabId>(defaultTab);

  return (
    <div className="min-h-screen" style={{ background: "var(--color-bg)" }}>
      <AppNav role={role} name={name} />

      {/* Page header */}
      <section
        className="border-b"
        style={{ borderColor: "var(--color-border)" }}
      >
        <div className="mx-auto w-full max-w-[1440px] px-4 sm:px-6 py-5 sm:py-6">
          <h1
            className="text-[20px] leading-7 font-semibold tracking-[-0.015em]"
            style={{ color: "var(--color-text)" }}
          >
            Profiles
          </h1>
          <p
            className="mt-0.5 text-[13px] leading-5"
            style={{ color: "var(--color-text-muted)" }}
          >
            Manage your personal information and role-based profiles
          </p>
        </div>
      </section>

      {/* Tab strip */}
      <div
        className="border-b"
        style={{
          borderColor: "var(--color-border)",
          background: "var(--color-surface)",
        }}
      >
        <div className="mx-auto w-full max-w-[1440px] px-4 sm:px-6">
          <div
            role="tablist"
            aria-label="Profile sections"
            className="flex items-center overflow-x-auto -mb-px"
            style={{ scrollbarWidth: "none" }}
          >
            {tabs.map((tab) => {
              const isActive = activeTab === tab.id;
              return (
                <button
                  key={tab.id}
                  role="tab"
                  id={`tab-${tab.id}`}
                  aria-selected={isActive}
                  aria-controls={`tabpanel-${tab.id}`}
                  onClick={() => setActiveTab(tab.id)}
                  className={cn(
                    "relative shrink-0 px-4 py-3.5 text-[14px] leading-5 font-medium border-b-2",
                    "transition-colors duration-[120ms] ease-out",
                    "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-[var(--color-brand-ink)]/30",
                    isActive
                      ? "border-[var(--color-brand-ink)] text-[var(--color-text)]"
                      : "border-transparent text-[var(--color-text-muted)] hover:text-[var(--color-text)]"
                  )}
                >
                  {tab.label}
                </button>
              );
            })}
          </div>
        </div>
      </div>

      {/* Content */}
      <main
        id="main-content"
        className="mx-auto w-full max-w-[1440px] px-4 sm:px-6 py-6 lg:py-8"
      >
        <div className="grid grid-cols-1 gap-5 lg:grid-cols-12 lg:gap-6">
          {/* Left column — tab panels */}
          <div className="lg:col-span-8">
            <div
              role="tabpanel"
              id="tabpanel-personal"
              aria-labelledby="tab-personal"
              hidden={activeTab !== "personal"}
            >
              <PersonalForm name={name} email={email} />
            </div>

            {role !== "investor" && (
              <div
                role="tabpanel"
                id="tabpanel-founder"
                aria-labelledby="tab-founder"
                hidden={activeTab !== "founder"}
              >
                <FounderProfileForm />
              </div>
            )}

            {role !== "founder" && (
              <div
                role="tabpanel"
                id="tabpanel-investor"
                aria-labelledby="tab-investor"
                hidden={activeTab !== "investor"}
              >
                <InvestorProfileForm />
              </div>
            )}

            <div
              role="tabpanel"
              id="tabpanel-settings"
              aria-labelledby="tab-settings"
              hidden={activeTab !== "settings"}
            >
              <SettingsPanel email={email} />
            </div>
          </div>

          {/* Right column — sidebar */}
          <aside className="lg:col-span-4">
            <div
              className="flex flex-col gap-4 lg:sticky"
              style={{ top: "calc(64px + 1px)" }}
            >
              <CompletionSidebar
                role={role}
                activeTab={activeTab}
                onNavigateTab={setActiveTab}
              />
              <GuidanceCard />
            </div>
          </aside>
        </div>
      </main>
    </div>
  );
}

// ---------------------------------------------------------------------------
// App nav
// ---------------------------------------------------------------------------

function AppNav({ role, name }: { role: Role; name: string }) {
  const initials = name
    ? name
        .split(" ")
        .slice(0, 2)
        .map((n) => n[0])
        .join("")
        .toUpperCase()
    : "VM";

  return (
    <header
      className="sticky top-0 z-40 border-b"
      style={{
        borderColor: "var(--color-border)",
        background: "var(--color-bg)",
      }}
    >
      <div className="mx-auto flex h-16 max-w-[1440px] items-center justify-between gap-6 px-4 sm:px-6">
        <div className="flex items-center gap-8">
          <Wordmark size="md" />
          <nav
            aria-label="Primary"
            className="hidden items-center gap-6 md:flex"
          >
            {NAV_LINKS.map((link) => (
              <Link
                key={link.href}
                href={link.href as Route}
                className={cn(
                  "text-[14px] transition-colors duration-[120ms]",
                  link.href === "/profile"
                    ? "font-semibold text-[var(--color-text)]"
                    : "text-[var(--color-text-muted)] hover:text-[var(--color-text)]"
                )}
              >
                {link.label}
              </Link>
            ))}
          </nav>
        </div>

        <div className="flex items-center gap-3">
          {role && (
            <span
              className="hidden rounded-full border px-2.5 py-0.5 text-[12px] font-medium capitalize sm:inline-flex"
              style={{
                borderColor: "var(--color-border)",
                background: "var(--color-surface)",
                color: "var(--color-text-muted)",
              }}
            >
              {role}
            </span>
          )}
          <a
            href="/api/auth/signout"
            className="text-[12px] font-medium transition-colors duration-[120ms] hover:text-[var(--color-text-muted)]"
            style={{ color: "var(--color-text-faint)" }}
          >
            Sign out
          </a>
          <div
            aria-hidden
            className="grid h-9 w-9 shrink-0 place-items-center font-mono text-[11px] font-semibold uppercase tracking-tight"
            style={{
              background: "var(--color-brand-tint)",
              color: "var(--color-brand-strong)",
              borderRadius: "8px",
              boxShadow: "0 0 0 1px var(--color-border)",
            }}
          >
            {initials}
          </div>
        </div>
      </div>
    </header>
  );
}

// ---------------------------------------------------------------------------
// Personal form
// ---------------------------------------------------------------------------

type PersonalFormState = {
  fullName: string;
  displayName: string;
  location: string;
  timezone: string;
  bio: string;
};

function PersonalForm({ name, email }: { name: string; email: string }) {
  const [form, setForm] = useState<PersonalFormState>({
    fullName: name,
    displayName: "",
    location: "",
    timezone: "",
    bio: "",
  });
  const [saved, setSaved] = useState(false);
  const photoRef = useRef<HTMLInputElement>(null);

  const initials = form.fullName
    ? form.fullName
        .split(" ")
        .slice(0, 2)
        .map((n) => n[0])
        .join("")
        .toUpperCase()
    : "?";

  function handleSave() {
    setSaved(true);
    setTimeout(() => setSaved(false), 3000);
  }

  return (
    <section
      aria-labelledby="personal-heading"
      className="border"
      style={{
        borderColor: "var(--color-border)",
        background: "var(--color-surface)",
      }}
    >
      <div
        className="px-5 py-5 border-b"
        style={{ borderColor: "var(--color-border)" }}
      >
        <h2
          id="personal-heading"
          className="text-[15px] leading-5 font-semibold tracking-tight"
          style={{ color: "var(--color-text)" }}
        >
          Personal Information
        </h2>
        <p
          className="mt-0.5 text-[13px] leading-5"
          style={{ color: "var(--color-text-muted)" }}
        >
          Your name and public-facing details across VentraMatch.
        </p>
      </div>

      <div className="px-5 py-5 flex flex-col gap-5">
        {/* Photo */}
        <div className="flex flex-col gap-2">
          <span
            className="text-[13px] font-medium"
            style={{ color: "var(--color-text)" }}
          >
            Profile Photo
          </span>
          <div className="flex items-center gap-4">
            <div
              aria-hidden
              className="grid h-14 w-14 shrink-0 place-items-center font-mono text-[16px] font-semibold uppercase tracking-tight"
              style={{
                background: "var(--color-brand-tint)",
                color: "var(--color-brand-strong)",
                borderRadius: "8px",
              }}
            >
              {initials}
            </div>
            <div className="flex flex-col gap-1">
              <input
                ref={photoRef}
                type="file"
                accept="image/jpeg,image/png,image/webp"
                className="sr-only"
                aria-label="Upload profile photo"
              />
              <button
                type="button"
                onClick={() => photoRef.current?.click()}
                className="inline-flex h-8 items-center gap-1.5 border px-3 text-[13px] font-medium transition-colors duration-[120ms] hover:border-[var(--color-text-faint)]"
                style={{
                  borderColor: "var(--color-border)",
                  color: "var(--color-text)",
                  borderRadius: "var(--radius-sm)",
                  background: "var(--color-surface)",
                }}
              >
                <Upload
                  size={12}
                  strokeWidth={1.75}
                  aria-hidden
                  style={{ color: "var(--color-text-faint)" }}
                />
                Upload photo
              </button>
              <p
                className="text-[12px]"
                style={{ color: "var(--color-text-faint)" }}
              >
                JPG, PNG or WebP, max 2 MB
              </p>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Field
            id="fullName"
            label="Full Name"
            value={form.fullName}
            onChange={(v) => setForm((f) => ({ ...f, fullName: v }))}
            placeholder="Your legal name"
          />
          <Field
            id="displayName"
            label="Display Name"
            value={form.displayName}
            onChange={(v) => setForm((f) => ({ ...f, displayName: v }))}
            placeholder="How you appear on the platform"
          />
        </div>

        {/* Email — read-only */}
        <div className="flex flex-col gap-1.5">
          <label
            className="text-[13px] font-medium"
            style={{ color: "var(--color-text)" }}
          >
            Email
          </label>
          <div
            className="flex h-9 items-center gap-2 border px-3 text-[14px]"
            style={{
              borderColor: "var(--color-border)",
              background: "var(--color-surface-2)",
              borderRadius: "var(--radius)",
              color: "var(--color-text-muted)",
            }}
          >
            <span className="flex-1 truncate">{email || "—"}</span>
            <span
              className="shrink-0 text-[11px] font-medium uppercase tracking-[0.06em]"
              style={{ color: "var(--color-text-faint)" }}
            >
              Managed
            </span>
          </div>
          <p
            className="text-[12px]"
            style={{ color: "var(--color-text-faint)" }}
          >
            Email changes go through account security.
          </p>
        </div>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Field
            id="personalLocation"
            label="Location"
            value={form.location}
            onChange={(v) => setForm((f) => ({ ...f, location: v }))}
            placeholder="City, Country"
          />
          <SelectField
            id="timezone"
            label="Timezone"
            value={form.timezone}
            onChange={(v) => setForm((f) => ({ ...f, timezone: v }))}
          >
            <option value="">Select timezone</option>
            <option value="America/New_York">Eastern Time (ET)</option>
            <option value="America/Chicago">Central Time (CT)</option>
            <option value="America/Denver">Mountain Time (MT)</option>
            <option value="America/Los_Angeles">Pacific Time (PT)</option>
            <option value="Europe/London">GMT / BST</option>
            <option value="Europe/Paris">CET (Paris, Berlin)</option>
            <option value="Asia/Kolkata">IST (India)</option>
            <option value="Asia/Singapore">SGT (Singapore)</option>
            <option value="Asia/Tokyo">JST (Tokyo)</option>
            <option value="Australia/Sydney">AEST (Sydney)</option>
          </SelectField>
        </div>

        <TextAreaField
          id="bio"
          label="Short Bio"
          value={form.bio}
          onChange={(v) => setForm((f) => ({ ...f, bio: v }))}
          placeholder="A sentence or two about yourself. Shown on your public profile."
          maxLength={200}
          rows={3}
        />
      </div>

      <div
        className="px-5 py-4 border-t"
        style={{ borderColor: "var(--color-border)" }}
      >
        <SaveButton onSave={handleSave} saved={saved} />
      </div>
    </section>
  );
}

// ---------------------------------------------------------------------------
// Founder profile form
// ---------------------------------------------------------------------------

type FounderFormState = {
  startupName: string;
  stage: string;
  industry: string;
  founded: string;
  teamSize: string;
  location: string;
  description: string;
  fundingSought: string;
  useOfFunds: string;
  traction: string;
  website: string;
  linkedin: string;
  twitter: string;
  productDemo: string;
};

type ExtraLink = {
  id: string;
  label: string;
  url: string;
};

function FounderProfileForm() {
  const [form, setForm] = useState<FounderFormState>({
    startupName: "",
    stage: "",
    industry: "",
    founded: "",
    teamSize: "",
    location: "",
    description: "",
    fundingSought: "",
    useOfFunds: "",
    traction: "",
    website: "",
    linkedin: "",
    twitter: "",
    productDemo: "",
  });
  const [extraLinks, setExtraLinks] = useState<ExtraLink[]>([]);
  const [saved, setSaved] = useState(false);
  const [pitchName, setPitchName] = useState("");
  const pitchRef = useRef<HTMLInputElement>(null);

  function handleSave() {
    setSaved(true);
    setTimeout(() => setSaved(false), 3000);
  }

  function addLink() {
    setExtraLinks((l) => [
      ...l,
      { id: String(Date.now()), label: "", url: "" },
    ]);
  }

  function removeLink(id: string) {
    setExtraLinks((l) => l.filter((x) => x.id !== id));
  }

  function updateLink(id: string, field: "label" | "url", val: string) {
    setExtraLinks((l) =>
      l.map((x) => (x.id === id ? { ...x, [field]: val } : x))
    );
  }

  return (
    <div className="flex flex-col gap-4">
      {/* Main founder card */}
      <section
        aria-labelledby="founder-heading"
        className="border"
        style={{
          borderColor: "var(--color-border)",
          background: "var(--color-surface)",
        }}
      >
        <div
          className="px-5 py-5 border-b"
          style={{ borderColor: "var(--color-border)" }}
        >
          <div className="flex items-start justify-between gap-4">
            <div>
              <div className="flex items-center gap-2.5">
                <h2
                  id="founder-heading"
                  className="text-[15px] leading-5 font-semibold tracking-tight"
                  style={{ color: "var(--color-text)" }}
                >
                  Founder Profile
                </h2>
                <CompletionBadge pct={COMPLETION.founder} />
              </div>
              <p
                className="mt-1 text-[13px] leading-5"
                style={{ color: "var(--color-text-muted)" }}
              >
                Tell investors about your startup and what you&apos;re
                building.
              </p>
            </div>
          </div>
        </div>

        <div className="px-5 py-5 flex flex-col gap-5">
          {/* Startup basics */}
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <Field
              id="startupName"
              label="Startup Name"
              value={form.startupName}
              onChange={(v) => setForm((f) => ({ ...f, startupName: v }))}
              placeholder="e.g. Acme Labs"
            />
            <SelectField
              id="stage"
              label="Stage"
              value={form.stage}
              onChange={(v) => setForm((f) => ({ ...f, stage: v }))}
            >
              <option value="">Select stage</option>
              <option value="pre-idea">Pre-idea</option>
              <option value="pre-seed">Pre-seed</option>
              <option value="seed">Seed</option>
              <option value="series-a">Series A</option>
              <option value="series-b">Series B+</option>
            </SelectField>
          </div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <SelectField
              id="industry"
              label="Industry"
              value={form.industry}
              onChange={(v) => setForm((f) => ({ ...f, industry: v }))}
            >
              <option value="">Select industry</option>
              <option value="ai-ml">AI / ML</option>
              <option value="fintech">Fintech</option>
              <option value="healthtech">Healthtech</option>
              <option value="saas">SaaS / Enterprise</option>
              <option value="consumer">Consumer</option>
              <option value="edtech">Edtech</option>
              <option value="cleantech">Cleantech</option>
              <option value="proptech">Proptech</option>
              <option value="ecommerce">E-commerce</option>
              <option value="deeptech">Deeptech</option>
              <option value="other">Other</option>
            </SelectField>
            <Field
              id="founded"
              label="Founded"
              value={form.founded}
              onChange={(v) => setForm((f) => ({ ...f, founded: v }))}
              placeholder="e.g. 2023"
            />
          </div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <SelectField
              id="teamSize"
              label="Team Size"
              value={form.teamSize}
              onChange={(v) => setForm((f) => ({ ...f, teamSize: v }))}
            >
              <option value="">Select size</option>
              <option value="solo">Solo founder</option>
              <option value="2-5">2–5</option>
              <option value="6-15">6–15</option>
              <option value="16-50">16–50</option>
              <option value="50+">50+</option>
            </SelectField>
            <Field
              id="founderLocation"
              label="Location"
              value={form.location}
              onChange={(v) => setForm((f) => ({ ...f, location: v }))}
              placeholder="City, Country"
            />
          </div>

          <TextAreaField
            id="startupDescription"
            label="Short Description"
            value={form.description}
            onChange={(v) => setForm((f) => ({ ...f, description: v }))}
            placeholder="What you're building, who it's for, and what makes it different. Two to three sentences."
            maxLength={280}
            rows={3}
          />

          <Divider />

          {/* Funding */}
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <Field
              id="fundingSought"
              label="Funding Sought"
              value={form.fundingSought}
              onChange={(v) => setForm((f) => ({ ...f, fundingSought: v }))}
              placeholder="e.g. $500K–$1M"
            />
            <Field
              id="traction"
              label="Revenue / Traction"
              value={form.traction}
              onChange={(v) => setForm((f) => ({ ...f, traction: v }))}
              placeholder="e.g. $8K MRR, +15% m/m"
            />
          </div>

          <TextAreaField
            id="useOfFunds"
            label="Use of Funds"
            value={form.useOfFunds}
            onChange={(v) => setForm((f) => ({ ...f, useOfFunds: v }))}
            placeholder="How will you deploy this capital? Engineering, sales, infrastructure?"
            rows={2}
          />

          <Divider />

          {/* Pitch deck + website */}
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div className="flex flex-col gap-1.5">
              <span
                className="text-[13px] font-medium"
                style={{ color: "var(--color-text)" }}
              >
                Pitch Deck
              </span>
              <input
                ref={pitchRef}
                type="file"
                accept=".pdf,.pptx,.key"
                className="sr-only"
                aria-label="Upload pitch deck"
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (file) setPitchName(file.name);
                }}
              />
              <button
                type="button"
                onClick={() => pitchRef.current?.click()}
                className="flex h-9 w-full items-center gap-2 border px-3 text-[13px] font-medium transition-colors duration-[120ms] hover:border-[var(--color-text-faint)]"
                style={{
                  borderColor: "var(--color-border)",
                  background: "var(--color-surface)",
                  borderRadius: "var(--radius)",
                  color: pitchName
                    ? "var(--color-text)"
                    : "var(--color-text-muted)",
                }}
              >
                <Upload
                  size={13}
                  strokeWidth={1.75}
                  aria-hidden
                  style={{ color: "var(--color-text-faint)", flexShrink: 0 }}
                />
                <span className="truncate flex-1 text-left">
                  {pitchName || "Upload PDF or PPTX"}
                </span>
              </button>
              <p
                className="text-[12px]"
                style={{ color: "var(--color-text-faint)" }}
              >
                PDF, PPTX, or Keynote
              </p>
            </div>
            <Field
              id="website"
              label="Website"
              value={form.website}
              onChange={(v) => setForm((f) => ({ ...f, website: v }))}
              placeholder="https://yourstartup.com"
            />
          </div>

          <Divider />

          {/* Links */}
          <div>
            <h3
              className="text-[13px] font-semibold mb-3"
              style={{ color: "var(--color-text)" }}
            >
              Links
            </h3>
            <div className="flex flex-col gap-3">
              <Field
                id="founderLinkedin"
                label="LinkedIn"
                value={form.linkedin}
                onChange={(v) => setForm((f) => ({ ...f, linkedin: v }))}
                placeholder="linkedin.com/in/yourname"
              />
              <Field
                id="founderTwitter"
                label="Twitter / X"
                value={form.twitter}
                onChange={(v) => setForm((f) => ({ ...f, twitter: v }))}
                placeholder="x.com/yourhandle"
              />
              <Field
                id="productDemo"
                label="Product Demo"
                value={form.productDemo}
                onChange={(v) => setForm((f) => ({ ...f, productDemo: v }))}
                placeholder="Loom, YouTube, or demo link"
              />

              {extraLinks.map((link) => (
                <div key={link.id} className="grid gap-2" style={{ gridTemplateColumns: "1fr 1fr auto" }}>
                  <input
                    type="text"
                    placeholder="Label"
                    value={link.label}
                    onChange={(e) =>
                      updateLink(link.id, "label", e.target.value)
                    }
                    aria-label="Link label"
                    className="h-9 border px-3 text-[14px] transition-colors duration-[120ms] focus:outline-none focus:ring-2 focus:ring-[var(--color-brand-ink)]/20 hover:border-[var(--color-text-faint)]"
                    style={{
                      borderColor: "var(--color-border)",
                      background: "var(--color-surface)",
                      borderRadius: "var(--radius)",
                      color: "var(--color-text)",
                    }}
                  />
                  <input
                    type="url"
                    placeholder="https://..."
                    value={link.url}
                    onChange={(e) =>
                      updateLink(link.id, "url", e.target.value)
                    }
                    aria-label="Link URL"
                    className="h-9 border px-3 text-[14px] transition-colors duration-[120ms] focus:outline-none focus:ring-2 focus:ring-[var(--color-brand-ink)]/20 hover:border-[var(--color-text-faint)]"
                    style={{
                      borderColor: "var(--color-border)",
                      background: "var(--color-surface)",
                      borderRadius: "var(--radius)",
                      color: "var(--color-text)",
                    }}
                  />
                  <button
                    type="button"
                    onClick={() => removeLink(link.id)}
                    aria-label="Remove link"
                    className="grid h-9 w-9 place-items-center transition-colors duration-[120ms] hover:text-[var(--color-text-muted)]"
                    style={{ color: "var(--color-text-faint)" }}
                  >
                    <X size={14} strokeWidth={1.75} aria-hidden />
                  </button>
                </div>
              ))}

              <button
                type="button"
                onClick={addLink}
                className="inline-flex items-center gap-1.5 h-8 self-start text-[13px] font-medium transition-colors duration-[120ms] hover:text-[var(--color-brand-strong)]"
                style={{ color: "var(--color-brand-ink)" }}
              >
                <Plus size={13} strokeWidth={1.75} aria-hidden />
                Add link
              </button>
            </div>
          </div>
        </div>

        <div
          className="px-5 py-4 border-t"
          style={{ borderColor: "var(--color-border)" }}
        >
          <SaveButton onSave={handleSave} saved={saved} />
        </div>
      </section>

    </div>
  );
}

// ---------------------------------------------------------------------------
// Investor profile form (full tab)
// ---------------------------------------------------------------------------

function InvestorProfileForm() {
  const [saved, setSaved] = useState(false);

  function handleSave() {
    setSaved(true);
    setTimeout(() => setSaved(false), 3000);
  }

  return (
    <section
      aria-labelledby="investor-heading"
      className="border"
      style={{
        borderColor: "var(--color-border)",
        background: "var(--color-surface)",
      }}
    >
      <div
        className="px-5 py-5 border-b"
        style={{ borderColor: "var(--color-border)" }}
      >
        <div className="flex items-center gap-2.5">
          <h2
            id="investor-heading"
            className="text-[15px] leading-5 font-semibold tracking-tight"
            style={{ color: "var(--color-text)" }}
          >
            Investor Profile
          </h2>
          <CompletionBadge pct={COMPLETION.investor} />
        </div>
        <p
          className="mt-1 text-[13px] leading-5"
          style={{ color: "var(--color-text-muted)" }}
        >
          Show founders what you invest in and how you like to partner.
        </p>
      </div>

      <div className="px-5 py-5">
        <InvestorProfileFormContent />
      </div>

      <div
        className="px-5 py-4 border-t"
        style={{ borderColor: "var(--color-border)" }}
      >
        <SaveButton onSave={handleSave} saved={saved} />
      </div>
    </section>
  );
}

// Shared investor form fields — used both in the full tab and collapsed preview
function InvestorProfileFormContent() {
  const [form, setForm] = useState({
    fundName: "",
    investorType: "",
    checkMin: "",
    checkMax: "",
    geography: "",
    portfolioSize: "",
    thesis: "",
    linkedin: "",
    twitter: "",
    website: "",
  });
  const [sectors, setSectors] = useState<string[]>([]);
  const [stages, setStages] = useState<string[]>([]);

  return (
    <div className="flex flex-col gap-5">
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <Field
          id="fundName"
          label="Fund / Firm Name"
          value={form.fundName}
          onChange={(v) => setForm((f) => ({ ...f, fundName: v }))}
          placeholder="e.g. Acme Ventures, or your name"
        />
        <SelectField
          id="investorType"
          label="Investor Type"
          value={form.investorType}
          onChange={(v) => setForm((f) => ({ ...f, investorType: v }))}
        >
          <option value="">Select type</option>
          <option value="angel">Angel</option>
          <option value="micro-vc">Micro-VC</option>
          <option value="vc-partner">VC Partner</option>
          <option value="family-office">Family Office</option>
          <option value="operator-angel">Operator Angel</option>
          <option value="corporate-vc">Corporate VC</option>
        </SelectField>
      </div>

      {/* Check size */}
      <div>
        <span
          className="block text-[13px] font-medium mb-1.5"
          style={{ color: "var(--color-text)" }}
        >
          Check Size
        </span>
        <div className="grid grid-cols-2 gap-3">
          <div className="relative">
            <span
              className="absolute left-3 top-1/2 -translate-y-1/2 text-[13px] pointer-events-none"
              style={{ color: "var(--color-text-faint)" }}
            >
              Min
            </span>
            <input
              id="checkMin"
              type="text"
              value={form.checkMin}
              onChange={(e) =>
                setForm((f) => ({ ...f, checkMin: e.target.value }))
              }
              placeholder="$25K"
              aria-label="Minimum check size"
              className="h-9 w-full border pl-10 pr-3 text-[14px] transition-colors duration-[120ms] focus:outline-none focus:ring-2 focus:ring-[var(--color-brand-ink)]/20 hover:border-[var(--color-text-faint)]"
              style={{
                borderColor: "var(--color-border)",
                background: "var(--color-surface)",
                borderRadius: "var(--radius)",
                color: "var(--color-text)",
              }}
            />
          </div>
          <div className="relative">
            <span
              className="absolute left-3 top-1/2 -translate-y-1/2 text-[13px] pointer-events-none"
              style={{ color: "var(--color-text-faint)" }}
            >
              Max
            </span>
            <input
              id="checkMax"
              type="text"
              value={form.checkMax}
              onChange={(e) =>
                setForm((f) => ({ ...f, checkMax: e.target.value }))
              }
              placeholder="$500K"
              aria-label="Maximum check size"
              className="h-9 w-full border pl-10 pr-3 text-[14px] transition-colors duration-[120ms] focus:outline-none focus:ring-2 focus:ring-[var(--color-brand-ink)]/20 hover:border-[var(--color-text-faint)]"
              style={{
                borderColor: "var(--color-border)",
                background: "var(--color-surface)",
                borderRadius: "var(--radius)",
                color: "var(--color-text)",
              }}
            />
          </div>
        </div>
      </div>

      <ChipSelector
        id="sectors"
        label="Sectors"
        options={SECTORS}
        selected={sectors}
        onChange={setSectors}
      />

      <ChipSelector
        id="stages"
        label="Stage Preference"
        options={STAGES_OPTIONS}
        selected={stages}
        onChange={setStages}
      />

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <Field
          id="investorGeography"
          label="Geography Focus"
          value={form.geography}
          onChange={(v) => setForm((f) => ({ ...f, geography: v }))}
          placeholder="e.g. US, Europe, Global"
        />
        <Field
          id="portfolioSize"
          label="Portfolio Companies"
          value={form.portfolioSize}
          onChange={(v) => setForm((f) => ({ ...f, portfolioSize: v }))}
          placeholder="e.g. 12"
        />
      </div>

      <TextAreaField
        id="thesis"
        label="Investment Thesis"
        value={form.thesis}
        onChange={(v) => setForm((f) => ({ ...f, thesis: v }))}
        placeholder="What excites you? Which sectors, models, or founder profiles do you back?"
        rows={3}
        maxLength={400}
      />

      <Divider />

      <div className="flex flex-col gap-3">
        <h3
          className="text-[13px] font-semibold"
          style={{ color: "var(--color-text)" }}
        >
          Links
        </h3>
        <Field
          id="investorLinkedin"
          label="LinkedIn"
          value={form.linkedin}
          onChange={(v) => setForm((f) => ({ ...f, linkedin: v }))}
          placeholder="linkedin.com/in/yourname"
        />
        <Field
          id="investorTwitter"
          label="Twitter / X"
          value={form.twitter}
          onChange={(v) => setForm((f) => ({ ...f, twitter: v }))}
          placeholder="x.com/yourhandle"
        />
        <Field
          id="investorWebsite"
          label="Website"
          value={form.website}
          onChange={(v) => setForm((f) => ({ ...f, website: v }))}
          placeholder="https://yourfirm.com"
        />
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Settings panel
// ---------------------------------------------------------------------------

type ToggleProps = {
  id: string;
  label: string;
  description: string;
  checked: boolean;
  onChange: (v: boolean) => void;
};

function ToggleRow({ id, label, description, checked, onChange }: ToggleProps) {
  return (
    <label
      htmlFor={id}
      className="flex items-start justify-between gap-4 cursor-pointer"
    >
      <div className="flex-1 min-w-0">
        <p
          className="text-[14px] font-medium"
          style={{ color: "var(--color-text)" }}
        >
          {label}
        </p>
        <p
          className="mt-0.5 text-[13px]"
          style={{ color: "var(--color-text-muted)" }}
        >
          {description}
        </p>
      </div>
      <div className="relative shrink-0 mt-0.5">
        <input
          type="checkbox"
          id={id}
          checked={checked}
          onChange={(e) => onChange(e.target.checked)}
          className="sr-only"
        />
        <div
          className="w-9 h-5 rounded-full transition-colors duration-[120ms] ease-out"
          style={{
            background: checked
              ? "var(--color-brand-ink)"
              : "var(--color-border-strong)",
          }}
        >
          <div
            className="absolute top-0.5 h-4 w-4 rounded-full bg-white transition-transform duration-[120ms] ease-out shadow-sm"
            style={{
              transform: checked ? "translateX(18px)" : "translateX(2px)",
            }}
          />
        </div>
      </div>
    </label>
  );
}

function SettingsPanel({ email }: { email: string }) {
  const [notifications, setNotifications] = useState({
    newMatches: true,
    weeklyDigest: true,
    messages: false,
  });
  const [visibility, setVisibility] = useState({
    visibleToInvestors: true,
    showInSearch: true,
  });

  return (
    <div className="flex flex-col gap-4">
      {/* Notifications */}
      <section
        aria-labelledby="notif-heading"
        className="border"
        style={{
          borderColor: "var(--color-border)",
          background: "var(--color-surface)",
        }}
      >
        <div
          className="px-5 py-5 border-b"
          style={{ borderColor: "var(--color-border)" }}
        >
          <h2
            id="notif-heading"
            className="text-[15px] font-semibold tracking-tight"
            style={{ color: "var(--color-text)" }}
          >
            Notifications
          </h2>
          <p
            className="mt-0.5 text-[13px]"
            style={{ color: "var(--color-text-muted)" }}
          >
            Control which emails VentraMatch sends you.
          </p>
        </div>
        <div className="px-5 py-5 flex flex-col gap-5">
          <ToggleRow
            id="newMatches"
            label="New matches"
            description="When a new investor matches your stage and sector."
            checked={notifications.newMatches}
            onChange={(v) =>
              setNotifications((n) => ({ ...n, newMatches: v }))
            }
          />
          <ToggleRow
            id="weeklyDigest"
            label="Weekly digest"
            description="A summary of your profile activity every Monday."
            checked={notifications.weeklyDigest}
            onChange={(v) =>
              setNotifications((n) => ({ ...n, weeklyDigest: v }))
            }
          />
          <ToggleRow
            id="messages"
            label="Messages"
            description="When an investor unlocks contact and sends a message."
            checked={notifications.messages}
            onChange={(v) =>
              setNotifications((n) => ({ ...n, messages: v }))
            }
          />
        </div>
      </section>

      {/* Profile visibility */}
      <section
        aria-labelledby="visibility-heading"
        className="border"
        style={{
          borderColor: "var(--color-border)",
          background: "var(--color-surface)",
        }}
      >
        <div
          className="px-5 py-5 border-b"
          style={{ borderColor: "var(--color-border)" }}
        >
          <h2
            id="visibility-heading"
            className="text-[15px] font-semibold tracking-tight"
            style={{ color: "var(--color-text)" }}
          >
            Profile Visibility
          </h2>
          <p
            className="mt-0.5 text-[13px]"
            style={{ color: "var(--color-text-muted)" }}
          >
            Who can see your profile on the platform.
          </p>
        </div>
        <div className="px-5 py-5 flex flex-col gap-5">
          <ToggleRow
            id="visibleToInvestors"
            label="Visible to investors"
            description="Investors can find your profile in search and feed."
            checked={visibility.visibleToInvestors}
            onChange={(v) =>
              setVisibility((s) => ({ ...s, visibleToInvestors: v }))
            }
          />
          <ToggleRow
            id="showInSearch"
            label="Show in search"
            description="Your startup appears in investor search results."
            checked={visibility.showInSearch}
            onChange={(v) =>
              setVisibility((s) => ({ ...s, showInSearch: v }))
            }
          />
        </div>
      </section>

      {/* Account */}
      <section
        aria-labelledby="account-heading"
        className="border"
        style={{
          borderColor: "var(--color-border)",
          background: "var(--color-surface)",
        }}
      >
        <div
          className="px-5 py-5 border-b"
          style={{ borderColor: "var(--color-border)" }}
        >
          <h2
            id="account-heading"
            className="text-[15px] font-semibold tracking-tight"
            style={{ color: "var(--color-text)" }}
          >
            Account
          </h2>
        </div>
        <div className="px-5 py-5 flex flex-col gap-4">
          <div>
            <p
              className="text-[13px] font-medium"
              style={{ color: "var(--color-text)" }}
            >
              Email address
            </p>
            <p
              className="mt-0.5 text-[13px]"
              style={{ color: "var(--color-text-muted)" }}
            >
              {email || "—"}
            </p>
          </div>
          <button
            type="button"
            className="inline-flex h-9 items-center gap-2 border px-4 text-[13px] font-medium self-start transition-colors duration-[120ms] hover:border-[var(--color-text-faint)]"
            style={{
              borderColor: "var(--color-border)",
              color: "var(--color-text)",
              borderRadius: "var(--radius-sm)",
              background: "var(--color-surface)",
            }}
          >
            Change password
          </button>
        </div>
      </section>

      {/* Danger zone */}
      <section
        aria-labelledby="danger-heading"
        className="border"
        style={{
          borderColor: "var(--color-danger)",
          background: "var(--color-surface)",
        }}
      >
        <div className="px-5 py-5 border-b" style={{ borderColor: "var(--color-border)" }}>
          <h2
            id="danger-heading"
            className="text-[15px] font-semibold tracking-tight"
            style={{ color: "var(--color-danger)" }}
          >
            Danger Zone
          </h2>
          <p
            className="mt-0.5 text-[13px]"
            style={{ color: "var(--color-text-muted)" }}
          >
            Permanent actions. No undo.
          </p>
        </div>
        <div className="px-5 py-5">
          <button
            type="button"
            className="inline-flex h-9 items-center gap-2 border px-4 text-[13px] font-medium self-start transition-colors duration-[120ms]"
            style={{
              borderColor: "var(--color-danger)",
              color: "var(--color-danger)",
              borderRadius: "var(--radius-sm)",
              background: "transparent",
            }}
          >
            Delete account
          </button>
        </div>
      </section>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Completion sidebar
// ---------------------------------------------------------------------------

type ChecklistItem = {
  id: string;
  label: string;
  tab: TabId;
  done: boolean;
  pct?: number;
};

function checklistForRole(role: Role): ChecklistItem[] {
  const items: ChecklistItem[] = [
    { id: "personal", label: "Personal Information", tab: "personal", done: true },
  ];
  if (role !== "investor") {
    items.push({
      id: "founder",
      label: "Founder Profile",
      tab: "founder",
      done: false,
      pct: COMPLETION.founder,
    });
  }
  if (role !== "founder") {
    items.push({
      id: "investor",
      label: "Investor Profile",
      tab: "investor",
      done: false,
      pct: COMPLETION.investor,
    });
  }
  items.push({ id: "photo", label: "Profile Photo", tab: "personal", done: true });
  return items;
}

const GAUGE_R = 38;
const GAUGE_STROKE = 9;
const GAUGE_CIRC = 2 * Math.PI * GAUGE_R;

function CompletionSidebar({
  role,
  activeTab,
  onNavigateTab,
}: {
  role: Role;
  activeTab: TabId;
  onNavigateTab: (tab: TabId) => void;
}) {
  const pct = overallCompletion(role);
  const checklist = checklistForRole(role);
  const offset = GAUGE_CIRC * (1 - pct / 100);

  return (
    <section
      aria-labelledby="completion-heading"
      className="border"
      style={{
        borderColor: "var(--color-border)",
        background: "var(--color-surface)",
      }}
    >
      <div
        className="px-5 py-5 border-b"
        style={{ borderColor: "var(--color-border)" }}
      >
        <h2
          id="completion-heading"
          className="text-[14px] font-semibold tracking-tight"
          style={{ color: "var(--color-text)" }}
        >
          Profile Completion
        </h2>
      </div>

      <div className="px-5 py-5 flex flex-col gap-5">
        {/* Gauge + label */}
        <div className="flex items-center gap-5">
          <div className="relative shrink-0" style={{ width: 88, height: 88 }}>
            <svg
              viewBox="0 0 88 88"
              role="img"
              aria-label={`Overall profile ${pct} percent complete`}
              style={{ width: 88, height: 88 }}
            >
              <circle
                cx={44}
                cy={44}
                r={GAUGE_R}
                fill="none"
                strokeWidth={GAUGE_STROKE}
                style={{ stroke: "var(--color-brand-tint)" }}
              />
              <circle
                cx={44}
                cy={44}
                r={GAUGE_R}
                fill="none"
                strokeWidth={GAUGE_STROKE}
                strokeLinecap="round"
                strokeDasharray={GAUGE_CIRC}
                strokeDashoffset={offset}
                transform="rotate(-90 44 44)"
                style={{
                  stroke: "var(--color-brand)",
                  transition:
                    "stroke-dashoffset 360ms cubic-bezier(0.22, 1, 0.36, 1)",
                }}
              />
            </svg>
            <span
              className="absolute inset-0 flex items-center justify-center font-mono text-[18px] font-bold tabular-nums"
              style={{ color: "var(--color-text)" }}
            >
              {pct}%
            </span>
          </div>
          <div className="flex-1 min-w-0">
            <p
              className="text-[14px] font-semibold"
              style={{ color: "var(--color-text)" }}
            >
              You&apos;re on your way.
            </p>
            <p
              className="mt-1 text-[12px] leading-4"
              style={{ color: "var(--color-text-muted)" }}
            >
              {role === "investor"
                ? "Complete your profile to surface in more founder searches."
                : "Complete your profile to unlock more investor matches."}
            </p>
          </div>
        </div>

        {/* Checklist */}
        <ul className="flex flex-col divide-y" style={{ borderColor: "var(--color-border)" }}>
          {checklist.map((item) => {
            const isActive = activeTab === item.tab && !item.done;
            return (
              <li key={item.id}>
                <button
                  type="button"
                  onClick={() => onNavigateTab(item.tab)}
                  className="group flex w-full items-center gap-2.5 py-2.5 text-left transition-colors duration-[120ms]"
                >
                  <span
                    className="grid h-5 w-5 shrink-0 place-items-center"
                    style={{
                      borderRadius: "var(--radius-sm)",
                      background: item.done
                        ? "var(--color-brand-tint)"
                        : "var(--color-surface-2)",
                    }}
                  >
                    {item.done ? (
                      <Check
                        size={11}
                        strokeWidth={2.5}
                        aria-hidden
                        style={{ color: "var(--color-brand)" }}
                      />
                    ) : (
                      <span
                        className="h-1.5 w-1.5 rounded-full"
                        style={{
                          background: isActive
                            ? "var(--color-brand)"
                            : "var(--color-text-faint)",
                        }}
                      />
                    )}
                  </span>
                  <span
                    className="flex-1 text-[13px]"
                    style={{
                      color: item.done
                        ? "var(--color-text-muted)"
                        : "var(--color-text)",
                    }}
                  >
                    {item.label}
                  </span>
                  {!item.done && item.pct !== undefined && (
                    <span
                      className="shrink-0 font-mono text-[11px] tabular-nums"
                      style={{ color: "var(--color-text-faint)" }}
                    >
                      {item.pct}%
                    </span>
                  )}
                </button>
              </li>
            );
          })}
        </ul>

        {/* View profile button */}
        <Link
          href={"/profile/preview" as Route}
          className={cn(
            "inline-flex w-full items-center justify-center gap-1.5",
            "h-9 border px-4",
            "text-[13px] font-medium",
            "transition-colors duration-[120ms]",
            "hover:border-[var(--color-text-faint)] hover:text-[var(--color-text)]"
          )}
          style={{
            borderColor: "var(--color-border)",
            color: "var(--color-text-muted)",
            borderRadius: "var(--radius-sm)",
            background: "var(--color-surface)",
          }}
        >
          <Eye
            size={13}
            strokeWidth={1.75}
            aria-hidden
            style={{ color: "var(--color-text-faint)" }}
          />
          View profile as others see it
          <ArrowRight
            size={12}
            strokeWidth={1.75}
            aria-hidden
            style={{ color: "var(--color-text-faint)" }}
          />
        </Link>
      </div>
    </section>
  );
}

// ---------------------------------------------------------------------------
// Guidance card
// ---------------------------------------------------------------------------

const GUIDANCE: Array<{
  icon: ReactNode;
  title: string;
  body: string;
}> = [
  {
    icon: <Target size={15} strokeWidth={1.75} aria-hidden />,
    title: "Better matches",
    body: "Investors filter by completeness. Partial profiles are skipped first.",
  },
  {
    icon: <Globe size={15} strokeWidth={1.75} aria-hidden />,
    title: "More visibility",
    body: "Your profile surfaces in more searches once it crosses 60%.",
  },
  {
    icon: <ShieldCheck size={15} strokeWidth={1.75} aria-hidden />,
    title: "Build trust",
    body: "Three fields close most of the gap: description, traction, and funding ask.",
  },
];

function GuidanceCard() {
  return (
    <section
      aria-labelledby="guidance-heading"
      className="border"
      style={{
        borderColor: "var(--color-border)",
        background: "var(--color-surface)",
      }}
    >
      <div
        className="px-5 py-5 border-b"
        style={{ borderColor: "var(--color-border)" }}
      >
        <h2
          id="guidance-heading"
          className="text-[14px] font-semibold tracking-tight"
          style={{ color: "var(--color-text)" }}
        >
          Why complete your profiles?
        </h2>
      </div>
      <ul className="px-5 py-4 flex flex-col divide-y" style={{ borderColor: "var(--color-border)" }}>
        {GUIDANCE.map((item) => (
          <li key={item.title} className="flex items-start gap-3 py-3 first:pt-0 last:pb-0">
            <span
              className="mt-0.5 shrink-0"
              style={{ color: "var(--color-brand-ink)" }}
            >
              {item.icon}
            </span>
            <div className="min-w-0">
              <p
                className="text-[13px] font-medium"
                style={{ color: "var(--color-text)" }}
              >
                {item.title}
              </p>
              <p
                className="mt-0.5 text-[12px] leading-4"
                style={{ color: "var(--color-text-muted)" }}
              >
                {item.body}
              </p>
            </div>
          </li>
        ))}
      </ul>
    </section>
  );
}

// ---------------------------------------------------------------------------
// Form primitives
// ---------------------------------------------------------------------------

type FieldProps = {
  id: string;
  label: string;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  hint?: string;
};

function Field({ id, label, value, onChange, placeholder, hint }: FieldProps) {
  return (
    <div className="flex flex-col gap-1.5">
      <label
        htmlFor={id}
        className="text-[13px] font-medium"
        style={{ color: "var(--color-text)" }}
      >
        {label}
      </label>
      <input
        id={id}
        type="text"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="h-9 w-full border px-3 text-[14px] placeholder:text-[var(--color-text-faint)] transition-colors duration-[120ms] focus:outline-none focus:ring-2 focus:ring-[var(--color-brand-ink)]/20 hover:border-[var(--color-text-faint)]"
        style={{
          borderColor: "var(--color-border)",
          background: "var(--color-surface)",
          borderRadius: "var(--radius)",
          color: "var(--color-text)",
        }}
      />
      {hint && (
        <p className="text-[12px]" style={{ color: "var(--color-text-faint)" }}>
          {hint}
        </p>
      )}
    </div>
  );
}

type TextAreaProps = {
  id: string;
  label: string;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  maxLength?: number;
  rows?: number;
};

function TextAreaField({
  id,
  label,
  value,
  onChange,
  placeholder,
  maxLength,
  rows = 3,
}: TextAreaProps) {
  return (
    <div className="flex flex-col gap-1.5">
      <div className="flex items-baseline justify-between gap-2">
        <label
          htmlFor={id}
          className="text-[13px] font-medium"
          style={{ color: "var(--color-text)" }}
        >
          {label}
        </label>
        {maxLength && (
          <span
            className="text-[12px] tabular-nums"
            style={{ color: "var(--color-text-faint)" }}
          >
            {value.length} / {maxLength}
          </span>
        )}
      </div>
      <textarea
        id={id}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        maxLength={maxLength}
        rows={rows}
        className="w-full resize-none border px-3 py-2.5 text-[14px] leading-6 placeholder:text-[var(--color-text-faint)] transition-colors duration-[120ms] focus:outline-none focus:ring-2 focus:ring-[var(--color-brand-ink)]/20 hover:border-[var(--color-text-faint)]"
        style={{
          borderColor: "var(--color-border)",
          background: "var(--color-surface)",
          borderRadius: "var(--radius)",
          color: "var(--color-text)",
        }}
      />
    </div>
  );
}

type SelectProps = {
  id: string;
  label: string;
  value: string;
  onChange: (v: string) => void;
  children: ReactNode;
};

function SelectField({ id, label, value, onChange, children }: SelectProps) {
  return (
    <div className="flex flex-col gap-1.5">
      <label
        htmlFor={id}
        className="text-[13px] font-medium"
        style={{ color: "var(--color-text)" }}
      >
        {label}
      </label>
      <select
        id={id}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="h-9 w-full border px-3 text-[14px] transition-colors duration-[120ms] focus:outline-none focus:ring-2 focus:ring-[var(--color-brand-ink)]/20 hover:border-[var(--color-text-faint)] appearance-none"
        style={{
          borderColor: "var(--color-border)",
          background: "var(--color-surface)",
          borderRadius: "var(--radius)",
          color: value ? "var(--color-text)" : "var(--color-text-faint)",
          backgroundImage:
            "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12' viewBox='0 0 24 24' fill='none' stroke='%239ca3af' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'%3E%3Cpolyline points='6 9 12 15 18 9'/%3E%3C/svg%3E\")",
          backgroundRepeat: "no-repeat",
          backgroundPosition: "right 12px center",
          paddingRight: "32px",
        }}
      >
        {children}
      </select>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Chip selector
// ---------------------------------------------------------------------------

function ChipSelector({
  id,
  label,
  options,
  selected,
  onChange,
}: {
  id: string;
  label: string;
  options: string[];
  selected: string[];
  onChange: (v: string[]) => void;
}) {
  function toggle(opt: string) {
    onChange(
      selected.includes(opt)
        ? selected.filter((s) => s !== opt)
        : [...selected, opt]
    );
  }

  return (
    <div className="flex flex-col gap-2" id={id}>
      <span
        className="text-[13px] font-medium"
        style={{ color: "var(--color-text)" }}
      >
        {label}
      </span>
      <div className="flex flex-wrap gap-1.5" role="group" aria-label={label}>
        {options.map((opt) => {
          const active = selected.includes(opt);
          return (
            <button
              key={opt}
              type="button"
              aria-pressed={active}
              onClick={() => toggle(opt)}
              className="inline-flex items-center gap-1 px-2.5 py-1 text-[12px] font-medium transition-colors duration-[120ms]"
              style={{
                borderRadius: "var(--radius-sm)",
                background: active
                  ? "var(--color-brand-tint)"
                  : "var(--color-surface-2)",
                color: active
                  ? "var(--color-brand-strong)"
                  : "var(--color-text-muted)",
              }}
            >
              {active && (
                <Check size={10} strokeWidth={2.5} aria-hidden />
              )}
              {opt}
            </button>
          );
        })}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// UI helpers
// ---------------------------------------------------------------------------

function CompletionBadge({ pct }: { pct: number }) {
  const done = pct >= 100;
  return (
    <span
      className="inline-flex items-center px-2 py-0.5 text-[11px] font-medium tabular-nums"
      style={{
        borderRadius: "var(--radius-sm)",
        background: done
          ? "var(--color-brand-tint)"
          : "var(--color-surface-2)",
        color: done ? "var(--color-brand-strong)" : "var(--color-text-faint)",
      }}
    >
      {done ? "Complete" : `${pct}% complete`}
    </span>
  );
}

function SaveButton({
  onSave,
  saved,
}: {
  onSave: () => void;
  saved: boolean;
}) {
  return (
    <div className="flex items-center gap-4">
      <button
        type="button"
        onClick={onSave}
        className="inline-flex h-9 items-center gap-1.5 px-4 text-[13px] font-semibold text-white transition-colors duration-[120ms] hover:opacity-90"
        style={{
          background: "var(--color-brand-ink)",
          borderRadius: "var(--radius-sm)",
        }}
      >
        Save Changes
      </button>
      <span
        className="text-[12px] transition-opacity duration-[120ms]"
        style={{
          color: "var(--color-text-faint)",
          opacity: saved ? 1 : 0.6,
        }}
      >
        {saved ? "Saved" : "All changes saved"}
      </span>
    </div>
  );
}

function Divider() {
  return (
    <div
      className="h-px w-full"
      style={{ background: "var(--color-border)" }}
    />
  );
}
