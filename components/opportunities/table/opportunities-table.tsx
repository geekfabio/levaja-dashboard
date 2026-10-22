"use client";

import { ScrollArea } from "@/components/_ui/scroll-area";
import Tag from "@/components/_ui/tag";
import SegmentBar from "@/components/_common/segment-bar";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/_ui/table";
import { OPPORTUNITY_STAGE_TONES, type Opportunity } from "@/data/opportunities";
import { formatDateShort, formatMoney } from "@/lib/format";
import { useOpportunitiesStore } from "@/stores/opportunities-store";

type OpportunitiesTableProps = {
  opportunities: Opportunity[];
};

export default function OpportunitiesTable({
  opportunities,
}: OpportunitiesTableProps) {
  const openDetail = useOpportunitiesStore((state) => state.openDetail);

  return (
    <ScrollArea orientation="both" className="min-h-0 flex-1">
      <Table className="min-w-[860px]">
        <TableHeader>
          <TableRow>
            <TableHead>Cliente</TableHead>
            <TableHead>Contacto</TableHead>
            <TableHead>Fase</TableHead>
            <TableHead className="text-right">Valor</TableHead>
            <TableHead className="text-right">Probabilidade</TableHead>
            <TableHead>Data prevista de fecho</TableHead>
            <TableHead>Gestor</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {opportunities.map((opportunity) => (
            <TableRow
              key={opportunity.id}
              onClick={() => openDetail(opportunity.id)}
              className="hover:bg-card/60 cursor-pointer"
            >
              <TableCell className="font-medium">
                {opportunity.companyName}
              </TableCell>
              <TableCell className="text-soft">
                {opportunity.contactName}
              </TableCell>
              <TableCell>
                <Tag tone={OPPORTUNITY_STAGE_TONES[opportunity.stage]}>
                  {opportunity.stage}
                </Tag>
              </TableCell>
              <TableCell className="text-right tabular-nums">
                {formatMoney(opportunity.value)}
              </TableCell>
              <TableCell className="text-right">
                <span className="flex items-center justify-end gap-2 tabular-nums">
                  <SegmentBar
                    percent={opportunity.probability}
                    className="w-[60px]"
                  />
                  <span className="w-[4ch]">{opportunity.probability}%</span>
                </span>
              </TableCell>
              <TableCell className="tabular-nums">
                {formatDateShort(opportunity.expectedCloseDate)}
              </TableCell>
              <TableCell className="text-soft">{opportunity.owner}</TableCell>
            </TableRow>
          ))}
          {opportunities.length === 0 && (
            <TableRow>
              <TableCell
                colSpan={7}
                className="caption-style text-subtle h-[120px] text-center"
              >
                Nenhuma oportunidade corresponde aos filtros atuais.
              </TableCell>
            </TableRow>
          )}
        </TableBody>
      </Table>
    </ScrollArea>
  );
}
