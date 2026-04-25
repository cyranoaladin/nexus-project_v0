"use client";

import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Eye, TrendingUp, AlertTriangle } from "lucide-react";
import Link from "next/link";

interface StudentRow {
  id: string;
  name: string;
  gradeLevel: string;
  academicTrack: string;
  nexusIndex: number | null;
  lastSession: string;
  status: 'STABLE' | 'WARNING' | 'CRITICAL';
}

interface CohortTableProps {
  students: StudentRow[];
}

export function CohortTable({ students }: CohortTableProps) {
  return (
    <div className="bg-surface-card border border-white/10 rounded-xl overflow-hidden">
      <Table>
        <TableHeader className="bg-white/5">
          <TableRow className="border-white/10 hover:bg-transparent">
            <TableHead className="text-neutral-400 font-bold uppercase text-[10px]">Élève</TableHead>
            <TableHead className="text-neutral-400 font-bold uppercase text-[10px]">Filière</TableHead>
            <TableHead className="text-neutral-400 font-bold uppercase text-[10px]">NexusIndex</TableHead>
            <TableHead className="text-neutral-400 font-bold uppercase text-[10px]">Statut</TableHead>
            <TableHead className="text-neutral-400 font-bold uppercase text-[10px] text-right">Actions</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {students.map((student) => (
            <TableRow key={student.id} className="border-white/10 hover:bg-white/5 transition-colors">
              <TableCell>
                <div className="font-medium text-white">{student.name}</div>
                <div className="text-[10px] text-neutral-500">
                  Dernier cours: {new Date(student.lastSession).toLocaleDateString('fr-FR')}
                </div>
              </TableCell>
              <TableCell>
                <Badge variant="outline" className="text-[10px] border-white/10 text-neutral-400">
                  {student.gradeLevel} {student.academicTrack === 'STMG' ? 'STMG' : 'EDS'}
                </Badge>
              </TableCell>
              <TableCell>
                <div className="flex items-center gap-2">
                  <div className="text-sm font-bold text-brand-accent">{student.nexusIndex ?? '--'}</div>
                  <TrendingUp className="w-3 h-3 text-emerald-500/50" />
                </div>
              </TableCell>
              <TableCell>
                <div className="flex items-center gap-1.5">
                  <div className={`w-2 h-2 rounded-full ${
                    student.status === 'CRITICAL' ? 'bg-rose-500 animate-pulse' : 
                    student.status === 'WARNING' ? 'bg-amber-500' : 'bg-emerald-500'
                  }`} />
                  <span className="text-xs text-neutral-400 capitalize">{student.status.toLowerCase()}</span>
                </div>
              </TableCell>
              <TableCell className="text-right">
                <Link href={`/dashboard/coach/eleve/${student.id}`}>
                  <Button variant="ghost" size="sm" className="hover:bg-brand-accent/10 hover:text-brand-accent">
                    <Eye className="w-4 h-4 mr-2" />
                    Dossier
                  </Button>
                </Link>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}
