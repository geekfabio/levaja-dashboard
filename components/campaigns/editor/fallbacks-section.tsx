"use client";

import Field from "@/components/_ui/field";
import { Input } from "@/components/_ui/input";
import { VARIABLES, type Campaign } from "@/data/campaigns";
import { useCampaignsStore } from "@/stores/campaigns-store";

type FallbacksSectionProps = {
  campaign: Campaign;
  readOnly: boolean;
};

export default function FallbacksSection({ campaign, readOnly }: FallbacksSectionProps) {
  const setFallback = useCampaignsStore((state) => state.setFallback);

  return (
    <section className="border-border flex flex-col gap-4 rounded-xl border p-5">
      <h2 className="eyebrow-style text-faint font-normal">
        Variáveis de personalização
      </h2>
      <span className="caption-style text-subtle">
        Cada variável precisa de um valor por omissão, usado quando o contacto
        não tem esse dado.
      </span>
      <div className="flex flex-col gap-3">
        {VARIABLES.map((variable) => {
          const id = `fallback-${variable.key}`;
          const empty = !campaign.fallbacks[variable.key].trim();
          return (
            <Field
              key={variable.key}
              label={`{{${variable.key}}} · ${variable.label}`}
              htmlFor={id}
              required
              error={empty ? "Valor por omissão obrigatório." : undefined}
            >
              <Input
                id={id}
                value={campaign.fallbacks[variable.key]}
                disabled={readOnly}
                aria-invalid={empty || undefined}
                className="aria-invalid:border-danger"
                onChange={(event) =>
                  setFallback(campaign.id, variable.key, event.target.value)
                }
              />
            </Field>
          );
        })}
      </div>
    </section>
  );
}
