import CompaniesHeader from "./header/header";
import CompaniesToolbar from "./toolbar/toolbar";
import CompaniesTotals from "./companies-totals";
import CompaniesTable from "./table/companies-table";
import CompanyDetail from "./detail/company-detail";
import Profile from "./profile/profile";
import NewCompanyDialog from "./new-company/new-company-dialog";
import ImportDialog from "./import/import-dialog";

export default function Companies() {
  return (
    <section id="companies" className="flex min-h-0 min-w-0 flex-1 flex-col">
      <CompaniesHeader />
      <CompaniesTotals />
      <CompaniesToolbar />
      <CompaniesTable />
      <CompanyDetail />
      <Profile />
      <NewCompanyDialog />
      <ImportDialog />
    </section>
  );
}
