import { COMPANIES, type CompanyProfile } from "./companies";
import { CREDIT_LIMITS, CUSTOMER_IDENTIFIERS } from "./sales";

const MUNICIPALITIES: Record<string, string[]> = {
  Luanda: ["Talatona", "Viana", "Cazenga", "Kilamba Kiaxi", "Maianga", "Ingombota"],
  Benguela: ["Benguela", "Lobito", "Catumbela"],
  Huíla: ["Lubango", "Chibia"],
};

const MUNICIPALITY_GEO: Record<string, { lat: number; lng: number }> = {
  Talatona: { lat: -8.9164, lng: 13.1834 },
  Viana: { lat: -8.9035, lng: 13.3741 },
  Cazenga: { lat: -8.8333, lng: 13.2833 },
  "Kilamba Kiaxi": { lat: -8.8892, lng: 13.2569 },
  Maianga: { lat: -8.8236, lng: 13.2311 },
  Ingombota: { lat: -8.8147, lng: 13.2302 },
  Benguela: { lat: -12.5763, lng: 13.4055 },
  Lobito: { lat: -12.3644, lng: 13.5361 },
  Catumbela: { lat: -12.4318, lng: 13.5468 },
  Lubango: { lat: -14.9172, lng: 13.4925 },
  Chibia: { lat: -15.1879, lng: 13.6894 },
};

const STREETS = [
  "Rua Rainha Ginga",
  "Avenida 21 de Janeiro",
  "Rua Comandante Che Guevara",
  "Avenida Deolinda Rodrigues",
  "Rua Major Kanhangulo",
  "Estrada de Catete",
];

const CUSTOMER_SINCE: Record<string, string> = {
  "boa-esperanca": "2019-10-08",
  "talatona-plaza": "2021-10-12",
  kilamba: "2020-10-27",
};

export const COMPANY_PROFILES: Record<string, CompanyProfile> = Object.fromEntries(
  COMPANIES.map((company, index) => {
    const ids = CUSTOMER_IDENTIFIERS[company.id];
    const municipalities = MUNICIPALITIES[company.zone] ?? [company.zone];
    const limit = CREDIT_LIMITS[company.id] ?? 0;
    return [
      company.id,
      {
        nif: ids.nif,
        card: ids.card,
        phone: ids.phone,
        billingEmail: `contabilidade.${company.id}@exemplo.ao`,
        address: `${STREETS[index % STREETS.length]}, n.º ${12 + index * 7}`,
        municipality: municipalities[index % municipalities.length],
        paymentTerms: limit > 0 ? (index % 2 === 0 ? "Crédito a 30 dias" : "Crédito a 15 dias") : "Pronto pagamento",
        creditLimit: limit,
        geo: (() => {
          const base = MUNICIPALITY_GEO[municipalities[index % municipalities.length]];
          return base ? { lat: base.lat + ((index % 5) - 2) * 0.004, lng: base.lng + ((index % 3) - 1) * 0.004 } : undefined;
        })(),
        customerSince: CUSTOMER_SINCE[company.id] ?? `${2018 + (index % 7)}-${String((index % 12) + 1).padStart(2, "0")}-${String(((index * 5) % 27) + 1).padStart(2, "0")}`,
      },
    ];
  }),
);
