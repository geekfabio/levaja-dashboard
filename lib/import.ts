import {
  EMPTY_PROFILE,
  PAYMENT_TERMS,
  SEGMENTS,
  type Company,
  type CompanyProfile,
  type PaymentTerm,
  type Segment,
} from "@/data/companies";
import { findByNif } from "./company-profile";
import { isValidNif, normalizeNif } from "./nif";
import { formatAngolanPhone, normalizeAngolanPhone } from "./phone";

export function detectDelimiter(firstLine: string) {
  const counts = [";", ",", "\t"].map((delimiter) => [delimiter, firstLine.split(delimiter).length] as const);
  return counts.sort((a, b) => b[1] - a[1])[0][0];
}

export function parseCsv(text: string): string[][] {
  const clean = text.replace(/^﻿/, "");
  const delimiter = detectDelimiter(clean.split(/\r?\n/, 1)[0] ?? "");
  const rows: string[][] = [];
  let row: string[] = [];
  let cell = "";
  let quoted = false;

  for (let index = 0; index < clean.length; index++) {
    const char = clean[index];
    if (quoted) {
      if (char === '"' && clean[index + 1] === '"') {
        cell += '"';
        index++;
      } else if (char === '"') {
        quoted = false;
      } else {
        cell += char;
      }
      continue;
    }
    if (char === '"' && cell === "") {
      quoted = true;
    } else if (char === delimiter) {
      row.push(cell);
      cell = "";
    } else if (char === "\n" || char === "\r") {
      if (char === "\r" && clean[index + 1] === "\n") index++;
      row.push(cell);
      rows.push(row);
      row = [];
      cell = "";
    } else {
      cell += char;
    }
  }
  if (cell !== "" || row.length > 0) {
    row.push(cell);
    rows.push(row);
  }
  return rows
    .map((cells) => cells.map((value) => value.trim()))
    .filter((cells) => cells.some((value) => value !== ""));
}

export const IMPORT_FIELDS = [
  { key: "name", label: "Nome do cliente", required: true, aliases: ["nome", "cliente", "empresa", "razao social", "nome do cliente"] },
  { key: "nif", label: "NIF", aliases: ["nif", "contribuinte", "numero de contribuinte"] },
  { key: "segment", label: "Segmento", aliases: ["segmento", "tipo", "tipo de cliente"] },
  { key: "zone", label: "Zona", aliases: ["zona", "provincia", "regiao"] },
  { key: "owner", label: "Gestor de conta", aliases: ["gestor", "gestor de conta", "vendedor", "comercial"] },
  { key: "phone", label: "Telefone do cliente", aliases: ["telefone", "telemovel", "tel", "contacto telefonico"] },
  { key: "billingEmail", label: "E-mail de faturação", aliases: ["email", "e-mail", "email de faturacao", "e-mail de faturacao"] },
  { key: "address", label: "Morada", aliases: ["morada", "endereco", "rua"] },
  { key: "municipality", label: "Município", aliases: ["municipio", "cidade", "localidade"] },
  { key: "paymentTerms", label: "Condições de pagamento", aliases: ["condicoes", "condicoes de pagamento", "pagamento", "prazo"] },
  { key: "creditLimit", label: "Limite de crédito", aliases: ["limite", "limite de credito", "credito"] },
  { key: "contactName", label: "Nome do contacto", aliases: ["contacto", "nome do contacto", "pessoa de contacto"] },
  { key: "contactRole", label: "Cargo do contacto", aliases: ["cargo", "funcao"] },
  { key: "contactPhone", label: "Telefone do contacto", aliases: ["telefone do contacto", "telemovel do contacto"] },
  { key: "contactEmail", label: "E-mail do contacto", aliases: ["email do contacto", "e-mail do contacto"] },
] as const;

export type ImportField = (typeof IMPORT_FIELDS)[number]["key"];

export type ImportMapping = Partial<Record<ImportField, number>>;

