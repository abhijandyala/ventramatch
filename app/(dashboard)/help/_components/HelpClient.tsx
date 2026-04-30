"use client";

import { useState } from "react";
import type { Route } from "next";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  ChevronDown,
  Zap,
  Users,
  BarChart2,
  Lock,
  Mail,
  MessageSquare,
  BookOpen,
  Lightbulb,
  ShieldCheck,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Wordmark } from "@/components/landing/wordmark";
import { ProfileDropdown } from "@/components/layout/ProfileDropdown";

type Role = "founder" | "investor" | null;

const NAV_LINKS = [
  { label: "Feed", href: "/feed" },
  { label: "Matches", href: "/matches" },
  { label: "Profiles", href: "/profile" },
  { label: "Dashboard", href: "/dashboard" },
];

const FAQS: Array<{ q: string; a: string }> = [
  {
    q: "How does VentraMatch calculate my match score?",
    a: "Every founder–investor pair is scored on five signals: sector fit, stage alignment, check size overlap, geographic match, and traction relative to the investor's last 10 deals. Each signal is weighted by how much that investor historically filters on it. The overall score is a weighted average, shown as a percentage with a one-line reason.",
  },
  {
    q: "Who can see my profile?",
    a: "Investors can see your startup profile if you have at least one Profiles tab complete and have Visible to Investors turned on in Settings. They see your name, sector, stage, and match score — not your contact details. Contact is only shared after mutual interest.",
  },
  {
    q: "What does 'mutual interest' mean?",
    a: "Both you and the investor have clicked Interested on each other's profile. Neither side sees who liked them individually until both have expressed interest — that moment unlocks contact details for both parties.",
  },
  {
    q: "Why is my match score lower than expected?",
    a: "Scores drop when key profile fields are empty. The most common gaps are: missing traction data, no check size range on investor profiles, and sector tags that are too broad. Go to Profiles → Founder Profile and fill out the Traction section first — that field has the highest weight.",
  },
  {
    q: "How do I improve my profile completion?",
    a: "Open Profiles and look at the completion gauge on the right. Each incomplete section has a percentage. Start with Founder Profile — it carries the most weight in matches. Upload a profile photo and add at least three traction data points (MRR, users, or growth rate).",
  },
  {
    q: "Can investors contact me directly?",
    a: "Only after mutual interest is established. Neither side can message first. Once both click Interested, each party sees the other's email address. We don't operate a built-in chat — that keeps things fast and direct.",
  },
  {
    q: "How do I change my role from Founder to Investor?",
    a: "Role is set during onboarding and tied to your account type. If you need to switch, email support@ventramatch.com with your registered email address and the role you want. We'll update it manually and confirm within one business day.",
  },
  {
    q: "Is VentraMatch free to use?",
    a: "The platform is currently in private beta and free for all users. Pricing for investor-tier accounts is being worked out. You'll be notified before any paid features go live, and early beta users will receive preferential terms.",
  },
];

const GUIDES = [
  {
    icon: Users,
    title: "Complete your founder profile",
    desc: "The five fields that move your score the most, in order.",
    href: "/profile",
  },
  {
    icon: Zap,
    title: "Reading your match score",
    desc: "What the percentage means and how to act on it.",
    href: "/feed",
  },
  {
    icon: BarChart2,
    title: "Understanding your dashboard",
    desc: "Profile strength, match activity, and readiness gaps.",
    href: "/dashboard",
  },
  {
    icon: Lock,
    title: "Privacy and visibility",
    desc: "Who sees what, and how to control your exposure.",
    href: "/profile?tab=settings",
  },
];

// ---------------------------------------------------------------------------
// Main export
// ---------------------------------------------------------------------------

