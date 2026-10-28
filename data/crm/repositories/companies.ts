import type { Company, CompanyProfile } from "@/data/companies";
import type { FollowUp } from "@/data/follow-ups";

export type CompanyPatch = Partial<Pick<Company, "name" | "owner" | "zone" | "tags" | "pipelineValue" | "openDeals" | "winProbability">>;

export type CompanyBulkPatch = Partial<Pick<Company, "owner" | "zone">>;

export interface CompaniesRepository {
  list(): Promise<Company[]>;
  get(id: string): Promise<Company>;
  create(company: Company): Promise<Company>;
  update(id: string, patch: CompanyPatch): Promise<Company>;
  updateMany(ids: string[], patch: CompanyBulkPatch): Promise<Company[]>;
  scheduleFollowUp(id: string, followUp: FollowUp | null): Promise<Company>;
  updateProfile(id: string, profile: CompanyProfile): Promise<Company>;
  archive(ids: string[]): Promise<Company[]>;
  restore(companies: Company[]): Promise<Company[]>;
  registerContact(id: string, date: string, label: string): Promise<void>;
  importCompanies(created: Company[], updated: [string, CompanyProfile][]): Promise<Company[]>;
}
