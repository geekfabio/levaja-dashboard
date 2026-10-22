import { useActivitiesStore } from "./activities-store";
import { useAutomationsStore } from "./automations-store";
import { useCampaignsStore } from "./campaigns-store";
import { useCompaniesStore } from "./companies-store";
import { useSettingsStore } from "./settings-store";
import { recordEvent } from "./audit-store";

export function renameZoneEverywhere(from: string, to: string) {
  if (from === to) return;

  useSettingsStore.getState().updateZone(from, { name: to });
  recordEvent({
    action: "mudou o nome da zona",
    target: { module: "Definições", label: to },
    changes: [{ field: "Nome", from, to }],
  });

  useCompaniesStore.setState((state) => ({
    companies: state.companies.map((company) =>
      company.zone === from ? { ...company, zone: to } : company,
    ),
  }));

  useActivitiesStore.setState((state) => ({
    activities: state.activities.map((activity) =>
      activity.zone === from ? { ...activity, zone: to } : activity,
    ),
  }));

  useCampaignsStore.setState((state) => ({
    campaigns: state.campaigns.map((campaign) =>
      campaign.audience.zone === from
        ? { ...campaign, audience: { ...campaign.audience, zone: to } }
        : campaign,
    ),
  }));

  useAutomationsStore.setState((state) => ({
    automations: state.automations.map((automation) =>
      automation.conditions.zone === from
        ? { ...automation, conditions: { ...automation.conditions, zone: to } }
        : automation,
    ),
  }));
}
