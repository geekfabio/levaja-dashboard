import { providerDisplayStatus } from "@/lib/leva-ja/eligibility";
import { DOCUMENT_STATE_LABELS, PROVIDER_STATUS_LABELS } from "@/lib/leva-ja/services";
import type { StatusTone } from "@/lib/leva-ja/status";
import type { DocumentState, ProviderAccount } from "@/types/leva-ja";
import { ToneBadge } from "./status-badge";

const PROVIDER_TONES = { online: "success", offline: "neutral", suspended: "danger" } as const;

export function ProviderStatusBadge({ provider }: { provider: Pick<ProviderAccount, "accountStatus" | "availability"> }) {
  if (provider.accountStatus === "pending_approval") return <ToneBadge tone="warning" label="Por aprovar" />;
  const status = providerDisplayStatus(provider);
  return <ToneBadge tone={PROVIDER_TONES[status]} label={PROVIDER_STATUS_LABELS[status]} />;
}

export function VerificationBadge({ verified }: { verified: boolean }) {
  return <ToneBadge tone={verified ? "success" : "warning"} label={verified ? "Verificado" : "Por verificar"} />;
}

const DOCUMENT_TONES: Record<DocumentState, StatusTone> = {
  verified: "success",
  pending: "warning",
  expired: "danger",
  needs_update: "danger",
};

export function DocumentStateBadge({ state }: { state: DocumentState }) {
  return <ToneBadge tone={DOCUMENT_TONES[state]} label={DOCUMENT_STATE_LABELS[state]} />;
}
