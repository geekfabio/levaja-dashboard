import type { VehicleClass, Zone } from "@/types/leva-ja";

export const ZONES: Zone[] = [
  { id: "zn-ingombota", name: "Ingombota", coords: { latitude: -8.8147, longitude: 13.2302 }, radiusKm: 2.2 },
  { id: "zn-maianga", name: "Maianga", coords: { latitude: -8.8335, longitude: 13.2398 }, radiusKm: 2.4 },
  { id: "zn-alvalade", name: "Alvalade", coords: { latitude: -8.8462, longitude: 13.2511 }, radiusKm: 2 },
  { id: "zn-rangel", name: "Rangel", coords: { latitude: -8.8268, longitude: 13.2667 }, radiusKm: 2.2 },
  { id: "zn-cazenga", name: "Cazenga", coords: { latitude: -8.8205, longitude: 13.2958 }, radiusKm: 3.5 },
  { id: "zn-talatona", name: "Talatona", coords: { latitude: -8.9175, longitude: 13.1834 }, radiusKm: 4.5 },
  { id: "zn-benfica", name: "Benfica", coords: { latitude: -8.9585, longitude: 13.1543 }, radiusKm: 4 },
  { id: "zn-camama", name: "Camama", coords: { latitude: -8.9257, longitude: 13.2512 }, radiusKm: 4 },
  { id: "zn-kilamba", name: "Kilamba", coords: { latitude: -8.9965, longitude: 13.2715 }, radiusKm: 4 },
  { id: "zn-viana", name: "Viana", coords: { latitude: -8.9035, longitude: 13.3742 }, radiusKm: 5 },
];

export const ZONE_STREETS: Record<string, string[]> = {
  "zn-ingombota": ["Rua Major Kanhangulo", "Largo do Kinaxixi", "Av. 4 de Fevereiro", "Rua Rainha Ginga", "Rua Amílcar Cabral"],
  "zn-maianga": ["Rua Joaquim Kapango", "Largo da Maianga", "Rua Comandante Gika", "Av. Revolução de Outubro"],
  "zn-alvalade": ["Rua Fernão Mendes Pinto", "Rua Emílio Mbidi", "Av. Comandante Gika", "Rua Che Guevara"],
  "zn-rangel": ["Rua do Lobito", "Av. Deolinda Rodrigues", "Rua dos Comandos", "Mercado do Rangel"],
  "zn-cazenga": ["Av. Hoji Ya Henda", "Rua da Petrangol", "Largo do Tala Hady", "Rua do Cazenga Popular"],
  "zn-talatona": ["Via AL-15", "Belas Shopping", "Rua do Talatona Business Park", "Condomínio Jardim de Rosas"],
  "zn-benfica": ["Estrada de Benfica", "Rua do Mussulo", "Largo do Benfica", "Bairro Futungo"],
  "zn-camama": ["Estrada do Camama", "Rua da Universidade Agostinho Neto", "Bairro Calemba 2", "Rua do Jardim do Éden"],
  "zn-kilamba": ["Centralidade do Kilamba, Bloco T", "Rua Ngola Kiluanje do Kilamba", "Kilamba, Quarteirão B", "Kilamba, Edifício W12"],
  "zn-viana": ["Estrada de Catete", "Mercado do Km 30", "Zona Económica Especial", "Bairro Luanda Sul", "Rua do Vila Flor"],
};

export const CLIENT_FIRST_NAMES = [
  "Armando", "João", "Ana", "Maria", "Domingos", "Esperança", "Fernanda", "Manuel", "Paulo", "Luísa",
  "Isabel", "Teresa", "Joaquim", "Adelino", "Celestino", "Graça", "Nelson", "Mauro", "Yuri", "Délcio",
  "Edvaldo", "Josefa", "Rosa", "Helena", "Wilson", "Nzinga", "Ndalu", "Lukeny", "Kieza", "Mário",
  "Sandra", "Augusto", "Cristina", "Bento", "Francisco", "Leonor", "Carla", "Hélder", "Inês", "Valdemar",
];

export const PROVIDER_FIRST_NAMES = [
  "António", "Carlos", "Pedro", "Sebastião", "Gaspar", "Agostinho", "Alberto", "Benvindo", "Cassule", "Daniel",
  "Ernesto", "Faustino", "Gervásio", "Hamilton", "Ivo", "Jacinto", "Kalunga", "Lourenço", "Matias", "Narciso",
  "Osvaldo", "Quintino", "Rafael", "Simão", "Tomás",
];

