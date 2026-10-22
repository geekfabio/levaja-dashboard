import { create } from "zustand";
import type { AuditChange } from "@/data/audit";
import { recordEvent } from "./audit-store";
import { toast } from "./toast-store";
import {
  SMS_TEMPLATES,
  TEMPLATES,
  type CampaignTemplate,
  type SmsTemplate,
} from "@/data/campaigns";
import {
  COMPANY_PROFILE,
  DEFAULT_ROLE_PERMISSIONS,
  DEFAULT_ROLE_SCOPES,
  PERMISSIONS,
  SENDER_SETTINGS,
  TEAM_MEMBERSHIPS,
  TEAM_SETTINGS,
  USERS,
  ZONE_SETTINGS,
  type AppUser,
  type CompanyProfile,
  type DataScope,
  type PermissionKey,
  type Role,
  type SenderSettings,
  type TeamSetting,
  type ZoneSetting,
} from "@/data/settings";

export const SETTINGS_TABS = [
  "empresa",
  "remetentes",
  "modelos",
  "equipas",
  "zonas",
  "acessos",
  "integracoes",
  "catalogo",
  "mensagens",
  "dados",
] as const;

export type SettingsTab = (typeof SETTINGS_TABS)[number];

function newId(prefix: string) {
  return `${prefix}-${crypto.randomUUID().slice(0, 8)}`;
}

type SettingsState = {
  tab: SettingsTab;
  company: CompanyProfile;
  senders: SenderSettings;
  emailTemplates: CampaignTemplate[];
  smsTemplates: SmsTemplate[];
  zones: ZoneSetting[];
  teams: TeamSetting[];
  memberships: Record<string, string>;
  rolePermissions: Record<Role, PermissionKey[]>;
  roleScopes: Record<Role, DataScope>;
  users: AppUser[];
  inviteOpen: boolean;
  setTab: (tab: SettingsTab) => void;
  saveCompany: (company: CompanyProfile) => void;
  saveSenders: (senders: SenderSettings) => void;
  saveEmailTemplate: (template: CampaignTemplate) => void;
  removeEmailTemplate: (id: string) => void;
  saveSmsTemplate: (template: SmsTemplate) => void;
  removeSmsTemplate: (id: string) => void;
  addZone: (zone: ZoneSetting) => void;
  updateZone: (name: string, patch: Partial<ZoneSetting>) => void;
  removeZone: (name: string) => void;
  addTeam: (name: string) => void;
  updateTeam: (id: string, patch: Partial<Omit<TeamSetting, "id">>) => void;
  removeTeam: (id: string) => void;
  setMembership: (ownerName: string, teamId: string) => void;
  togglePermission: (role: Role, key: PermissionKey) => void;
  setRoleScope: (role: Role, scope: DataScope) => void;
  setUserRole: (id: string, role: Role) => void;
  setInviteOpen: (open: boolean) => void;
  inviteUser: (user: Pick<AppUser, "name" | "email" | "role">) => void;
  removeUser: (id: string) => void;
};

