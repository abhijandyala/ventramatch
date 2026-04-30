"use client";

import { useState, useRef, useEffect } from "react";
import type { Route } from "next";
import Link from "next/link";
import { signOut } from "next-auth/react";
import {
  User,
  Settings,
  HelpCircle,
  MessageSquare,
  LogOut,
  ChevronDown,
} from "lucide-react";

type Role = "founder" | "investor" | null;

type ProfileDropdownProps = {
  role: Role;
  name: string;
};

export function ProfileDropdown({ role, name }: ProfileDropdownProps) {
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  const initials = name
    ? name
        .split(" ")
        .slice(0, 2)
        .map((n) => n[0])
        .join("")
        .toUpperCase()
    : "VM";

  useEffect(() => {
    function handleOutsideClick(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    function handleEscape(e: KeyboardEvent) {
      if (e.key === "Escape") setOpen(false);
    }
    if (open) {
      document.addEventListener("mousedown", handleOutsideClick);
      document.addEventListener("keydown", handleEscape);
    }
    return () => {
      document.removeEventListener("mousedown", handleOutsideClick);
      document.removeEventListener("keydown", handleEscape);
    };
  }, [open]);

  return (
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

      <div ref={containerRef} className="relative">
        <button
          onClick={() => setOpen((v) => !v)}
          aria-label="Account menu"
          aria-expanded={open}
          aria-haspopup="menu"
          className="flex h-9 items-center gap-1 shrink-0 transition-opacity duration-[120ms] hover:opacity-75"
        >
          <div
            className="grid h-9 w-9 place-items-center font-mono text-[11px] font-semibold uppercase tracking-tight"
            style={{
              background: "var(--color-brand-tint)",
              color: "var(--color-brand-strong)",
              borderRadius: "8px",
              boxShadow: "0 0 0 1px var(--color-border)",
            }}
          >
            {initials}
          </div>
          <ChevronDown
            size={12}
            strokeWidth={2}
            className="transition-transform duration-[120ms]"
            style={{
              color: "var(--color-text-faint)",
              transform: open ? "rotate(180deg)" : "rotate(0deg)",
            }}
          />
        </button>

        {open && (
          <div
            role="menu"
            className="absolute right-0 top-[calc(100%+6px)] z-50 w-56 overflow-hidden"
            style={{
              background: "var(--color-bg)",
              border: "1px solid var(--color-border)",
              borderRadius: "14px",
              boxShadow:
                "0 8px 32px -12px oklch(22% 0.04 235 / 0.16), 0 2px 6px -2px oklch(22% 0.04 235 / 0.08)",
            }}
          >
            {/* Name + role header */}
            {name && (
              <div
                className="px-4 py-3"
                style={{ borderBottom: "1px solid var(--color-border)" }}
              >
                <p
                  className="truncate text-[13px] font-semibold"
                  style={{ color: "var(--color-text)" }}
                >
                  {name}
                </p>
                {role && (
                  <p
                    className="mt-0.5 text-[11px] capitalize"
                    style={{ color: "var(--color-text-faint)" }}
                  >
                    {role}
                  </p>
                )}
              </div>
            )}

            {/* Profile + Settings */}
            <div className="py-1">
              <MenuLink
                icon={User}
                label="Profile"
                href="/profile"
                onClick={() => setOpen(false)}
              />
              <MenuLink
                icon={Settings}
                label="Settings"
                href={"/profile?tab=settings" as Route}
                onClick={() => setOpen(false)}
              />
            </div>

            {/* Help + Feedback */}
            <div
              className="py-1"
              style={{ borderTop: "1px solid var(--color-border)" }}
            >
              <MenuLink
                icon={HelpCircle}
                label="Help & support"
                href="/help"
                onClick={() => setOpen(false)}
              />
              <MenuLink
                icon={MessageSquare}
                label="Send feedback"
                href="/feedback"
                onClick={() => setOpen(false)}
              />
            </div>

            {/* Sign out */}
            <div
              className="py-1"
              style={{ borderTop: "1px solid var(--color-border)" }}
            >
              <button
                role="menuitem"
                onClick={() => {
                  setOpen(false);
                  void signOut({ callbackUrl: "/" });
                }}
                className="flex w-full items-center gap-2.5 px-4 py-2 text-[13px] transition-colors duration-[120ms] hover:bg-[var(--color-surface-2)]"
                style={{ color: "var(--color-danger)" }}
              >
                <LogOut size={14} strokeWidth={1.75} />
                Sign out
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function MenuLink({
  icon: Icon,
  label,
  href,
  onClick,
  external,
}: {
  icon: React.ElementType;
  label: string;
  href: string;
  onClick: () => void;
  external?: boolean;
}) {
  if (external) {
    return (
      <a
        href={href}
        role="menuitem"
        onClick={onClick}
        className="flex items-center gap-2.5 px-4 py-2 text-[13px] transition-colors duration-[120ms] hover:bg-[var(--color-surface-2)]"
        style={{ color: "var(--color-text-muted)" }}
      >
        <Icon size={14} strokeWidth={1.75} />
        {label}
      </a>
    );
  }

  return (
    <Link
      href={href as Route}
      role="menuitem"
      onClick={onClick}
      className="flex items-center gap-2.5 px-4 py-2 text-[13px] transition-colors duration-[120ms] hover:bg-[var(--color-surface-2)]"
      style={{ color: "var(--color-text-muted)" }}
    >
      <Icon size={14} strokeWidth={1.75} />
      {label}
    </Link>
  );
}
