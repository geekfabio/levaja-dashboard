const MONEY_FORMATTER = new Intl.NumberFormat("pt-AO", {
  style: "currency",
  currency: "AOA",
  maximumFractionDigits: 0,
});

const NUMBER_FORMATTER = new Intl.NumberFormat("pt-AO");

const PERCENT_FORMATTER = new Intl.NumberFormat("pt-AO", {
  style: "percent",
  maximumFractionDigits: 0,
});

const SHORT_DATE_FORMATTER = new Intl.DateTimeFormat("pt-AO", {
  timeZone: "Africa/Luanda",
  day: "2-digit",
  month: "2-digit",
});

const LONG_DATE_FORMATTER = new Intl.DateTimeFormat("pt-AO", {
  timeZone: "Africa/Luanda",
  day: "numeric",
  month: "long",
  year: "numeric",
});

const DATE_TIME_FORMATTER = new Intl.DateTimeFormat("pt-AO", {
  timeZone: "Africa/Luanda",
  day: "numeric",
  month: "long",
  year: "numeric",
  hour: "2-digit",
  minute: "2-digit",
});

export const LUANDA_OFFSET = "+01:00";

export function luandaLocalToDate(local: string) {
  return new Date(`${local}:00${LUANDA_OFFSET}`);
}

export function formatDateTime(local: string) {
  return DATE_TIME_FORMATTER.format(luandaLocalToDate(local));
}

export function formatMoney(value: number) {
  return MONEY_FORMATTER.format(value);
}

export function formatNumber(value: number) {
  return NUMBER_FORMATTER.format(value);
}

export function formatPercent(value: number) {
  return PERCENT_FORMATTER.format(value / 100);
}

const PERCENT_DECIMAL_FORMATTER = new Intl.NumberFormat("pt-AO", {
  style: "percent",
  maximumFractionDigits: 1,
});

export function formatPercentDecimal(value: number) {
  return PERCENT_DECIMAL_FORMATTER.format(value / 100);
}

export function formatDateShort(iso: string) {
  return SHORT_DATE_FORMATTER.format(new Date(`${iso}T00:00:00Z`));
}

export function formatDateLong(iso: string) {
  return LONG_DATE_FORMATTER.format(new Date(`${iso}T00:00:00Z`));
}

export function compactMoneyParts(value: number) {
  const abs = Math.abs(value);
  if (abs >= 1_000_000) {
    return { amount: Math.round((value / 1_000_000) * 10) / 10, suffix: "M Kz" };
  }
  if (abs >= 1_000) {
    return { amount: Math.round((value / 1_000) * 10) / 10, suffix: "mil Kz" };
  }
  return { amount: Math.round(value), suffix: "Kz" };
}

const TIME_FORMATTER = new Intl.DateTimeFormat("pt-AO", {
  timeZone: "Africa/Luanda",
  hour: "2-digit",
  minute: "2-digit",
});

const SHORT_DATE_TIME_FORMATTER = new Intl.DateTimeFormat("pt-AO", {
  timeZone: "Africa/Luanda",
  day: "2-digit",
  month: "2-digit",
  hour: "2-digit",
  minute: "2-digit",
});

const RELATIVE_FORMATTER = new Intl.RelativeTimeFormat("pt-AO", { numeric: "auto" });

const MINUTE = 60 * 1000;
const HOUR = 60 * MINUTE;
const DAY = 24 * HOUR;

export function nowLuandaLocal(date = new Date()) {
  return new Date(date.getTime() + HOUR).toISOString().slice(0, 16);
}

export function formatTime(local: string) {
  return TIME_FORMATTER.format(luandaLocalToDate(local));
}

export function formatDateTimeShort(local: string) {
  return SHORT_DATE_TIME_FORMATTER.format(luandaLocalToDate(local));
}

export function formatRelative(local: string, now: number) {
  const diff = luandaLocalToDate(local).getTime() - now;
  const abs = Math.abs(diff);
  if (abs < MINUTE) return "agora mesmo";
  if (abs < HOUR) return RELATIVE_FORMATTER.format(Math.round(diff / MINUTE), "minute");
  if (abs < DAY) return RELATIVE_FORMATTER.format(Math.round(diff / HOUR), "hour");
  if (abs < 7 * DAY) return RELATIVE_FORMATTER.format(Math.round(diff / DAY), "day");
  return formatDateShort(local.slice(0, 10));
}