export const useSettingsStore = create<SettingsState>((set, get) => {
  function log(
    action: string,
    label: string,
    changes: AuditChange[] = [],
    options: { notify?: boolean; sensitive?: boolean } = {},
  ) {
    recordEvent({
      action,
      target: { module: "Definições", label },
      changes,
      notify: options.notify ? "update" : false,
      sensitive: options.sensitive ?? true,
    });
  }

  function saveTemplate<T extends { id: string; name: string }>(
    key: "emailTemplates" | "smsTemplates",
    channel: string,
    template: T,
  ) {
    const list = get()[key] as unknown as T[];
    const exists = list.some((item) => item.id === template.id);
    set({
      [key]: exists
        ? list.map((item) => (item.id === template.id ? template : item))
        : [...list, template],
    } as Partial<SettingsState>);
    log(
      `${exists ? "atualizou" : "criou"} o modelo de ${channel}`,
      template.name,
      [],
      { sensitive: false },
    );
    if (!exists) {
      toast({
        title: "Modelo guardado",
        description: `${template.name} já está disponível na biblioteca de Campanhas.`,
        tone: "success",
      });
    }
  }

  function removeTemplate(key: "emailTemplates" | "smsTemplates", channel: string, id: string) {
    const list = get()[key] as unknown as { id: string; name: string }[];
    const index = list.findIndex((item) => item.id === id);
    if (index < 0) return;
    const removed = list[index];
    set({ [key]: list.filter((item) => item.id !== id) } as Partial<SettingsState>);
    log(`eliminou o modelo de ${channel}`, removed.name, [], { sensitive: false });
    toast({
      title: "Modelo eliminado",
      description: removed.name,
      action: {
        label: "Anular",
        run: () => {
          const current = get()[key] as unknown as { id: string }[];
          set({
            [key]: [...current.slice(0, index), removed, ...current.slice(index)],
          } as Partial<SettingsState>);
          log(`repôs o modelo de ${channel}`, removed.name, [], { sensitive: false });
        },
      },
    });
  }

  return {
    tab: "empresa",
    company: COMPANY_PROFILE,
    senders: SENDER_SETTINGS,
    emailTemplates: TEMPLATES,
    smsTemplates: SMS_TEMPLATES,
    zones: ZONE_SETTINGS,
    teams: TEAM_SETTINGS,
    memberships: TEAM_MEMBERSHIPS,
    rolePermissions: DEFAULT_ROLE_PERMISSIONS,
    roleScopes: DEFAULT_ROLE_SCOPES,
    users: USERS,
    inviteOpen: false,

    setTab: (tab) => set({ tab }),
    saveCompany: (company) => {
      const previous = get().company;
      set({ company });
      log("atualizou os dados da empresa", company.tradeName, diffFields(previous, company, COMPANY_FIELD_LABELS));
      toast({ title: "Dados da empresa guardados", tone: "success" });
    },
    saveSenders: (senders) => {
      const previous = get().senders;
      set({ senders });
      log("atualizou os remetentes", senders.emailName, diffFields(previous, senders, SENDER_FIELD_LABELS));
      toast({ title: "Remetentes guardados", tone: "success" });
    },

    saveEmailTemplate: (template) => saveTemplate("emailTemplates", "e-mail", template),
    removeEmailTemplate: (id) => removeTemplate("emailTemplates", "e-mail", id),
    saveSmsTemplate: (template) => saveTemplate("smsTemplates", "SMS", template),
    removeSmsTemplate: (id) => removeTemplate("smsTemplates", "SMS", id),

    addZone: (zone) => {
      set((state) => ({ zones: [...state.zones, zone] }));
      log("criou a zona", zone.name, [], { sensitive: false });
    },
    updateZone: (name, patch) =>
      set((state) => ({
        zones: state.zones.map((zone) => (zone.name === name ? { ...zone, ...patch } : zone)),
      })),
    removeZone: (name) => {
      set((state) => ({ zones: state.zones.filter((zone) => zone.name !== name) }));
      log("removeu a zona", name, [], { sensitive: false });
    },

    addTeam: (name) => {
      set((state) => ({
        teams: [
          ...state.teams,
          {
            id: newId("equipa"),
            name,
            description: "",
            icon: "users",
            quota: 0,
            showInSidebar: true,
          },
        ],
      }));
      log("criou a equipa", name, [], { sensitive: false });
    },
    updateTeam: (id, patch) =>
      set((state) => ({
        teams: state.teams.map((team) => (team.id === id ? { ...team, ...patch } : team)),
      })),
    removeTeam: (id) => {
      const state = get();
      const team = state.teams.find((item) => item.id === id);
      if (!team || Object.values(state.memberships).includes(id)) return;
      set({ teams: state.teams.filter((item) => item.id !== id) });
      log("removeu a equipa", team.name, [], { sensitive: false });
    },
    setMembership: (ownerName, teamId) => {
      const state = get();
      const teamName = (teamId: string | undefined) =>
        state.teams.find((team) => team.id === teamId)?.name ?? "—";
      if (state.memberships[ownerName] === teamId) return;
      set({ memberships: { ...state.memberships, [ownerName]: teamId } });
      log("mudou de equipa", ownerName, [
        { field: "Equipa", from: teamName(state.memberships[ownerName]), to: teamName(teamId) },
      ]);
    },

    togglePermission: (role, key) => {
      if (role === "Administrador") return;
      const current = get().rolePermissions[role];
      const granted = !current.includes(key);
      set((state) => ({
        rolePermissions: {
          ...state.rolePermissions,
          [role]: granted ? [...current, key] : current.filter((item) => item !== key),
        },
      }));
      const label = PERMISSIONS.find((permission) => permission.key === key)?.label ?? key;
      log(`${granted ? "concedeu" : "retirou"} uma permissão ao perfil`, role, [
        { field: label, from: granted ? "Não" : "Sim", to: granted ? "Sim" : "Não" },
      ]);
    },
    setRoleScope: (role, scope) => {
      if (role === "Administrador") return;
      const previous = get().roleScopes[role];
      if (previous === scope) return;
      set((state) => ({ roleScopes: { ...state.roleScopes, [role]: scope } }));
      log("alterou o âmbito de dados do perfil", role, [
        { field: "Clientes visíveis", from: previous, to: scope },
      ]);
    },

    setUserRole: (id, role) => {
      const user = get().users.find((item) => item.id === id);
      if (!user || user.role === role) return;
      set((state) => ({
        users: state.users.map((item) => (item.id === id ? { ...item, role } : item)),
      }));
      log("alterou o perfil de", user.name, [{ field: "Perfil", from: user.role, to: role }], {
        notify: true,
      });
    },
    setInviteOpen: (inviteOpen) => set({ inviteOpen }),
    inviteUser: (user) => {
      set((state) => ({
        users: [...state.users, { ...user, id: newId("user"), status: "Convite pendente" }],
        inviteOpen: false,
      }));
      log("convidou", user.name, [{ field: "Perfil", to: user.role }], { notify: true });
      toast({
        title: "Convite criado",
        description: `${user.name} aparece como pendente até aceitar.`,
        tone: "success",
      });
    },
    removeUser: (id) => {
      const user = get().users.find((item) => item.id === id);
      if (!user || user.status !== "Convite pendente") return;
      set((state) => ({ users: state.users.filter((item) => item.id !== id) }));
      log("cancelou o convite de", user.name);
    },
  };
});

const COMPANY_FIELD_LABELS: Record<keyof CompanyProfile, string> = {
  tradeName: "Nome comercial",
  legalName: "Denominação social",
  nif: "NIF",
  address: "Morada",
  city: "Cidade",
  phone: "Telefone",
  email: "E-mail",
  website: "Sítio na internet",
};

const SENDER_FIELD_LABELS: Record<keyof SenderSettings, string> = {
  emailName: "Nome do remetente",
  emailAddress: "Endereço de envio",
  replyTo: "Responder para",
  smsSenderId: "Identificador de SMS",
  windowStart: "Início da janela",
  windowEnd: "Fim da janela",
};

function diffFields<T extends Record<string, string>>(
  previous: T,
  next: T,
  labels: Record<keyof T, string>,
): AuditChange[] {
  return (Object.keys(labels) as (keyof T)[])
    .filter((key) => previous[key] !== next[key])
    .map((key) => ({ field: labels[key], from: previous[key], to: next[key] }));
}
