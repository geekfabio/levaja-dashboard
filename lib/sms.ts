export const SMS_MESSAGE_UNITS = 120;

export const SMS_PRICE = 20;

export type SmsAnalysis = {
  units: number;
  messages: number;
  remaining: number;
  doubleChars: string[];
};

export function charUnits(char: string) {
  return (char.codePointAt(0) ?? 0) <= 0x7f ? 1 : 2;
}

export function analyzeSms(text: string): SmsAnalysis {
  const doubleChars = new Set<string>();
  let units = 0;

  for (const char of text) {
    const cost = charUnits(char);
    units += cost;
    if (cost === 2) doubleChars.add(char);
  }

  const messages = units === 0 ? 0 : Math.ceil(units / SMS_MESSAGE_UNITS);

  return {
    units,
    messages,
    remaining: Math.max(messages, 1) * SMS_MESSAGE_UNITS - units,
    doubleChars: [...doubleChars],
  };
}

const PLAIN_REPLACEMENTS: Record<string, string> = {
  "“": '"',
  "”": '"',
  "‘": "'",
  "’": "'",
  "–": "-",
  "—": "-",
  "…": "...",
  "º": "o",
  "ª": "a",
  "€": "EUR",
};

export function removeAccents(text: string) {
  let result = "";
  for (const char of text) {
    if (charUnits(char) === 1) {
      result += char;
      continue;
    }
    const mapped =
      PLAIN_REPLACEMENTS[char] ?? char.normalize("NFD").replace(/[̀-ͯ]/g, "");
    result += [...mapped].every((item) => charUnits(item) === 1) ? mapped : char;
  }
  return result;
}

export const OPT_OUT_SUFFIX = " Resp. PARAR p/ sair";

export type SendWindow = {
  start: string;
  end: string;
};

export const DEFAULT_SEND_WINDOW: SendWindow = { start: "08:00", end: "20:00" };

export function isWithinWindow(local: string, window: SendWindow) {
  const time = local.slice(11, 16);
  return time >= window.start && time <= window.end;
}

const SENDER_ID_PATTERN = /^(?=.*[A-Za-z])[A-Za-z0-9 ]{3,11}$/;

export function isValidSenderId(senderId: string) {
  return SENDER_ID_PATTERN.test(senderId);
}
