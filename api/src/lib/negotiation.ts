export const NEGOTIATION_STEP_KZ = 50;
export const NEGOTIATION_RANGE_PERCENT = 0.15;

function roundToStep(value: number) {
  return Math.round(value / NEGOTIATION_STEP_KZ) * NEGOTIATION_STEP_KZ;
}

/** Limites de negociação a partir do valor do serviço estimado (sem a taxa da plataforma). */
export function negotiationBounds(baseServiceAmountKz: number) {
  const span = roundToStep(baseServiceAmountKz * NEGOTIATION_RANGE_PERCENT);
  return {
    minKz: Math.max(NEGOTIATION_STEP_KZ, baseServiceAmountKz - span),
    maxKz: baseServiceAmountKz + span,
  };
}

export function clampAmount(amountKz: number, minKz: number, maxKz: number) {
  return Math.min(maxKz, Math.max(minKz, amountKz));
}
