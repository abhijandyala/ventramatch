/**
 * Pure data helpers for dashboard charts.
 * Kept outside "use client" modules so server components can call them.
 */

type Axis = { label: string; value: number };

export function founderMatchAxes(pct: number): [Axis, Axis, Axis, Axis, Axis] {
  return [
    { label: "Traction", value: Math.min(100, Math.round(pct * 0.8 + 15)) },
    { label: "Team", value: Math.min(100, Math.round(pct * 0.7 + 20)) },
    { label: "Market", value: Math.min(100, Math.round(pct * 0.65 + 10)) },
    { label: "Product", value: Math.min(100, Math.round(pct * 0.85 + 8)) },
    { label: "Fundraise", value: Math.min(100, Math.round(pct * 0.55 + 22)) },
  ];
}

export function investorMatchAxes(pct: number): [Axis, Axis, Axis, Axis, Axis] {
  return [
    { label: "Thesis", value: Math.min(100, Math.round(pct * 0.8 + 10)) },
    { label: "Portfolio", value: Math.min(100, Math.round(pct * 0.6 + 18)) },
    { label: "Sectors", value: Math.min(100, Math.round(pct * 0.9 + 5)) },
    { label: "Activity", value: Math.min(100, Math.round(pct * 0.5 + 28)) },
    { label: "Track record", value: Math.min(100, Math.round(pct * 0.7 + 12)) },
  ];
}

type LineSeries = { label: string; color: string; data: number[] };

const WEEK_LABELS = [
  "Mar 3", "Mar 10", "Mar 17", "Mar 24",
  "Mar 31", "Apr 7", "Apr 14", "Apr 21",
  "Apr 28", "May 5", "May 12", "May 19",
];

export const founderPerformanceData = {
  periods: WEEK_LABELS,
  title: "Profile performance",
  lines: [
    { label: "Views",    color: "var(--color-brand)", data: [84, 97, 112, 103, 131, 118, 142, 155, 148, 173, 164, 189] },
    { label: "Saves",    color: "#6366f1",            data: [11, 14, 18, 15, 22, 19, 26, 31, 28, 35, 33, 41] },
    { label: "Matches",  color: "#f59e0b",            data: [2, 3, 4, 3, 5, 4, 7, 6, 8, 9, 7, 11] },
    { label: "Messages", color: "#94a3b8",            data: [1, 1, 2, 2, 3, 2, 4, 3, 5, 4, 6, 5] },
  ] as [LineSeries, LineSeries, LineSeries, LineSeries],
};

export const investorPerformanceData = {
  periods: WEEK_LABELS,
  title: "Deal flow performance",
  lines: [
    { label: "Startups viewed", color: "var(--color-brand)", data: [22, 28, 31, 26, 38, 33, 41, 44, 39, 52, 47, 58] },
    { label: "Saved",           color: "#6366f1",            data: [5, 7, 9, 7, 12, 10, 14, 16, 13, 19, 17, 22] },
    { label: "Intros sent",     color: "#f59e0b",            data: [1, 2, 2, 1, 3, 2, 4, 3, 4, 5, 4, 6] },
    { label: "Meetings",        color: "#94a3b8",            data: [0, 1, 1, 0, 1, 1, 2, 1, 2, 2, 3, 2] },
  ] as [LineSeries, LineSeries, LineSeries, LineSeries],
};
