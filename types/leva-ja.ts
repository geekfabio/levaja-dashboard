export type ServiceKind = "tow" | "cargo" | "small_move" | "house_move";
export type ServiceStatus =
  | "searching"
  | "assigned"
  | "en_route"
  | "arrived"
  | "pickup_confirmed"
  | "in_transit"
  | "delivered"
  | "paid"
  | "rated"
  | "cancelled";
export type PaymentMethodKind = "bank_reference" | "card" | "cash";
export type VehicleClass = "tow_truck" | "pickup" | "van" | "truck";
export type DocumentState = "verified" | "pending" | "expired" | "needs_update";

export type Coordinates = { latitude: number; longitude: number };
export type Place = { id: string; label: string; area: string; city: string; coords: Coordinates };

export type Client = {
  id: string;
  name: string;
  email: string;
  phone: string;
  initials: string;
  rating: number;
  avatar?: string;
};

export type Vehicle = {
  id: string;
  brand: string;
  model: string;
  plate: string;
  color: string;
  vehicleClass: VehicleClass;
  categoryLabel: string;
  capacityKg: number;
  year: number;
};

export type Provider = {
  id: string;
  name: string;
  initials: string;
  phone: string;
  rating: number;
  reviewsCount: number;
  verified: boolean;
  avatar?: string;
  vehicle: Vehicle;
  coords: Coordinates;
};

export type PriceBreakdown = { base: number; distance: number; extras: number; platformFee: number; total: number };
export type ServiceEvent = { status: ServiceStatus; at: string };
export type PriceProposal = { amount: number; reason: string; status: "sent" | "accepted" | "declined" };

export type TowIncident = "breakdown" | "accident" | "flat_tire" | "battery" | "other";
export type CargoType = "goods" | "construction" | "furniture" | "appliances" | "other";

export type ServiceDetails =
  | { kind: "tow"; incident: TowIncident; vehicle: { brand: string; model: string; plate: string } }
  | { kind: "cargo"; cargoType: CargoType; weightKg: number; volumeM3: number }
  | { kind: "small_move" | "house_move"; rooms: number; floors: number; hasElevator: boolean; helpers: number };

export type DeliveryProof = { receivedBy: string; at: string; photoLabel: string };

export type Dispute = {
  reason: string;
  openedAt: string;
  openedBy: string;
  resolvedAt?: string;
  resolution?: string;
};

export type ServiceRequest = {
  id: string;
  code: string;
  kind: ServiceKind;
  status: ServiceStatus;
  clientId: string;
  providerId?: string;
  client?: Client;
  provider?: Provider;
  origin: Place;
  destination: Place;
  stops: Place[];
  distanceKm: number;
  durationMin: number;
  createdAt: string;
  scheduledFor?: string;
  price: PriceBreakdown;
  providerEarning: number;
  proposal?: PriceProposal;
  paymentMethod?: PaymentMethodKind;
  rating?: number;
  review?: string;
  timeline: ServiceEvent[];
  cancelReason?: string;
  zoneId: string;
  details: ServiceDetails;
  proof?: DeliveryProof;
  dispute?: Dispute;
};

export type Transaction = {
  id: string;
  kind: "earning" | "withdrawal" | "fee";
  title: string;
  amount: number;
  at: string;
  status: "completed" | "pending" | "failed";
  serviceKind?: ServiceKind;
};

export type ProviderDocument = {
  id: string;
  title: string;
  validUntil: string;
  state: DocumentState;
  icon: "license" | "id" | "vehicle" | "insurance";
};

export type Zone = { id: string; name: string; coords: Coordinates; radiusKm: number };

export type Review = {
  id: string;
  requestId: string;
  authorName: string;
  authorInitials: string;
  rating: number;
  comment: string;
  at: string;
};

export type AdminRole = "admin" | "operations" | "support" | "finance";

export type AdminUser = {
  id: string;
  name: string;
  email: string;
  initials: string;
  role: AdminRole;
  active: boolean;
  createdAt: string;
  lastLoginAt?: string;
};

export type AdminSession = { token: string; user: AdminUser; expiresAt: string };

export type ProviderAvailability = "online" | "offline";
export type ProviderAccountStatus = "pending_approval" | "active" | "suspended";
export type ProviderDisplayStatus = ProviderAvailability | "suspended";

