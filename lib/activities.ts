import type { Activity, ActivityType } from "@/data/activities";
import type { Zone } from "@/data/companies";

export const ANY_TYPE = "any";
export const ALL_OWNERS = "all";
export const ALL_COMPANIES = "all";
export const ANY_WINDOW = "all";

export type ActivityFilters = {
  type: string;
  owner: string;
  companyId: string;
  window: string;
  search: string;
};

export const DEFAULT_FILTERS: ActivityFilters = {
  type: ANY_TYPE,
  owner: ALL_OWNERS,
  companyId: ALL_COMPANIES,
  window: ANY_WINDOW,
  search: "",
};

function daysSince(dateIso: string, todayIso: string) {
  const date = new Date(`${dateIso}T00:00:00Z`).getTime();
  const today = new Date(`${todayIso}T00:00:00Z`).getTime();
  return Math.round((today - date) / 86_400_000);
}

export function filterActivities(
  activities: Activity[],
  { type, owner, companyId, window, search }: ActivityFilters,
  todayIso: string,
): Activity[] {
  const query = search.trim().toLowerCase();
  const windowDays = window === ANY_WINDOW ? null : Number(window);

  return activities.filter((activity) => {
    if (type !== ANY_TYPE && activity.type !== (type as ActivityType))
      return false;
    if (owner !== ALL_OWNERS && activity.owner !== owner) return false;
    if (companyId !== ALL_COMPANIES && activity.companyId !== companyId)
      return false;
    if (windowDays !== null && daysSince(activity.date, todayIso) > windowDays)
      return false;
    if (
      query &&
      !activity.companyName.toLowerCase().includes(query) &&
      !activity.note.toLowerCase().includes(query)
    )
      return false;
    return true;
  });
}

export function groupActivitiesByDay(
  activities: Activity[],
): Map<string, Activity[]> {
  const groups = new Map<string, Activity[]>();
  for (const activity of activities) {
    const list = groups.get(activity.date) ?? [];
    list.push(activity);
    groups.set(activity.date, list);
  }
  return groups;
}

export function groupActivitiesByZone(
  activities: Activity[],
): Map<Zone, Activity[]> {
  const groups = new Map<Zone, Activity[]>();
  for (const activity of activities) {
    const list = groups.get(activity.zone) ?? [];
    list.push(activity);
    groups.set(activity.zone, list);
  }
  return groups;
}

export type CalendarDay = {
  date: string;
  day: number;
  inMonth: boolean;
};

export function monthLabel(monthIso: string) {
  const [year, month] = monthIso.split("-").map(Number);
  return new Intl.DateTimeFormat("pt-AO", { month: "long", year: "numeric" })
    .format(new Date(Date.UTC(year, month - 1, 1)))
    .replace(/^\w/, (char) => char.toUpperCase());
}

export function shiftMonth(monthIso: string, delta: number) {
  const [year, month] = monthIso.split("-").map(Number);
  const date = new Date(Date.UTC(year, month - 1 + delta, 1));
  return `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, "0")}`;
}

export function buildMonthGrid(monthIso: string): CalendarDay[][] {
  const [year, month] = monthIso.split("-").map(Number);
  const firstOfMonth = new Date(Date.UTC(year, month - 1, 1));
  const daysInMonth = new Date(Date.UTC(year, month, 0)).getUTCDate();
  const leadingEmpty = (firstOfMonth.getUTCDay() + 6) % 7;

  const cells: CalendarDay[] = [];

  for (let i = leadingEmpty; i > 0; i--) {
    const date = new Date(Date.UTC(year, month - 1, 1 - i));
    cells.push({
      date: date.toISOString().slice(0, 10),
      day: date.getUTCDate(),
      inMonth: false,
    });
  }

  for (let day = 1; day <= daysInMonth; day++) {
    const date = new Date(Date.UTC(year, month - 1, day));
    cells.push({ date: date.toISOString().slice(0, 10), day, inMonth: true });
  }

  while (cells.length % 7 !== 0) {
    const last = cells[cells.length - 1];
    const date = new Date(`${last.date}T00:00:00Z`);
    date.setUTCDate(date.getUTCDate() + 1);
    cells.push({
      date: date.toISOString().slice(0, 10),
      day: date.getUTCDate(),
      inMonth: false,
    });
  }

  const weeks: CalendarDay[][] = [];
  for (let i = 0; i < cells.length; i += 7) {
    weeks.push(cells.slice(i, i + 7));
  }
  return weeks;
}
