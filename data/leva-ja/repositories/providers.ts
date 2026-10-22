import type {
  ProviderAccount,
  ProviderDisplayStatus,
  Review,
  ServiceKind,
  ServiceRequest,
  Transaction,
} from "@/types/leva-ja";
import type { Page, PageQuery, RealtimeListener, Unsubscribe } from "./common";

export type ProviderFilters = PageQuery & {
  status?: ProviderDisplayStatus[];
  verified?: boolean;
  pendingApproval?: boolean;
  zone?: string[];
  service?: ServiceKind[];
  q?: string;
};

export type ProviderPosition = Pick<
  ProviderAccount,
  "id" | "name" | "initials" | "coords" | "services" | "availability" | "rating"
> & { activeRequestId?: string; vehicleLabel: string };

export interface ProvidersRepository {
  list(filters?: ProviderFilters): Promise<Page<ProviderAccount>>;
  get(id: string): Promise<ProviderAccount>;
  approve(id: string, reason: string): Promise<ProviderAccount>;
  suspend(id: string, reason: string): Promise<ProviderAccount>;
  reactivate(id: string, reason: string): Promise<ProviderAccount>;
  transactions(id: string, query?: PageQuery): Promise<Page<Transaction>>;
  reviews(id: string, query?: PageQuery): Promise<Page<Review>>;
  requests(id: string, query?: PageQuery): Promise<Page<ServiceRequest>>;
  positions(): Promise<ProviderPosition[]>;
  subscribe(listener: RealtimeListener): Unsubscribe;
}
