"use client";

import { useEffect, useState } from "react";
import { Input } from "@/components/_ui/input";
import SearchIcon from "@/public/assets/images/_common/search.svg";

type SearchFieldProps = { label: string; placeholder: string; onSearch: (value: string) => void };

export default function SearchField({ label, placeholder, onSearch }: SearchFieldProps) {
  const [query, setQuery] = useState("");

  useEffect(() => {
    const timer = setTimeout(() => onSearch(query.trim()), 300);
    return () => clearTimeout(timer);
  }, [query, onSearch]);

  return (
    <label className="relative flex min-w-[220px] flex-1 items-center sm:max-w-[320px]">
      <span className="sr-only">{label}</span>
      <SearchIcon aria-hidden className="text-subtle pointer-events-none absolute left-3 size-3.5" />
      <Input type="search" value={query} placeholder={placeholder} onChange={(event) => setQuery(event.target.value)} className="h-[30px] pl-8 text-[13px]" />
    </label>
  );
}
