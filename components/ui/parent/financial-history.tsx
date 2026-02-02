"use client"

import * as React from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Input } from "@/components/ui/input"
import { DollarSign, Download, ArrowUpDown, ArrowUp, ArrowDown, Filter, X } from "lucide-react"
import { formatDate, formatPrice } from "@/lib/utils"

interface FinancialTransaction {
  id: string;
  type: string;
  description: string;
  amount: number;
  status?: string;
  date: Date;
  childId?: string;
  childName?: string;
}

interface FinancialHistoryProps {
  transactions: FinancialTransaction[];
  children?: Array<{ id: string; firstName: string; lastName: string }>;
}

type SortField = "date" | "type" | "amount" | "status" | "child";
type SortDirection = "asc" | "desc";

const STATUS_COLORS = {
  COMPLETED: "bg-green-100 text-green-800 border-green-200",
  PENDING: "bg-yellow-100 text-yellow-800 border-yellow-200",
  FAILED: "bg-red-100 text-red-800 border-red-200",
  REFUNDED: "bg-blue-100 text-blue-800 border-blue-200",
  CANCELLED: "bg-neutral-100 text-neutral-800 border-neutral-200"
} as const;

const STATUS_LABELS = {
  COMPLETED: "Complétée",
  PENDING: "En attente",
  FAILED: "Échouée",
  REFUNDED: "Remboursée",
  CANCELLED: "Annulée"
} as const;

