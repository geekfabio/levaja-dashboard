"use client";

import Avatar from "@/components/_ui/avatar";
import Button from "@/components/_ui/button";
import { Checkbox } from "@/components/_ui/checkbox";
import { Input } from "@/components/_ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/_ui/select";
import { TEAM_ICON_COMPONENTS } from "@/components/_common/sidebar/team-icons";
import SettingsPanel from "../settings-panel";
import CommittedInput from "../committed-input";
import QuotaInput from "../quota-input";
import AddItemForm from "../add-item-form";
import { OWNERS } from "@/data/companies";
import { TEAM_ICONS, TEAM_ICON_LABELS, type TeamSetting } from "@/data/settings";
import { formatMoney } from "@/lib/format";
import { nameTaken } from "@/lib/settings";
import { useSettingsStore } from "@/stores/settings-store";
import { cn } from "@/lib/utils";

function membersLabel(count: number) {
  return count === 1 ? "1 membro" : `${count} membros`;
}

function TeamCard({ team, members }: { team: TeamSetting; members: number }) {
  const teams = useSettingsStore((state) => state.teams);
  const updateTeam = useSettingsStore((state) => state.updateTeam);
  const removeTeam = useSettingsStore((state) => state.removeTeam);

  return (
    <li className="flex flex-col gap-3 py-4 first:pt-0 last:pb-0">
      <div className="flex flex-wrap items-start gap-2">
        <div className="flex items-center gap-1" role="group" aria-label="Ícone da equipa">
          {TEAM_ICONS.map((icon) => {
            const Icon = TEAM_ICON_COMPONENTS[icon];
            const selected = team.icon === icon;
            return (
              <Button
                key={icon}
                variant={selected ? "secondary" : "ghost"}
                size="icon"
                aria-label={TEAM_ICON_LABELS[icon]}
                aria-pressed={selected}
                onClick={() => updateTeam(team.id, { icon })}
              >
                <Icon aria-hidden className={cn("size-3.5", selected ? "text-icon" : "text-subtle")} />
              </Button>
            );
          })}
        </div>
        <CommittedInput
          id={`team-name-${team.id}`}
          label="Nome da equipa"
          value={team.name}
          className="min-w-[180px] flex-1"
          validate={(value) =>
            !value
              ? "Indique um nome."
              : nameTaken(teams.map((item) => item.name), value, team.name)
                ? "Já existe uma equipa com este nome."
                : undefined
          }
          onCommit={(name) => updateTeam(team.id, { name })}
        />
        <Button
          variant="ghost"
          size="sm"
          disabled={members > 0}
          title={members > 0 ? "Mova os membros para outra equipa primeiro." : undefined}
          onClick={() => removeTeam(team.id)}
        >
          Remover
        </Button>
      </div>

      <Input
        aria-label="Descrição da equipa"
        value={team.description}
        placeholder="Descrição (opcional)"
        className="h-[30px]"
        onChange={(event) => updateTeam(team.id, { description: event.target.value })}
      />

      <div className="grid items-center gap-3 sm:grid-cols-[auto_minmax(0,200px)_1fr]">
        <label htmlFor={`team-quota-${team.id}`} className="caption-style text-soft">
          Meta trimestral
        </label>
        <QuotaInput
          id={`team-quota-${team.id}`}
          label="Meta trimestral"
          value={team.quota}
          onChange={(quota) => updateTeam(team.id, { quota })}
        />
        <div className="flex flex-wrap items-center gap-x-4 gap-y-2 sm:justify-end">
          <span className="caption-style text-subtle tabular-nums">
            {membersLabel(members)} · {formatMoney(team.quota)}
          </span>
          <label className="caption-style text-soft flex cursor-pointer items-center gap-2">
            <Checkbox
              checked={team.showInSidebar}
              onCheckedChange={(checked) =>
                updateTeam(team.id, { showInSidebar: checked === true })
              }
            />
            Mostrar na barra lateral
          </label>
        </div>
      </div>
    </li>
  );
}

export default function TeamsTab() {
  const teams = useSettingsStore((state) => state.teams);
  const memberships = useSettingsStore((state) => state.memberships);
  const addTeam = useSettingsStore((state) => state.addTeam);
  const setMembership = useSettingsStore((state) => state.setMembership);

  function memberCount(teamId: string) {
    return Object.values(memberships).filter((id) => id === teamId).length;
  }

  return (
    <div className="flex flex-col gap-6 p-5">
      <SettingsPanel
        title={`Equipas comerciais · ${teams.length}`}
        description="As equipas marcadas aparecem na barra lateral. A meta alimenta o relatório de desempenho por equipa."
      >
        <ul className="divide-border flex flex-col divide-y">
          {teams.map((team) => (
            <TeamCard key={team.id} team={team} members={memberCount(team.id)} />
          ))}
        </ul>
        <AddItemForm
          id="new-team"
          label="Nome da nova equipa"
          placeholder="Nome da nova equipa"
          buttonLabel="Adicionar equipa"
          validate={(value) =>
            nameTaken(teams.map((item) => item.name), value)
              ? "Já existe uma equipa com este nome."
              : undefined
          }
          onAdd={addTeam}
        />
      </SettingsPanel>

      <SettingsPanel
        title="Membros"
        description="Cada gestor de conta pertence a uma equipa. As oportunidades do gestor contam para a meta da equipa."
      >
        <ul className="divide-border flex flex-col divide-y">
          {OWNERS.map((owner) => (
            <li
              key={owner.name}
              className="flex flex-wrap items-center justify-between gap-3 py-2.5 first:pt-0 last:pb-0"
            >
              <span className="flex min-w-0 items-center gap-2">
                <Avatar src={owner.avatar} alt="" />
                <span className="flex min-w-0 flex-col gap-1">
                  <span className="lead-style truncate">{owner.name}</span>
                  <span className="caption-style text-subtle truncate">{owner.role}</span>
                </span>
              </span>
              <Select
                value={memberships[owner.name]}
                onValueChange={(teamId) => setMembership(owner.name, teamId)}
              >
                <SelectTrigger aria-label={`Equipa de ${owner.name}`} className="w-[220px]">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {teams.map((team) => (
                    <SelectItem key={team.id} value={team.id}>
                      {team.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </li>
          ))}
        </ul>
      </SettingsPanel>
    </div>
  );
}