export type ProviderAccount = Provider & {
  email: string;
  availability: ProviderAvailability;
  accountStatus: ProviderAccountStatus;
  suspensionReason?: string;
  zoneIds: string[];
  services: ServiceKind[];
  documents: ProviderDocument[];
  balance: number;
  totalEarnings: number;
  completedCount: number;
  joinedAt: string;
};

export type ClientPaymentMethod = { id: string; kind: PaymentMethodKind; label: string; isDefault: boolean };

export type ClientAccount = Client & {
  blocked: boolean;
  blockedReason?: string;
  createdAt: string;
  addresses: Place[];
  paymentMethods: ClientPaymentMethod[];
  requestsCount: number;
  totalSpent: number;
};

export type TicketStatus = "open" | "in_progress" | "resolved";
export type TicketPriority = "low" | "medium" | "high" | "urgent";
export type TicketParty = "client" | "provider";

export type TicketMessage = {
  id: string;
  author: TicketParty | "admin";
  authorName: string;
  body: string;
  at: string;
};

export type Ticket = {
  id: string;
  code: string;
  subject: string;
  status: TicketStatus;
  priority: TicketPriority;
  requesterKind: TicketParty;
  requesterId: string;
  requesterName: string;
  requestId?: string;
  assigneeId?: string;
  assigneeName?: string;
  messages: TicketMessage[];
  createdAt: string;
  updatedAt: string;
  resolvedAt?: string;
  resolution?: string;
};

export type SosStatus = "open" | "acknowledged" | "resolved";

export type SosAlert = {
  id: string;
  requestId: string;
  requestCode: string;
  raisedBy: TicketParty;
  raisedById: string;
  raisedByName: string;
  phone: string;
  coords: Coordinates;
  area: string;
  message: string;
  status: SosStatus;
  createdAt: string;
  acknowledgedAt?: string;
  resolvedAt?: string;
  handledBy?: string;
  resolution?: string;
};

export type WithdrawalStatus = "pending" | "approved" | "rejected" | "paid";

export type Withdrawal = {
  id: string;
  providerId: string;
  providerName: string;
  amount: number;
  iban: string;
  status: WithdrawalStatus;
  requestedAt: string;
  decidedAt?: string;
  paidAt?: string;
  paymentReference?: string;
  reason?: string;
  decidedBy?: string;
};

export type PricingRule = { kind: ServiceKind; base: number; perKm: number };

export type PricingExtra = { id: string; label: string; amount: number; kinds: ServiceKind[] };

export type PricingConfig = {
  rules: PricingRule[];
  extras: PricingExtra[];
  platformFee: number;
  commissionRate: number;
  roundTo: number;
  updatedAt: string;
  updatedBy: string;
};

export type AuditEntityKind =
  | "request"
  | "provider"
  | "document"
  | "client"
  | "withdrawal"
  | "pricing"
  | "zone"
  | "ticket"
  | "sos"
  | "review"
  | "admin_user"
  | "session";

export type AuditAction =
  | "request.reassign"
  | "request.cancel"
  | "request.dispute"
  | "request.force_complete"
  | "provider.approve"
  | "provider.suspend"
  | "provider.reactivate"
  | "document.approve"
  | "document.reject"
  | "client.block"
  | "client.unblock"
  | "withdrawal.approve"
  | "withdrawal.reject"
  | "withdrawal.paid"
  | "pricing.update"
  | "zone.create"
  | "zone.update"
  | "zone.delete"
  | "ticket.assign"
  | "ticket.reply"
  | "ticket.resolve"
  | "sos.acknowledge"
  | "sos.resolve"
  | "review.handled"
  | "admin_user.create"
  | "admin_user.role"
  | "admin_user.deactivate"
  | "admin_user.activate"
  | "session.login"
  | "session.logout"
  | "demo.reset";

export type AuditChange = { field: string; from: string; to: string };

export type AuditLogEntry = {
  id: string;
  actorId: string;
  actorName: string;
  actorRole: AdminRole;
  action: AuditAction;
  entity: { kind: AuditEntityKind; id: string; label: string };
  reason?: string;
  changes?: AuditChange[];
  at: string;
};
