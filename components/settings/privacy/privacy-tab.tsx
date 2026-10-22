"use client";

import { useMemo, useState } from "react";
import Button from "@/components/_ui/button";
import Field from "@/components/_ui/field";
import { Input } from "@/components/_ui/input";
import Tag from "@/components/_ui/tag";
import { DEFAULT_RETENTION_MONTHS, retentionCandidates } from "@/lib/privacy";
import { useCompaniesStore } from "@/stores/companies-store";
import { useContactsStore } from "@/stores/contacts-store";
import { exportContactData } from "@/components/contacts/detail/personal-data";
import SettingsPanel from "../settings-panel";

export default function PrivacyTab() {
  const contacts = useContactsStore((state) => state.contacts);
  const anonymize = useContactsStore((state) => state.anonymize);
  const companies = useCompaniesStore((state) => state.companies);
  const [months, setMonths] = useState(DEFAULT_RETENTION_MONTHS);
  const [confirmId, setConfirmId] = useState<string | null>(null);

  const candidates = useMemo(
    () =>
      retentionCandidates(
        contacts,
        (companyId) => companies.find((company) => company.id === companyId)?.activityDays,
        Math.max(1, months),
      ),
    [contacts, companies, months],
  );

  return (
    <div className="flex flex-col gap-6">
      <SettingsPanel
        title="Base legal e direitos do titular"
        description="Lei n.º 22/11 de Proteção de Dados Pessoais. Cada contacto tem consentimento por canal com data e origem; o titular pode pedir acesso (exportação) ou apagamento (anonimização) na ficha do contacto. Uma resposta «PARAR» por SMS ou WhatsApp retira o consentimento automaticamente."
      >
        <ul className="caption-style text-soft flex list-disc flex-col gap-1 pl-5">
          <li>Envios só com consentimento no canal e contacto válido — campanhas, automações e conversas aplicam a mesma regra.</li>
          <li>Todas as alterações a consentimentos, exportações e anonimizações ficam na Auditoria marcadas como dados sensíveis.</li>
          <li>Dados de clientes ficam no Supabase com RLS por perfil quando a base de dados for ligada; nunca em ficheiros do repositório.</li>
        </ul>
      </SettingsPanel>

      <SettingsPanel
        title={`Revisão de retenção · ${candidates.length}`}
        description="Contactos que já não deviam ser guardados: pediram remoção, saíram da empresa, ou o cliente está sem atividade há mais do que o prazo. Nada é apagado sem confirmação."
        actions={
          <Field label="Prazo (meses)" htmlFor="retention-months">
            <Input
              id="retention-months"
              type="number"
              min={1}
              inputMode="numeric"
              value={months}
              onChange={(event) => setMonths(Number(event.target.value) || 1)}
              className="h-[30px] w-20 tabular-nums"
            />
          </Field>
        }
      >
        {candidates.length === 0 ? (
          <p className="caption-style text-subtle">Nenhum contacto a rever.</p>
        ) : (
          <ul className="divide-border flex flex-col divide-y">
            {candidates.map(({ contact, reason }) => (
              <li key={contact.id} className="flex flex-wrap items-center justify-between gap-2 py-2.5">
                <span className="flex flex-col gap-0.5">
                  <span className="lead-style">{contact.name}</span>
                  <span className="caption-style text-subtle">{contact.companyName}</span>
                </span>
                <span className="flex flex-wrap items-center gap-2">
                  <Tag tone="amber" size="sm">{reason}</Tag>
                  <Button variant="ghost" size="sm" onClick={() => exportContactData(contact)}>
                    Exportar
                  </Button>
                  {confirmId === contact.id ? (
                    <>
                      <Button variant="subtle" size="sm" onClick={() => setConfirmId(null)}>
                        Cancelar
                      </Button>
                      <Button
                        variant="primary"
                        size="sm"
                        onClick={() => {
                          anonymize(contact.id);
                          setConfirmId(null);
                        }}
                      >
                        Confirmar anonimização
                      </Button>
                    </>
                  ) : (
                    <Button variant="secondary" size="sm" onClick={() => setConfirmId(contact.id)}>
                      Anonimizar
                    </Button>
                  )}
                </span>
              </li>
            ))}
          </ul>
        )}
      </SettingsPanel>
    </div>
  );
}
