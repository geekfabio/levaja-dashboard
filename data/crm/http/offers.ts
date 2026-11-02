import type { DiscountOffer } from "@/data/discount-offers";
import type { ManualOffer, OffersRepository } from "../repositories/offers";
import type { HttpClient } from "./client";

const id = encodeURIComponent;

export function createHttpOffers(http: HttpClient): OffersRepository {
  return {
    list: () => http.get<DiscountOffer[]>("/crm/offers"),
    create: (input: ManualOffer, today: string) => http.post<DiscountOffer>("/crm/offers", { ...input, today }),
    setStatus: (offerId, status) => http.post<DiscountOffer>(`/crm/offers/${id(offerId)}/status`, { status }),
  };
}
