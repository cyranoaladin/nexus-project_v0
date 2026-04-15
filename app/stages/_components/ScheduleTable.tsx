"use client";

import { useState } from "react";
import { motion } from "framer-motion";
import { Search, Table as TableIcon, X } from "lucide-react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { buildScheduleTableData } from "../_data/schedules";
import { ALL_OFFERS, type Offer } from "../_data/offers";

interface Props {
  onReserve: (offer: Offer) => void;
}

const LEVEL_LABELS = { premiere: "Première", terminale: "Terminale" };
const TYPE_BADGE: Record<string, string> = {
  mono: "bg-blue-500/15 text-blue-300 border-blue-500/25",
  duo: "bg-violet-500/15 text-violet-300 border-violet-500/25",
  trio: "bg-emerald-500/15 text-emerald-300 border-emerald-500/25",
  complement: "bg-amber-500/15 text-amber-300 border-amber-500/25",
};

export default function ScheduleTable({ onReserve }: Props) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");
  const data = buildScheduleTableData();

  const filtered = data.filter((row) => {
    const haystack = [row.date, row.time, row.subject, row.offer, row.level].join(" ").toLowerCase();
    return haystack.includes(search.toLowerCase());
  });

  const rowsByLevel = (level: string) =>
    filtered.filter((r) => r.level === level);

  return (
    <>
      <section className="border-t border-white/10 bg-[#0B1018] px-4 py-16 sm:px-6 lg:px-8">
        <div className="mx-auto max-w-5xl text-center">
          <h2 className="font-display text-3xl font-bold text-white md:text-4xl">
            Tableau récapitulatif complet
          </h2>
          <p className="mx-auto mt-4 max-w-2xl text-base text-slate-300">
            Consultez l&apos;ensemble des créneaux, matières et niveaux en un coup d&apos;œil.
          </p>
          <Button
            onClick={() => setOpen(true)}
            className="mt-8 rounded-full bg-gradient-to-r from-blue-600 to-violet-600 px-6 text-white hover:from-blue-700 hover:to-violet-700"
          >
            <TableIcon className="mr-2 h-4 w-4" />
            Voir le tableau complet
          </Button>
        </div>
      </section>

      {open && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
          <div
            className="absolute inset-0 bg-black/80 backdrop-blur-sm"
            onClick={() => setOpen(false)}
            aria-hidden="true"
          />
          <motion.div
            initial={{ opacity: 0, scale: 0.96 }}
            animate={{ opacity: 1, scale: 1 }}
            className="relative z-10 flex max-h-[90vh] w-full max-w-6xl flex-col overflow-hidden rounded-3xl border border-white/10 bg-[#0B1018] shadow-2xl"
          >
            <div className="flex items-center justify-between border-b border-white/10 p-5">
              <h3 className="flex items-center gap-2 text-xl font-bold text-white">
                <TableIcon className="h-5 w-5" />
                Tableau récapitulatif complet
              </h3>
              <button
                onClick={() => setOpen(false)}
                className="rounded-full p-2 text-white/50 transition hover:bg-white/[0.06] hover:text-white"
                aria-label="Fermer"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="border-b border-white/10 p-4">
              <div className="relative">
                <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-white/40" />
                <input
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Rechercher une date, matière ou formule..."
                  className="w-full rounded-xl border border-white/10 bg-white/[0.03] py-2.5 pl-10 pr-4 text-sm text-white placeholder:text-white/30 focus:border-blue-500/40 focus:outline-none"
                />
              </div>
            </div>

            <div className="flex-1 overflow-auto p-5">
              <Tabs defaultValue="all">
                <TabsList className="mb-4 bg-white/[0.03]">
                  <TabsTrigger value="all">Tous</TabsTrigger>
                  <TabsTrigger value="premiere">Première</TabsTrigger>
                  <TabsTrigger value="terminale">Terminale</TabsTrigger>
                </TabsList>

                <TabsContent value="all">
                  <ScheduleRows rows={filtered} onReserve={onReserve} />
                </TabsContent>
                <TabsContent value="premiere">
                  <ScheduleRows rows={rowsByLevel("premiere")} onReserve={onReserve} />
                </TabsContent>
                <TabsContent value="terminale">
                  <ScheduleRows rows={rowsByLevel("terminale")} onReserve={onReserve} />
                </TabsContent>
              </Tabs>
            </div>

            <div className="flex justify-end gap-2 border-t border-white/10 p-4">
              <Button
                variant="outline"
                onClick={() => setOpen(false)}
                className="rounded-xl border-white/10 bg-transparent text-white hover:bg-white/[0.06]"
              >
                Fermer
              </Button>
            </div>
          </motion.div>
        </div>
      )}
    </>
  );
}

function ScheduleRows({
  rows,
  onReserve,
}: {
  rows: ReturnType<typeof buildScheduleTableData>;
  onReserve: (offer: Offer) => void;
}) {
  if (rows.length === 0) {
    return (
      <div className="py-10 text-center text-sm text-slate-400">
        Aucun créneau ne correspond à votre recherche.
      </div>
    );
  }

  return (
    <div className="overflow-x-auto rounded-2xl border border-white/10">
      <Table>
        <TableHeader>
          <TableRow className="border-white/10 bg-white/[0.03] hover:bg-white/[0.03]">
            <TableHead className="text-slate-300">Date</TableHead>
            <TableHead className="text-slate-300">Horaire</TableHead>
            <TableHead className="text-slate-300">Matière</TableHead>
            <TableHead className="text-slate-300">Type</TableHead>
            <TableHead className="text-slate-300">Niveau</TableHead>
            <TableHead className="text-slate-300">Formule</TableHead>
            <TableHead className="text-right text-slate-300">Action</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {rows.map((row, i) => (
            <TableRow
              key={i}
              className="group border-white/5 transition-colors hover:bg-white/[0.03]"
            >
              <TableCell className="font-medium text-white">{row.date}</TableCell>
              <TableCell className="text-slate-300">{row.time}</TableCell>
              <TableCell>
                <Badge
                  variant="outline"
                  className="border-white/10 capitalize text-slate-300"
                >
                  {row.subject}
                </Badge>
              </TableCell>
              <TableCell>
                <span
                  className={`inline-flex rounded-full border px-2 py-0.5 text-[10px] font-medium ${
                    TYPE_BADGE[row.type] || "bg-white/[0.05] text-slate-300 border-white/10"
                  }`}
                >
                  {row.type === "mono"
                    ? "1 matière"
                    : row.type === "duo"
                    ? "2 matières"
                    : row.type === "trio"
                    ? "Parcours"
                    : "Add-on"}
                </span>
              </TableCell>
              <TableCell className="text-slate-300">
                {LEVEL_LABELS[row.level as keyof typeof LEVEL_LABELS]}
              </TableCell>
              <TableCell className="max-w-[220px] truncate text-slate-300">
                {row.offer}
              </TableCell>
              <TableCell className="text-right">
                <button
                  onClick={() => {
                    const offer = ALL_OFFERS.find((o) => o.id === row.offerId);
                    if (offer) onReserve(offer);
                  }}
                  className="rounded-lg px-3 py-1.5 text-xs font-medium text-white opacity-0 transition hover:bg-white/[0.08] group-hover:opacity-100"
                >
                  Réserver
                </button>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}
