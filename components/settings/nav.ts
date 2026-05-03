export type NavItem = {
  href: string;
  label: string;
};

export type NavGroup = {
  label: string;
  items: NavItem[];
};

export const SETTINGS_NAV_GROUPS: NavGroup[] = [
  {
    label: "Account",
    items: [
      { href: "/settings/account",       label: "Account" },
      { href: "/settings/discovery",     label: "Discovery" },
      { href: "/settings/notifications", label: "Notifications" },
      { href: "/settings/security",      label: "Sign-in" },
    ],
  },
  {
    label: "Product",
    items: [
      { href: "/settings/integrations",  label: "Integrations" },
    ],
  },
  {
    label: "Privacy & safety",
    items: [
      { href: "/settings/privacy",       label: "Privacy" },
      { href: "/settings/safety",        label: "Safety" },
    ],
  },
  {
    label: "Account actions",
    items: [
      { href: "/settings/danger",        label: "Danger zone" },
    ],
  },
];

// Flat list for mobile nav and other consumers that just need href + label.
export const SETTINGS_NAV: NavItem[] = SETTINGS_NAV_GROUPS.flatMap((g) => g.items);
