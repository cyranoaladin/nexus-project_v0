"use client";

import { useState } from "react";

interface SearchBoxProps {
  onSearch?: (query: string) => void;
  placeholder?: string;
}

export function SearchBox({ onSearch, placeholder = "Rechercher une ressource" }: SearchBoxProps) {
  const [query, setQuery] = useState("");

  function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    onSearch?.(query.trim());
  }

  return (
    <form onSubmit={handleSubmit} className="flex items-center gap-2 rounded-full border border-slate-300 bg-white px-3 py-2 shadow-sm">
      <input
        className="flex-1 border-none bg-transparent text-sm text-slate-700 outline-none placeholder:text-slate-400"
        value={query}
        onChange={(event) => setQuery(event.target.value)}
        placeholder={placeholder}
        aria-label="Recherche RAG"
      />
      <button
        type="submit"
        className="rounded-full bg-slate-900 px-3 py-1 text-xs font-semibold uppercase tracking-wide text-white"
      >
        Rechercher
      </button>
    </form>
  );
}