function simplify(value: string) {
  return value
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[_.]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

export function guessMapping(headers: string[]): ImportMapping {
  const mapping: ImportMapping = {};
  const used = new Set<number>();
  const simplified = headers.map(simplify);
  for (const field of IMPORT_FIELDS) {
    const exact = simplified.findIndex(
      (header, index) => !used.has(index) && (field.aliases as readonly string[]).includes(header),
    );
    if (exact >= 0) {
      mapping[field.key] = exact;
      used.add(exact);
    }
  }
  return mapping;
}

export type ImportAction = "criar" | "atualizar" | "ignorar";

export type ImportRow = {
  line: number;
  name: string;
  segment: Segment;
  zone: string;
  owner: string;
  profile: CompanyProfile;
  contact?: { name: string; role: string; phone: string; email: string };
  action: ImportAction;
  matchId?: string;
  matchName?: string;
  errors: string[];
  warnings: string[];
};

type AnalyzeContext = {
  companies: Company[];
  zones: string[];
  owners: string[];
  today: string;
};

function parseAmount(value: string) {
  const digits = value.replace(/[^\d,.-]/g, "").replace(/\.(?=\d{3}(\D|$))/g, "").replace(",", ".");
  const amount = Number(digits);
  return Number.isFinite(amount) ? Math.max(0, Math.round(amount)) : NaN;
}

function pick<T extends string>(value: string, options: readonly T[]): T | undefined {
  const wanted = simplify(value);
  return options.find((option) => simplify(option) === wanted || simplify(option).startsWith(wanted));
}

export function analyzeRows(rows: string[][], mapping: ImportMapping, context: AnalyzeContext): ImportRow[] {
  const get = (cells: string[], key: ImportField) => {
    const index = mapping[key];
    return index === undefined ? "" : (cells[index] ?? "").trim();
  };
  const seenNifs = new Map<string, number>();
  const seenNames = new Map<string, number>();
  const existingNames = new Map(context.companies.map((company) => [simplify(company.name), company]));

  return rows.map((cells, index) => {
    const line = index + 2;
    const errors: string[] = [];
    const warnings: string[] = [];
    const name = get(cells, "name");
    if (!name) errors.push("Falta o nome do cliente.");

    const rawNif = get(cells, "nif");
    const nif = rawNif ? normalizeNif(rawNif) : "";
    if (nif && !isValidNif(nif)) errors.push(`NIF inválido (${rawNif}).`);

    const rawSegment = get(cells, "segment");
    const segment = (rawSegment && pick(rawSegment, SEGMENTS)) || "Retalho";
    if (rawSegment && !pick(rawSegment, SEGMENTS)) warnings.push(`Segmento «${rawSegment}» desconhecido — fica Retalho.`);

    const rawZone = get(cells, "zone");
    const zone = (rawZone && pick(rawZone, context.zones)) || context.zones[0] || "Luanda";
    if (rawZone && !pick(rawZone, context.zones)) warnings.push(`Zona «${rawZone}» não existe — fica ${zone}.`);

    const rawOwner = get(cells, "owner");
    const owner = (rawOwner && pick(rawOwner, context.owners)) || context.owners[0];
    if (rawOwner && !pick(rawOwner, context.owners)) warnings.push(`Gestor «${rawOwner}» não encontrado — fica ${owner}.`);

    const rawPhone = get(cells, "phone");
    const phone = rawPhone ? normalizeAngolanPhone(rawPhone) : null;
    if (rawPhone && !phone) warnings.push(`Telefone «${rawPhone}» inválido — não é importado.`);

    const rawTerms = get(cells, "paymentTerms");
    const paymentTerms: PaymentTerm = (rawTerms && pick(rawTerms, PAYMENT_TERMS)) || "Pronto pagamento";
    if (rawTerms && !pick(rawTerms, PAYMENT_TERMS)) warnings.push(`Condições «${rawTerms}» desconhecidas — fica pronto pagamento.`);

    const rawLimit = get(cells, "creditLimit");
    const creditLimit = rawLimit ? parseAmount(rawLimit) : 0;
    if (rawLimit && Number.isNaN(creditLimit)) errors.push(`Limite de crédito inválido (${rawLimit}).`);

    const profile: CompanyProfile = {
      ...EMPTY_PROFILE,
      nif,
      phone: phone ? formatAngolanPhone(phone) : "",
      billingEmail: get(cells, "billingEmail").toLowerCase(),
      address: get(cells, "address"),
      municipality: get(cells, "municipality"),
      paymentTerms,
      creditLimit: Number.isNaN(creditLimit) ? 0 : creditLimit,
      customerSince: context.today,
    };

    const contactName = get(cells, "contactName");
    const rawContactPhone = get(cells, "contactPhone");
    const contactPhone = rawContactPhone ? normalizeAngolanPhone(rawContactPhone) : null;
    if (rawContactPhone && !contactPhone) warnings.push(`Telefone do contacto «${rawContactPhone}» inválido.`);
    const contact = contactName
      ? {
          name: contactName,
          role: get(cells, "contactRole"),
          phone: contactPhone ? formatAngolanPhone(contactPhone) : "",
          email: get(cells, "contactEmail").toLowerCase(),
        }
      : undefined;

    let action: ImportAction = errors.length > 0 ? "ignorar" : "criar";
    let matchId: string | undefined;
    let matchName: string | undefined;

    if (errors.length === 0 && nif) {
      const previous = seenNifs.get(nif);
      if (previous) {
        action = "ignorar";
        warnings.push(`NIF repetido no ficheiro (linha ${previous}).`);
      } else {
        seenNifs.set(nif, line);
        const existing = findByNif(context.companies, nif);
        if (existing) {
          action = "atualizar";
          matchId = existing.id;
          matchName = existing.name;
        }
      }
    }
    if (errors.length === 0 && action === "criar" && name) {
      const key = simplify(name);
      const existing = existingNames.get(key);
      const previous = seenNames.get(key);
      if (existing) {
        action = "ignorar";
        matchId = existing.id;
        matchName = existing.name;
        warnings.push("Já existe um cliente com este nome — confirme antes de criar.");
      } else if (previous) {
        action = "ignorar";
        warnings.push(`Nome repetido no ficheiro (linha ${previous}).`);
      } else {
        seenNames.set(key, line);
      }
    }

    return { line, name, segment, zone, owner, profile, contact, action, matchId, matchName, errors, warnings };
  });
}

export const IMPORT_TEMPLATE: string[][] = [
  ["Nome", "NIF", "Segmento", "Zona", "Gestor", "Telefone", "E-mail", "Morada", "Município", "Condições", "Limite de crédito", "Contacto", "Cargo", "Telefone do contacto", "E-mail do contacto"],
  ["Mercearia Exemplo", "5000000001", "Retalho", "Luanda", "Sara Neto", "+244 923 000 000", "geral@exemplo.ao", "Rua Exemplo, n.º 1", "Viana", "Crédito a 30 dias", "2000000", "Ana Exemplo", "Gerente", "+244 923 000 001", "ana@exemplo.ao"],
];
