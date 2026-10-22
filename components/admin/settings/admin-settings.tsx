"use client";

import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import AdminHeader from "@/components/admin/shell/admin-header";
import ConfirmDialog from "@/components/_common/confirm-dialog";
import FilterMenu from "@/components/_common/filter-menu";
import SettingsPanel from "@/components/settings/settings-panel";
import Button from "@/components/_ui/button";
import { ScrollArea } from "@/components/_ui/scroll-area";
import Tag from "@/components/_ui/tag";
import { errorMessage, repositories } from "@/data/leva-ja";
import { SECTION_LABELS } from "@/lib/leva-ja/navigation";
import { ROLE_DESCRIPTIONS, ROLE_LABELS, canAccessSection } from "@/lib/leva-ja/permissions";
import type { AdminSection } from "@/lib/leva-ja/permissions";
import { useAdminSessionStore } from "@/stores/admin-session-store";
import { toast } from "@/stores/toast-store";

const LATENCY_OPTIONS = [
  { value: "0", label: "Sem atraso" },
  { value: "300", label: "300 ms (normal)" },
  { value: "1200", label: "1,2 s (rede lenta)" },
];

const FAILURE_OPTIONS = [
  { value: "0", label: "Nunca" },
  { value: "0.1", label: "10 % dos pedidos" },
  { value: "0.3", label: "30 % dos pedidos" },
];

export default function AdminSettings() {
  const client = useQueryClient();
  const session = useAdminSessionStore((state) => state.session);
  const demo = repositories().demo;
  const [settings, setSettings] = useState(() => demo?.settings() ?? { latencyMs: 0, failureRate: 0 });
  const [resetOpen, setResetOpen] = useState(false);
  const [resetting, setResetting] = useState(false);
  const [resetError, setResetError] = useState<string | null>(null);

  if (!session) return null;
  const { user } = session;
  const sections = (Object.keys(SECTION_LABELS) as AdminSection[]).filter((section) => canAccessSection(user.role, section));

  function configure(patch: Partial<typeof settings>) {
    if (!demo) return;
    demo.configure(patch);
    setSettings(demo.settings());
    toast({ title: "Simulação actualizada", tone: "success" });
  }

  async function reset() {
    if (!demo) return;
    setResetting(true);
    setResetError(null);
    try {
      await demo.reset();
      await client.invalidateQueries({ queryKey: ["admin"] });
      setResetOpen(false);
      toast({ title: "Dados de demonstração repostos", description: "Os dados voltaram ao estado inicial.", tone: "success" });
    } catch (error) {
      setResetError(errorMessage(error));
    } finally {
      setResetting(false);
    }
  }

  return (
    <section className="flex min-h-0 min-w-0 flex-1 flex-col">
      <AdminHeader title="Definições" />
      <ScrollArea className="min-h-0 flex-1">
        <div className="mx-auto flex w-full max-w-[960px] flex-col gap-6 p-5">
          <SettingsPanel title="A sua conta" description={ROLE_DESCRIPTIONS[user.role]}>
            <dl className="grid gap-4 sm:grid-cols-3">
              <div className="flex flex-col gap-1">
                <dt className="caption-style text-subtle">Nome</dt>
                <dd className="lead-style">{user.name}</dd>
              </div>
              <div className="flex flex-col gap-1">
                <dt className="caption-style text-subtle">E-mail</dt>
                <dd className="lead-style break-all">{user.email}</dd>
              </div>
              <div className="flex flex-col gap-1">
                <dt className="caption-style text-subtle">Papel</dt>
                <dd>
                  <Tag tone="green" size="sm">
                    {ROLE_LABELS[user.role]}
                  </Tag>
                </dd>
              </div>
            </dl>
            <div className="flex flex-col gap-2">
              <span className="caption-style text-subtle">Secções a que tem acesso</span>
              <ul className="flex flex-wrap gap-1.5">
                {sections.map((section) => (
                  <li key={section}>
                    <Tag tone="neutral" size="sm">
                      {SECTION_LABELS[section]}
                    </Tag>
                  </li>
                ))}
              </ul>
            </div>
          </SettingsPanel>

          {demo && (
            <SettingsPanel
              title="Dados de demonstração"
              description="O painel está em modo de demonstração: os dados são gerados no navegador e guardados localmente. Pode simular uma rede lenta ou com falhas para ver os estados de carregamento e de erro."
              actions={
                <Tag tone="amber" size="sm">
                  Modo de demonstração
                </Tag>
              }
            >
              <div className="flex flex-wrap items-center gap-2">
                <FilterMenu
                  label="Latência"
                  value={String(settings.latencyMs)}
                  options={LATENCY_OPTIONS}
                  onChange={(value) => configure({ latencyMs: Number(value) })}
                />
                <FilterMenu
                  label="Falhas de rede"
                  value={String(settings.failureRate)}
                  options={FAILURE_OPTIONS}
                  onChange={(value) => configure({ failureRate: Number(value) })}
                />
              </div>
              <div className="flex flex-wrap items-center justify-between gap-3">
                <p className="caption-style text-subtle max-w-[40em]">
                  Repor apaga todas as alterações feitas nesta demonstração (pedidos, documentos, levantamentos, preços e auditoria) e volta aos dados iniciais.
                </p>
                <Button variant="danger" size="md" onClick={() => setResetOpen(true)}>
                  Repor dados de demonstração
                </Button>
              </div>
            </SettingsPanel>
          )}
        </div>
      </ScrollArea>

      <ConfirmDialog
        open={resetOpen}
        onOpenChange={(open) => {
          setResetOpen(open);
          if (!open) setResetError(null);
        }}
        title="Repor dados de demonstração?"
        description="Todas as alterações feitas nesta demonstração vão ser perdidas. Esta acção não pode ser anulada."
        confirmLabel="Repor dados"
        tone="danger"
        pending={resetting}
        error={resetError}
        onConfirm={reset}
      />
    </section>
  );
}
