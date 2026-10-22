import Sidebar from "@/components/_common/sidebar/sidebar";
import CommandPalette from "@/components/_common/command-palette/command-palette";
import GlobalShortcuts from "@/components/_common/command-palette/global-shortcuts";
import Toaster from "@/components/_ui/toaster";
import HelpDialog from "@/components/_common/help/help-dialog";
import SalesSimulator from "@/components/_common/sales-simulator";
import AutomationRunner from "@/components/_common/automation-runner";
import ConnectionStatus from "@/components/_common/connection-status";
import ServiceWorker from "@/components/_common/service-worker";
import CalendarSyncRunner from "@/components/_common/calendar-sync-runner";
import AssociateDialog from "@/components/sales/associate-dialog";
import NewActivityDialog from "@/components/activities/new-activity/new-activity-dialog";
import FollowUpNotifier from "@/components/follow-up/follow-up-notifier";

export default function AppLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <div className="flex h-dvh max-w-full overflow-hidden">
      <a
        href="#conteudo"
        className="bg-primary text-primary-foreground sr-only z-[70] rounded-full px-4 py-2.5 text-[14px] leading-none font-medium focus:not-sr-only focus:fixed focus:top-3 focus:left-3"
      >
        Saltar para o conteúdo
      </a>
      <Sidebar />
      <main id="conteudo" tabIndex={-1} className="flex min-h-0 min-w-0 flex-1 outline-none">
        {children}
      </main>
      <CommandPalette />
      <GlobalShortcuts />
      <HelpDialog />
      <SalesSimulator />
      <AutomationRunner />
      <ConnectionStatus />
      <ServiceWorker />
      <CalendarSyncRunner />
      <AssociateDialog />
      <NewActivityDialog />
      <FollowUpNotifier />
      <Toaster />
    </div>
  );
}