export function HelpClient({
  role,
  name,
  userId,
  avatarSrc,
}: {
  role: Role;
  name: string;
  userId?: string;
  avatarSrc?: string | null;
}) {
  return (
    <div className="min-h-screen" style={{ background: "var(--color-bg)" }}>
      <AppNav role={role} name={name} userId={userId} avatarSrc={avatarSrc} />

      {/* Page header */}
      <section
        className="border-b"
        style={{ borderColor: "var(--color-border)" }}
      >
        <div className="mx-auto w-full max-w-[1440px] px-4 sm:px-6 py-8 sm:py-10">
          <div className="flex items-center gap-2 mb-3">
            <BookOpen
              size={16}
              strokeWidth={1.75}
              style={{ color: "var(--color-brand-ink)" }}
            />
            <span
              className="text-[12px] font-medium uppercase tracking-[0.06em]"
              style={{ color: "var(--color-brand-ink)" }}
            >
              Help center
            </span>
          </div>
          <h1
            className="text-[24px] font-semibold tracking-[-0.015em]"
            style={{ color: "var(--color-text)" }}
          >
            How can we help?
          </h1>
          <p
            className="mt-1.5 text-[14px]"
            style={{ color: "var(--color-text-muted)" }}
          >
            Answers to common questions about matching, profiles, and how the
            platform works.
          </p>
        </div>
      </section>

      <div className="mx-auto w-full max-w-[1440px] px-4 sm:px-6 py-8 sm:py-10">
        <div className="grid grid-cols-1 gap-8 lg:grid-cols-[1fr_340px]">
          {/* Left column: FAQ */}
          <div>
            <h2
              className="mb-4 text-[13px] font-semibold uppercase tracking-[0.06em]"
              style={{ color: "var(--color-text-faint)" }}
            >
              Frequently asked questions
            </h2>
            <div
              className="overflow-hidden divide-y divide-[var(--color-border)]"
              style={{
                border: "1px solid var(--color-border)",
                borderRadius: "14px",
              }}
            >
              {FAQS.map((item, i) => (
                <FaqItem key={i} q={item.q} a={item.a} />
              ))}
            </div>
          </div>

          {/* Right column: guides + contact */}
          <div className="flex flex-col gap-6">
            {/* Quick start guides */}
            <div>
              <h2
                className="mb-4 text-[13px] font-semibold uppercase tracking-[0.06em]"
                style={{ color: "var(--color-text-faint)" }}
              >
                Quick guides
              </h2>
              <div className="flex flex-col gap-2">
                {GUIDES.map((g) => (
                  <Link
                    key={g.href}
                    href={g.href as Route}
                    className="group flex items-start gap-3 rounded-[10px] px-4 py-3 transition-colors duration-[120ms]"
                    style={{
                      border: "1px solid var(--color-border)",
                      background: "var(--color-surface)",
                    }}
                    onMouseEnter={(e) => {
                      (e.currentTarget as HTMLAnchorElement).style.background =
                        "var(--color-surface-2)";
                    }}
                    onMouseLeave={(e) => {
                      (e.currentTarget as HTMLAnchorElement).style.background =
                        "var(--color-surface)";
                    }}
                  >
                    <g.icon
                      size={16}
                      strokeWidth={1.75}
                      className="mt-0.5 shrink-0"
                      style={{ color: "var(--color-brand-ink)" }}
                    />
                    <div>
                      <p
                        className="text-[13px] font-medium"
                        style={{ color: "var(--color-text)" }}
                      >
                        {g.title}
                      </p>
                      <p
                        className="mt-0.5 text-[12px]"
                        style={{ color: "var(--color-text-muted)" }}
                      >
                        {g.desc}
                      </p>
                    </div>
                  </Link>
                ))}
              </div>
            </div>

            {/* Contact + tips */}
            <div
              className="rounded-[14px] p-5"
              style={{
                border: "1px solid var(--color-border)",
                background: "var(--color-surface)",
              }}
            >
              <div className="flex items-center gap-2 mb-3">
                <Lightbulb
                  size={15}
                  strokeWidth={1.75}
                  style={{ color: "var(--color-brand-ink)" }}
                />
                <p
                  className="text-[13px] font-semibold"
                  style={{ color: "var(--color-text)" }}
                >
                  Fastest way to get help
                </p>
              </div>
              <ol className="flex flex-col gap-2">
                {[
                  "Check the FAQ above — most questions are answered there.",
                  "Search your Profiles settings — most visibility issues are a toggle away.",
                  "Still stuck? Email us and we respond within one business day.",
                ].map((tip, i) => (
                  <li key={i} className="flex items-start gap-2.5">
                    <span
                      className="mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center rounded-full text-[10px] font-semibold"
                      style={{
                        background: "var(--color-brand-tint)",
                        color: "var(--color-brand-ink)",
                      }}
                    >
                      {i + 1}
                    </span>
                    <p
                      className="text-[13px]"
                      style={{ color: "var(--color-text-muted)" }}
                    >
                      {tip}
                    </p>
                  </li>
                ))}
              </ol>
            </div>

            {/* Contact cards */}
            <div className="flex flex-col gap-2">
              <ContactCard
                icon={Mail}
                label="Email support"
                sub="support@ventramatch.com"
                note="Replies within 1 business day"
                href="mailto:support@ventramatch.com"
              />
              <ContactCard
                icon={MessageSquare}
                label="Send feedback"
                sub="Feature requests and bug reports"
                note="Shapes the next release"
                href="/feedback"
              />
              <ContactCard
                icon={ShieldCheck}
                label="Report a security issue"
                sub="security@ventramatch.com"
                note="Handled confidentially"
                href="mailto:security@ventramatch.com"
              />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// FAQ item
// ---------------------------------------------------------------------------

function FaqItem({ q, a }: { q: string; a: string }) {
  const [open, setOpen] = useState(false);

  return (
    <button
      onClick={() => setOpen((v) => !v)}
      className="w-full text-left"
      aria-expanded={open}
    >
      <div
        className="flex items-center justify-between gap-4 px-5 py-4 transition-colors duration-[120ms]"
        style={{
          background: open ? "var(--color-surface)" : "var(--color-bg)",
        }}
      >
        <span
          className="text-[14px] font-medium"
          style={{ color: "var(--color-text)" }}
        >
          {q}
        </span>
        <ChevronDown
          size={15}
          strokeWidth={2}
          className="shrink-0 transition-transform duration-[120ms]"
          style={{
            color: "var(--color-text-faint)",
            transform: open ? "rotate(180deg)" : "rotate(0deg)",
          }}
        />
      </div>
      {open && (
        <div
          className="px-5 pb-4"
          style={{ background: "var(--color-surface)" }}
        >
          <p
            className="text-[13px] leading-[1.65]"
            style={{ color: "var(--color-text-muted)" }}
          >
            {a}
          </p>
        </div>
      )}
    </button>
  );
}

// ---------------------------------------------------------------------------
// Contact card
// ---------------------------------------------------------------------------

function ContactCard({
  icon: Icon,
  label,
  sub,
  note,
  href,
}: {
  icon: React.ElementType;
  label: string;
  sub: string;
  note: string;
  href: string;
}) {
  const isExternal = href.startsWith("mailto:");
  const cls =
    "flex items-start gap-3 rounded-[10px] px-4 py-3 transition-colors duration-[120ms]";
  const style = {
    border: "1px solid var(--color-border)",
    background: "var(--color-surface)",
  };
  const inner = (
    <>
      <Icon
        size={15}
        strokeWidth={1.75}
        className="mt-0.5 shrink-0"
        style={{ color: "var(--color-brand-ink)" }}
      />
      <div>
        <p
          className="text-[13px] font-medium"
          style={{ color: "var(--color-text)" }}
        >
          {label}
        </p>
        <p className="mt-0.5 text-[12px]" style={{ color: "var(--color-text-muted)" }}>
          {sub}
        </p>
        <p className="mt-0.5 text-[11px]" style={{ color: "var(--color-text-faint)" }}>
          {note}
        </p>
      </div>
    </>
  );

  if (isExternal) {
    return (
      <a href={href} className={cls} style={style}>
        {inner}
      </a>
    );
  }

  return (
    <Link href={href as Route} className={cls} style={style}>
      {inner}
    </Link>
  );
}

// ---------------------------------------------------------------------------
// App nav
// ---------------------------------------------------------------------------

function AppNav({
  role,
  name,
  userId,
  avatarSrc,
}: {
  role: Role;
  name: string;
  userId?: string;
  avatarSrc?: string | null;
}) {
  const pathname = usePathname();

  return (
    <header
      className="sticky top-0 z-40 border-b"
      style={{ borderColor: "var(--color-border)", background: "var(--color-bg)" }}
    >
      <div className="mx-auto flex h-16 max-w-[1440px] items-center justify-between gap-6 px-4 sm:px-6">
        <div className="flex items-center gap-8">
          <Wordmark size="md" />
          <nav aria-label="Primary" className="hidden items-center gap-6 md:flex">
            {NAV_LINKS.map((link) => (
              <Link
                key={link.href}
                href={link.href as Route}
                className={cn(
                  "text-[14px] transition-colors duration-[120ms]",
                  pathname === link.href || pathname.startsWith(`${link.href}/`)
                    ? "font-semibold text-[var(--color-text)]"
                    : "text-[var(--color-text-muted)] hover:text-[var(--color-text)]",
                )}
              >
                {link.label}
              </Link>
            ))}
          </nav>
        </div>
        <ProfileDropdown role={role} name={name} userId={userId} avatarSrc={avatarSrc} />
      </div>
    </header>
  );
}
