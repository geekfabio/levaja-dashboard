import type { ComponentType, SVGProps } from "react";
import Sparkline from "@/components/_common/sparkline";
import { activitySummary } from "@/lib/company-insights";
import { nowLuandaLocal } from "@/lib/format";
import { useActivitiesStore } from "@/stores/activities-store";
import CursorClickIcon from "@/public/assets/images/companies/detail/cursor-click.svg";
import MailIcon from "@/public/assets/images/companies/detail/mail-03.svg";
import CalendarIcon from "@/public/assets/images/companies/detail/calendar.svg";
import PhoneCallIcon from "@/public/assets/images/companies/detail/phone-call.svg";

type ActivityTrendProps = {
  companyId: string;
  days: number;
};

type Stat = {
  icon: ComponentType<SVGProps<SVGSVGElement>>;
  label: string;
  value: number;
};

export default function ActivityTrend({ companyId, days }: ActivityTrendProps) {
  const activities = useActivitiesStore((state) => state.activities);
  const activity = activitySummary(activities, companyId, days, nowLuandaLocal().slice(0, 10));
  const stats: Stat[] = [
    { icon: CursorClickIcon, label: "Visitas e entregas", value: activity.visits },
    { icon: MailIcon, label: "E-mails", value: activity.emails },
    { icon: CalendarIcon, label: "Reuniões", value: activity.meetings },
    { icon: PhoneCallIcon, label: "Chamadas e reclamações", value: activity.calls },
  ];

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-col gap-1">
        <div className="flex items-baseline gap-[3px]">
          <span className="block text-[24px] leading-none">{activity.total}</span>
          {activity.total > 0 && <Sparkline values={activity.trend.map((value) => Math.max(1, Math.round((value / Math.max(...activity.trend)) * 14)))} className="h-[22px]" />}
        </div>
        <span className="caption-style block text-soft">
          {activity.total === 0
            ? `Sem atividades registadas nos últimos ${days} dias.`
            : `${activity.total === 1 ? "Atividade registada" : "Atividades registadas"} nos últimos ${days} dias.`}
        </span>
      </div>
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
        {stats.map((stat) => (
          <div
            key={stat.label}
            className="flex flex-col gap-3 rounded-lg border border-line-strong p-[11px]"
          >
            <span className="caption-style flex items-center gap-1 text-soft">
              <stat.icon aria-hidden className="size-3 shrink-0" />
              {stat.label}
            </span>
            <span className="lead-style block">{stat.value}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
