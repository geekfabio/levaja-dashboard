"use client";

import Button from "@/components/_ui/button";
import { Kbd } from "@/components/_ui/command";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/_ui/dialog";
import { ScrollArea } from "@/components/_ui/scroll-area";
import FormSection from "@/components/_common/form-section";
import { PAGES } from "@/components/_common/command-palette/use-commands";
import { useModifierKey } from "@/hooks/use-modifier-key";
import { useSettingsStore } from "@/stores/settings-store";
import { useUiStore } from "@/stores/ui-store";

const TIPS = [
  "Clique numa equipa ou zona na barra lateral para ver só esses clientes.",
  "Selecione várias linhas em Clientes para atribuir gestor, mudar zona, exportar ou arquivar de uma vez.",
  "Quase tudo pode ser anulado: procure o botão “Anular” no aviso que aparece no canto do ecrã.",
  "Tudo o que muda fica no registo de Auditoria, com o valor antigo e o novo.",
];

function Shortcut({ keys, label }: { keys: string[]; label: string }) {
  return (
    <div className="flex items-center justify-between gap-3 py-2">
      <dt className="lead-style text-soft">{label}</dt>
      <dd className="flex shrink-0 items-center gap-1">
        {keys.map((key) => (
          <Kbd key={key}>{key}</Kbd>
        ))}
      </dd>
    </div>
  );
}

export default function HelpDialog() {
  const open = useUiStore((state) => state.helpOpen);
  const setOpen = useUiStore((state) => state.setHelpOpen);
  const company = useSettingsStore((state) => state.company);
  const modifier = useModifierKey();

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogContent className="max-w-[560px]">
        <DialogHeader>
          <DialogTitle>Ajuda</DialogTitle>
          <DialogDescription>
            Atalhos de teclado, dicas para trabalhar mais depressa e contacto de suporte.
          </DialogDescription>
        </DialogHeader>

        <ScrollArea viewportClassName="max-h-[60dvh]">
          <FormSection title="Atalhos de teclado">
            <dl className="divide-border -my-2 divide-y">
              <Shortcut keys={[modifier, "K"]} label="Pesquisar e navegar" />
              <Shortcut keys={["N"]} label="Criar no módulo atual" />
              <Shortcut keys={["/"]} label="Pesquisar na página" />
              <Shortcut keys={["?"]} label="Abrir esta ajuda" />
              {PAGES.map((page) => (
                <Shortcut key={page.href} keys={["G", page.shortcut]} label={`Ir para ${page.label}`} />
              ))}
            </dl>
          </FormSection>

          <FormSection title="Dicas">
            <ul className="flex list-disc flex-col gap-2 pl-4">
              {TIPS.map((tip) => (
                <li key={tip} className="lead-style text-soft">
                  {tip}
                </li>
              ))}
            </ul>
          </FormSection>

          <FormSection title="Suporte">
            <p className="lead-style text-soft">
              Dúvidas ou problemas com o CRM: escreva para{" "}
              <a className="text-foreground underline underline-offset-2" href={`mailto:${company.email}`}>
                {company.email}
              </a>{" "}
              ou ligue {company.phone}. O contacto pode ser alterado em Definições → Empresa.
            </p>
          </FormSection>
        </ScrollArea>

        <DialogFooter>
          <DialogClose asChild>
            <Button variant="primary" size="sm">
              Fechar
            </Button>
          </DialogClose>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
