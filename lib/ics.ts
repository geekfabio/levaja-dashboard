export type CalendarEvent = {
  uid: string;
  date: string;
  title: string;
  description?: string;
  location?: string;
};

function escapeText(value: string) {
  return value.replace(/\\/g, "\\\\").replace(/;/g, "\;").replace(/,/g, "\\,").replace(/\r?\n/g, "\\n");
}

function fold(line: string) {
  const parts: string[] = [];
  let rest = line;
  while (rest.length > 74) {
    parts.push(rest.slice(0, 74));
    rest = ` ${rest.slice(74)}`;
  }
  parts.push(rest);
  return parts.join("\r\n");
}

function compactDate(date: string) {
  return date.replace(/-/g, "");
}

function nextDay(date: string) {
  return new Date(Date.parse(`${date}T00:00:00Z`) + 86_400_000).toISOString().slice(0, 10);
}

export function buildIcs(events: CalendarEvent[], calendarName: string, stamp: string) {
  const lines = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//Alimenta Angola//CRM//PT",
    "CALSCALE:GREGORIAN",
    "METHOD:PUBLISH",
    `X-WR-CALNAME:${escapeText(calendarName)}`,
    "X-WR-TIMEZONE:Africa/Luanda",
    ...events.flatMap((event) => [
      "BEGIN:VEVENT",
      `UID:${event.uid}@crm.alimentaangola.co.ao`,
      `DTSTAMP:${stamp}`,
      `DTSTART;VALUE=DATE:${compactDate(event.date)}`,
      `DTEND;VALUE=DATE:${compactDate(nextDay(event.date))}`,
      `SUMMARY:${escapeText(event.title)}`,
      ...(event.description ? [`DESCRIPTION:${escapeText(event.description)}`] : []),
      ...(event.location ? [`LOCATION:${escapeText(event.location)}`] : []),
      "END:VEVENT",
    ]),
    "END:VCALENDAR",
  ];
  return `${lines.map(fold).join("\r\n")}\r\n`;
}

export function downloadIcs(filename: string, content: string) {
  const url = URL.createObjectURL(new Blob([content], { type: "text/calendar;charset=utf-8" }));
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}