export function FinancialHistory({ transactions, children = [] }: FinancialHistoryProps) {
  const [typeFilter, setTypeFilter] = React.useState<string>("all");
  const [childFilter, setChildFilter] = React.useState<string>("all");
  const [dateFrom, setDateFrom] = React.useState<string>("");
  const [dateTo, setDateTo] = React.useState<string>("");
  const [statusFilter, setStatusFilter] = React.useState<string>("all");
  const [sortField, setSortField] = React.useState<SortField>("date");
  const [sortDirection, setSortDirection] = React.useState<SortDirection>("desc");
  const [displayedCount, setDisplayedCount] = React.useState<number>(20);

  const transactionTypes = React.useMemo(() => {
    const types = new Set<string>();
    transactions.forEach(t => types.add(t.type));
    return Array.from(types).sort();
  }, [transactions]);

  const statuses = React.useMemo(() => {
    const statusSet = new Set<string>();
    transactions.forEach(t => {
      if (t.status) statusSet.add(t.status);
    });
    return Array.from(statusSet).sort();
  }, [transactions]);

  const filteredTransactions = React.useMemo(() => {
    let filtered = [...transactions];

    if (typeFilter !== "all") {
      filtered = filtered.filter(t => t.type === typeFilter);
    }

    if (childFilter !== "all") {
      filtered = filtered.filter(t => t.childId === childFilter);
    }

    if (statusFilter !== "all") {
      filtered = filtered.filter(t => t.status === statusFilter);
    }

    if (dateFrom) {
      const fromDate = new Date(dateFrom);
      filtered = filtered.filter(t => new Date(t.date) >= fromDate);
    }

    if (dateTo) {
      const toDate = new Date(dateTo);
      toDate.setHours(23, 59, 59, 999);
      filtered = filtered.filter(t => new Date(t.date) <= toDate);
    }

    return filtered;
  }, [transactions, typeFilter, childFilter, statusFilter, dateFrom, dateTo]);

  const sortedTransactions = React.useMemo(() => {
    const sorted = [...filteredTransactions];

    sorted.sort((a, b) => {
      let aValue: any;
      let bValue: any;

      switch (sortField) {
        case "date":
          aValue = new Date(a.date).getTime();
          bValue = new Date(b.date).getTime();
          break;
        case "type":
          aValue = a.type;
          bValue = b.type;
          break;
        case "amount":
          aValue = a.amount;
          bValue = b.amount;
          break;
        case "status":
          aValue = a.status || "";
          bValue = b.status || "";
          break;
        case "child":
          aValue = a.childName || "";
          bValue = b.childName || "";
          break;
        default:
          return 0;
      }

      if (aValue < bValue) return sortDirection === "asc" ? -1 : 1;
      if (aValue > bValue) return sortDirection === "asc" ? 1 : -1;
      return 0;
    });

    return sorted;
  }, [filteredTransactions, sortField, sortDirection]);

  const displayedTransactions = sortedTransactions.slice(0, displayedCount);
  const hasMore = displayedCount < sortedTransactions.length;

  const handleSort = (field: SortField) => {
    if (sortField === field) {
      setSortDirection(sortDirection === "asc" ? "desc" : "asc");
    } else {
      setSortField(field);
      setSortDirection("desc");
    }
  };

  const getSortIcon = (field: SortField) => {
    if (sortField !== field) {
      return <ArrowUpDown className="w-4 h-4 ml-1 text-neutral-400" />;
    }
    return sortDirection === "asc" 
      ? <ArrowUp className="w-4 h-4 ml-1 text-brand-primary" />
      : <ArrowDown className="w-4 h-4 ml-1 text-brand-primary" />;
  };

  const handleLoadMore = () => {
    setDisplayedCount(prev => prev + 20);
  };

  const handleExportCSV = () => {
    const headers = ["Date", "Type", "Description", "Montant (TND)", "Statut", "Enfant"];
    const rows = sortedTransactions.map(t => [
      formatDate(new Date(t.date)),
      t.type,
      t.description,
      t.amount.toString(),
      t.status || "N/A",
      t.childName || "N/A"
    ]);

    const csvContent = [
      headers.join(","),
      ...rows.map(row => row.map(cell => `"${cell}"`).join(","))
    ].join("\n");

    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const link = document.createElement("a");
    const url = URL.createObjectURL(blob);
    link.setAttribute("href", url);
    link.setAttribute("download", `transactions_${new Date().toISOString().split('T')[0]}.csv`);
    link.style.visibility = "hidden";
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const clearFilters = () => {
    setTypeFilter("all");
    setChildFilter("all");
    setStatusFilter("all");
    setDateFrom("");
    setDateTo("");
  };

  const hasActiveFilters = typeFilter !== "all" || childFilter !== "all" || statusFilter !== "all" || dateFrom || dateTo;

  return (
    <Card>
      <CardHeader>
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div className="flex items-center gap-2">
            <DollarSign className="w-5 h-5 text-brand-primary" />
            <div>
              <CardTitle>Historique Financier</CardTitle>
              <CardDescription>
                Paiements et transactions de crédits ({sortedTransactions.length} transaction{sortedTransactions.length > 1 ? "s" : ""})
              </CardDescription>
            </div>
          </div>

          <div className="flex gap-2">
            {hasActiveFilters && (
              <Button variant="ghost" size="sm" onClick={clearFilters}>
                <X className="w-4 h-4 mr-1" />
                Réinitialiser
              </Button>
            )}
            <Button 
              variant="outline" 
              size="sm" 
              onClick={handleExportCSV}
              disabled={sortedTransactions.length === 0}
            >
              <Download className="w-4 h-4 mr-2" />
              Exporter CSV
            </Button>
          </div>
        </div>
      </CardHeader>

      <CardContent>
        <div className="mb-6 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3">
          <Select value={typeFilter} onValueChange={setTypeFilter}>
            <SelectTrigger className="h-10">
              <SelectValue placeholder="Type" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Tous les types</SelectItem>
              {transactionTypes.map(type => (
                <SelectItem key={type} value={type}>
                  {type}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          {children.length > 0 && (
            <Select value={childFilter} onValueChange={setChildFilter}>
              <SelectTrigger className="h-10">
                <SelectValue placeholder="Enfant" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Tous les enfants</SelectItem>
                {children.map(child => (
                  <SelectItem key={child.id} value={child.id}>
                    {child.firstName} {child.lastName}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}

          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="h-10">
              <SelectValue placeholder="Statut" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Tous les statuts</SelectItem>
              {statuses.map(status => (
                <SelectItem key={status} value={status}>
                  {STATUS_LABELS[status as keyof typeof STATUS_LABELS] || status}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Input
            type="date"
            value={dateFrom}
            onChange={(e) => setDateFrom(e.target.value)}
            placeholder="Date début"
            className="h-10"
          />

          <Input
            type="date"
            value={dateTo}
            onChange={(e) => setDateTo(e.target.value)}
            placeholder="Date fin"
            className="h-10"
          />
        </div>

        {displayedTransactions.length === 0 ? (
          <div className="text-center py-16">
            <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-neutral-100 mb-4">
              <DollarSign className="w-8 h-8 text-neutral-400" />
            </div>
            <p className="text-neutral-600 font-medium mb-1">
              Aucune transaction trouvée
            </p>
            <p className="text-sm text-neutral-500">
              {hasActiveFilters 
                ? "Essayez de modifier les filtres"
                : "Les transactions apparaîtront ici"}
            </p>
          </div>
        ) : (
          <>
            <div className="rounded-lg border border-neutral-200 overflow-hidden">
              <Table>
                <TableHeader>
                  <TableRow className="bg-neutral-50">
                    <TableHead 
                      className="cursor-pointer select-none hover:bg-neutral-100"
                      onClick={() => handleSort("date")}
                    >
                      <div className="flex items-center">
                        Date
                        {getSortIcon("date")}
                      </div>
                    </TableHead>
                    <TableHead 
                      className="cursor-pointer select-none hover:bg-neutral-100"
                      onClick={() => handleSort("type")}
                    >
                      <div className="flex items-center">
                        Type
                        {getSortIcon("type")}
                      </div>
                    </TableHead>
                    <TableHead>Description</TableHead>
                    <TableHead 
                      className="cursor-pointer select-none hover:bg-neutral-100 text-right"
                      onClick={() => handleSort("amount")}
                    >
                      <div className="flex items-center justify-end">
                        Montant
                        {getSortIcon("amount")}
                      </div>
                    </TableHead>
                    <TableHead 
                      className="cursor-pointer select-none hover:bg-neutral-100"
                      onClick={() => handleSort("status")}
                    >
                      <div className="flex items-center">
                        Statut
                        {getSortIcon("status")}
                      </div>
                    </TableHead>
                    {children.length > 0 && (
                      <TableHead 
                        className="cursor-pointer select-none hover:bg-neutral-100"
                        onClick={() => handleSort("child")}
                      >
                        <div className="flex items-center">
                          Enfant
                          {getSortIcon("child")}
                        </div>
                      </TableHead>
                    )}
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {displayedTransactions.map((transaction) => (
                    <TableRow key={transaction.id}>
                      <TableCell className="font-medium text-neutral-900">
                        {formatDate(new Date(transaction.date))}
                      </TableCell>
                      <TableCell>
                        <span className="text-sm text-neutral-700">
                          {transaction.type}
                        </span>
                      </TableCell>
                      <TableCell className="max-w-xs">
                        <span className="text-sm text-neutral-600 line-clamp-2">
                          {transaction.description}
                        </span>
                      </TableCell>
                      <TableCell className="text-right">
                        <span 
                          className={`font-semibold ${
                            transaction.amount >= 0 
                              ? "text-green-600" 
                              : "text-red-600"
                          }`}
                        >
                          {transaction.amount >= 0 ? "+" : ""}
                          {formatPrice(transaction.amount)}
                        </span>
                      </TableCell>
                      <TableCell>
                        {transaction.status ? (
                          <Badge 
                            className={`${
                              STATUS_COLORS[transaction.status as keyof typeof STATUS_COLORS] || 
                              "bg-neutral-100 text-neutral-800 border-neutral-200"
                            } border font-medium`}
                          >
                            {STATUS_LABELS[transaction.status as keyof typeof STATUS_LABELS] || transaction.status}
                          </Badge>
                        ) : (
                          <span className="text-sm text-neutral-400">N/A</span>
                        )}
                      </TableCell>
                      {children.length > 0 && (
                        <TableCell>
                          <span className="text-sm text-neutral-700">
                            {transaction.childName || "Parent"}
                          </span>
                        </TableCell>
                      )}
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>

            {hasMore && (
              <div className="mt-6 text-center">
                <Button variant="outline" onClick={handleLoadMore}>
                  Charger plus ({sortedTransactions.length - displayedCount} restantes)
                </Button>
              </div>
            )}

            <div className="mt-4 text-sm text-neutral-500 text-center">
              Affichage de {displayedTransactions.length} sur {sortedTransactions.length} transaction{sortedTransactions.length > 1 ? "s" : ""}
            </div>
          </>
        )}
      </CardContent>
    </Card>
  );
}
