import type { Company, CompanyProfile } from "@/data/companies";
import type { FollowUp } from "@/data/follow-ups";
import type { CompaniesRepository, CompanyBulkPatch, CompanyPatch } from "../repositories/companies";
import type { HttpClient } from "./client";

const id = encodeURIComponent;

export function createHttpCompanies(http: HttpClient): CompaniesRepository {
  return {
    list: () => http.get<Company[]>("/crm/companies"),
    get: (companyId) => http.get<Company>(`/crm/companies/${id(companyId)}`),
    create: (company: Company) => http.post<Company>("/crm/companies", company),
    update: (companyId, patch: CompanyPatch) => http.post<Company>(`/crm/companies/${id(companyId)}`, patch),
    updateMany: (ids, patch: CompanyBulkPatch) => http.post<Company[]>("/crm/companies/bulk", { ids, patch }),
    scheduleFollowUp: (companyId, followUp: FollowUp | null) => http.post<Company>(`/crm/companies/${id(companyId)}/follow-up`, { followUp }),
    updateProfile: (companyId, profile: CompanyProfile) => http.post<Company>(`/crm/companies/${id(companyId)}/profile`, profile),
    archive: (ids) => http.post<Company[]>("/crm/companies/archive", { ids }),
    restore: (companies: Company[]) => http.post<Company[]>("/crm/companies/restore", { companies }),
    registerContact: (companyId, date, label) => http.post<void>(`/crm/companies/${id(companyId)}/contact`, { date, label }),
    importCompanies: (created: Company[], updated: [string, CompanyProfile][]) => http.post<Company[]>("/crm/companies/import", { created, updated }),
  };
}
