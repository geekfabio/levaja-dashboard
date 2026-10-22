"use client";

import { useMemo } from "react";
import { useRouter } from "next/navigation";
import { motion, useReducedMotion } from "motion/react";
import Avatar from "@/components/_ui/avatar";
import Button from "@/components/_ui/button";
import Tag from "@/components/_ui/tag";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/_ui/dropdown-menu";
import { ownerByName } from "@/data/companies";
import {
  OPPORTUNITY_STAGE_TONES,
  type Opportunity,
} from "@/data/opportunities";
import { formatDateShort } from "@/lib/format";
import { ease } from "@/lib/easings";
import { useOpportunitiesStore } from "@/stores/opportunities-store";
import DotsIcon from "@/public/assets/images/companies/table/dots-horizontal.svg";

type RecentOpportunitiesListProps = {
  opportunities: Opportunity[];
  limit?: number;
};

const CONTAINER_VARIANTS = {
  hidden: {},
  show: { transition: { staggerChildren: 0.06 } },
};

const ROW_VARIANTS = {
  hidden: { opacity: 0, y: 10 },
  show: { opacity: 1, y: 0 },
};

export default function RecentOpportunitiesList({
  opportunities,
  limit = 5,
}: RecentOpportunitiesListProps) {
  const router = useRouter();
  const openDetail = useOpportunitiesStore((state) => state.openDetail);
  const prefersReducedMotion = useReducedMotion();

  const recent = useMemo(() => {
    return opportunities
      .flatMap((opportunity) =>
        opportunity.stageHistory.map((entry) => ({ opportunity, entry })),
      )
      .sort((a, b) => b.entry.date.localeCompare(a.entry.date))
      .slice(0, limit);
  }, [opportunities, limit]);

  function handleOpen(id: string) {
    openDetail(id);
    router.push("/oportunidades");
  }

  return (
    <motion.ul
      variants={CONTAINER_VARIANTS}
      initial="hidden"
      whileInView="show"
      viewport={{ once: true, margin: "-60px" }}
      className="flex flex-col divide-y divide-border"
    >
      {recent.map(({ opportunity, entry }, index) => {
        const owner = ownerByName(opportunity.owner);
        return (
          <motion.li
            key={`${opportunity.id}-${entry.date}-${index}`}
            variants={ROW_VARIANTS}
            transition={{ duration: prefersReducedMotion ? 0 : 0.4, ease: ease.power3Out }}
            className="flex items-center gap-3 py-3 first:pt-0 last:pb-0"
          >
            <Avatar src={owner.avatar} alt="" className="size-8" />
            <div className="flex min-w-0 flex-1 flex-col gap-1">
              <span className="lead-style truncate font-medium">
                {opportunity.companyName}
              </span>
              <span className="caption-style text-subtle truncate">
                {owner.name}
              </span>
            </div>
            <Tag tone={OPPORTUNITY_STAGE_TONES[entry.stage]} size="sm">
              {entry.stage}
            </Tag>
            <span className="caption-style text-subtle hidden shrink-0 tabular-nums sm:inline">
              {formatDateShort(entry.date)}
            </span>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon-sm"
                  aria-label={`Mais ações para ${opportunity.companyName}`}
                >
                  <DotsIcon aria-hidden className="size-3" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem onSelect={() => handleOpen(opportunity.id)}>
                  Ver detalhe
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </motion.li>
        );
      })}
    </motion.ul>
  );
}