export function formatDuration(ms: number) {
  const minutes = Math.max(0, Math.round(Math.abs(ms) / MINUTE));
  if (minutes < 60) return `${minutes} min`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) {
    const rest = minutes % 60;
    return rest ? `${hours} h ${rest} min` : `${hours} h`;
  }
  const days = Math.floor(hours / 24);
  const restHours = hours % 24;
  return restHours ? `${days} d ${restHours} h` : `${days} d`;
}

export function formatDayHeading(day: string, now: number | null) {
  if (now !== null) {
    const today = nowLuandaLocal(new Date(now)).slice(0, 10);
    const yesterday = nowLuandaLocal(new Date(now - DAY)).slice(0, 10);
    if (day === today) return "Hoje";
    if (day === yesterday) return "Ontem";
  }
  return formatDateLong(day);
}

const COMPACT_FORMATTER = new Intl.NumberFormat("pt-AO", { maximumFractionDigits: 1 });

export function formatMoneyCompact(value: number) {
  const { amount, suffix } = compactMoneyParts(value);
  return `${COMPACT_FORMATTER.format(amount)} ${suffix}`;
}

export function plural(count: number, singular: string, pluralForm: string) {
  return `${formatNumber(count)} ${count === 1 ? singular : pluralForm}`;
}

const NBSP = " ";

export function groupThousands(value: number) {
  const rounded = Math.round(value);
  const digits = String(Math.abs(rounded)).replace(/\B(?=(\d{3})+(?!\d))/g, NBSP);
  return rounded < 0 ? `−${digits}` : digits;
}

export function formatKz(value: number) {
  return `${groupThousands(value)}${NBSP}Kz`;
}

const NUMERIC_PARTS_FORMATTER = new Intl.DateTimeFormat("en-GB", {
  timeZone: "Africa/Luanda",
  day: "2-digit",
  month: "2-digit",
  year: "numeric",
  hour: "2-digit",
  minute: "2-digit",
  hourCycle: "h23",
});

function luandaParts(iso: string) {
  const parts = NUMERIC_PARTS_FORMATTER.formatToParts(new Date(iso));
  const get = (type: Intl.DateTimeFormatPartTypes) => parts.find((part) => part.type === type)?.value ?? "";
  return { day: get("day"), month: get("month"), year: get("year"), hour: get("hour"), minute: get("minute") };
}

export function formatDateTimeNumeric(iso: string) {
  const { day, month, year, hour, minute } = luandaParts(iso);
  return `${day}/${month}/${year} ${hour}:${minute}`;
}

export function formatDateNumeric(iso: string) {
  const { day, month, year } = luandaParts(iso.length === 10 ? `${iso}T12:00:00Z` : iso);
  return `${day}/${month}/${year}`;
}

export function luandaDay(iso: string | Date) {
  const { day, month, year } = luandaParts(typeof iso === "string" ? iso : iso.toISOString());
  return `${year}-${month}-${day}`;
}

const DECIMAL_FORMATTERS = new Map<number, Intl.NumberFormat>();

export function formatDecimal(value: number, digits = 1) {
  let formatter = DECIMAL_FORMATTERS.get(digits);
  if (!formatter) {
    formatter = new Intl.NumberFormat("pt-PT", { minimumFractionDigits: digits, maximumFractionDigits: digits });
    DECIMAL_FORMATTERS.set(digits, formatter);
  }
  return formatter.format(value);
}

export function formatKm(value: number) {
  return `${formatDecimal(value, 1)}${NBSP}km`;
}

export function formatMinutes(value: number) {
  if (value < 60) return `${Math.round(value)}${NBSP}min`;
  const hours = Math.floor(value / 60);
  const minutes = Math.round(value % 60);
  return minutes ? `${hours}${NBSP}h ${minutes}${NBSP}min` : `${hours}${NBSP}h`;
}

export function formatElapsed(fromIso: string, now: number) {
  const minutes = Math.max(0, (now - Date.parse(fromIso)) / 60_000);
  if (minutes < 1) return "menos de 1 min";
  if (minutes >= 48 * 60) return `${Math.floor(minutes / (24 * 60))} dias`;
  return formatMinutes(minutes);
}

export function shiftDay(day: string, days: number) {
  const date = new Date(`${day}T12:00:00Z`);
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
}
