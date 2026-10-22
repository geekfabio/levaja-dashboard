"use client";

import Button from "@/components/_ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuTrigger,
} from "@/components/_ui/dropdown-menu";
import { VARIABLES } from "@/data/campaigns";

type VariableMenuProps = {
  onInsert: (token: string) => void;
  disabled?: boolean;
};

export default function VariableMenu({ onInsert, disabled }: VariableMenuProps) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="sm" disabled={disabled}>
          {"{{ }}"} Variável
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <DropdownMenuLabel>Inserir variável</DropdownMenuLabel>
        {VARIABLES.map((variable) => (
          <DropdownMenuItem
            key={variable.key}
            onSelect={() => onInsert(`{{${variable.key}}}`)}
          >
            <span className="font-mono text-[12px]">{`{{${variable.key}}}`}</span>
            <span className="text-subtle">{variable.label}</span>
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
