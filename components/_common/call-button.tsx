"use client";

import Button from "@/components/_ui/button";
import { normalizeAngolanPhone } from "@/lib/phone";
import { useActivitiesStore } from "@/stores/activities-store";
import PhoneIcon from "@/public/assets/images/companies/detail/phone.svg";

type CallButtonProps = {
  phone: string;
  companyId: string;
  label?: string;
  variant?: "ghost" | "secondary";
};

export default function CallButton({ phone, companyId, label, variant = "ghost" }: CallButtonProps) {
  const startActivity = useActivitiesStore((state) => state.startActivity);
  const e164 = normalizeAngolanPhone(phone);
  if (!e164) return null;

  return (
    <Button
      variant={variant}
      size="sm"
      href={`tel:${e164}`}
      aria-label={`Ligar para ${phone}`}
      onClick={() =>
        window.setTimeout(
          () => startActivity({ companyId, type: "Chamada", followUpNote: `Chamada para ${phone}.` }),
          400,
        )
      }
    >
      <PhoneIcon aria-hidden className="size-3" />
      {label ?? phone}
    </Button>
  );
}