export const LAST_NAMES = [
  "Silva", "Manuel", "Neto", "dos Santos", "Fernandes", "Domingos", "Lopes", "Cardoso", "Mendes", "Sebastião",
  "Kiala", "Miguel", "Gaspar", "Bastos", "Cassoma", "Chipenda", "Tchissola", "Mateus", "Quintas", "Pedro",
  "Van-Dúnem", "Agostinho", "Francisco", "Bento", "Cunha",
];

export const VEHICLE_MODELS: Record<VehicleClass, [string, string][]> = {
  tow_truck: [["Isuzu", "NPR"], ["Mitsubishi", "Canter"], ["Toyota", "Dyna"], ["Hyundai", "HD72"]],
  pickup: [["Toyota", "Hilux"], ["Nissan", "Navara"], ["Mitsubishi", "L200"], ["Ford", "Ranger"]],
  van: [["Toyota", "HiAce"], ["Hyundai", "H-1"], ["Mercedes-Benz", "Sprinter"], ["Nissan", "Urvan"]],
  truck: [["Isuzu", "FRR"], ["Mercedes-Benz", "Atego"], ["MAN", "TGL"], ["Hino", "300"]],
};

export const VEHICLE_CAPACITY: Record<VehicleClass, number> = {
  tow_truck: 3500,
  pickup: 1000,
  van: 1500,
  truck: 5000,
};

export const VEHICLE_COLORS = ["Branco", "Prata", "Preto", "Azul", "Vermelho", "Cinzento"];

export const CLIENT_CARS: [string, string][] = [
  ["Toyota", "Corolla"], ["Hyundai", "Tucson"], ["Kia", "Sportage"], ["Toyota", "Land Cruiser"],
  ["Suzuki", "Swift"], ["Nissan", "X-Trail"], ["Mitsubishi", "Pajero"], ["Toyota", "RAV4"],
];

export const CANCEL_REASONS = [
  "Cliente desistiu do pedido",
  "Prestador demorou demasiado a chegar",
  "Pedido duplicado",
  "Cliente encontrou alternativa",
  "Endereço de recolha incorrecto",
  "Sem prestadores disponíveis na zona",
];

export const REVIEW_COMMENTS: Record<number, string[]> = {
  5: ["Excelente serviço, muito pontual.", "Cuidadoso com a mobília. Recomendo.", "Chegou rápido e resolveu tudo.", "Muito profissional e simpático."],
  4: ["Bom serviço, chegou um pouco atrasado.", "Correu bem, só faltou avisar à chegada.", "Serviço bom, preço justo."],
  3: ["Serviço razoável, demorou mais do que o previsto.", "Cumpriu, mas a comunicação foi fraca."],
  2: ["Chegou com uma hora de atraso e sem avisar.", "Uma caixa chegou danificada.", "Pediu pagamento extra em numerário."],
  1: ["Não apareceu na hora combinada e foi mal-educado.", "Danificou a viatura durante o reboque.", "Péssima experiência, não recomendo."],
};

export const CLIENT_TICKET_SUBJECTS = [
  "Prestador não apareceu",
  "Cobrança em duplicado",
  "Objecto danificado na mudança",
  "Não consigo pagar com referência",
  "Prestador pediu pagamento extra",
  "Atraso na entrega da carga",
  "Pedido cancelado sem aviso",
  "Alterar morada de recolha",
  "Reembolso de pedido cancelado",
  "Comportamento inadequado do prestador",
];

export const PROVIDER_TICKET_SUBJECTS = [
  "Levantamento ainda não recebido",
  "Documento recusado sem motivo claro",
  "Cliente não estava no local",
  "Erro no cálculo da comissão",
  "Não recebo pedidos na minha zona",
  "A app fecha ao confirmar a recolha",
  "Actualizar o seguro da viatura",
];

export const ADMIN_REPLIES = [
  "Obrigado pelo contacto. Já estamos a analisar a situação.",
  "Falámos com a outra parte e aguardamos confirmação.",
  "Pode enviar uma fotografia ou comprovativo, por favor?",
  "Encaminhámos o caso para a equipa de operações.",
];

export const TICKET_RESOLUTIONS = [
  "Valor reembolsado por referência Multicaixa.",
  "Prestador advertido e caso encerrado.",
  "Situação esclarecida com o utilizador.",
  "Corrigido na carteira do prestador.",
];

export function slugify(value: string) {
  return value
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ".")
    .replace(/^\.|\.$/g, "");
}

export function initialsOf(name: string) {
  const parts = name.split(" ").filter((part) => part.length > 2 || part === name);
  const first = parts[0]?.[0] ?? "";
  const last = parts.length > 1 ? parts[parts.length - 1][0] : "";
  return `${first}${last}`.toUpperCase();
}
