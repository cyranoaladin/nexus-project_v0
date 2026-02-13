"use client";

import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { CreditCard, CheckCircle, XCircle, Clock } from "lucide-react";

interface Transaction {
    id: string;
    date: string;
    amount: number;
    description: string;
    status: 'PENDING' | 'COMPLETED' | 'FAILED' | 'REFUNDED';
    type: string;
}

export function TransactionHistory({ transactions }: { transactions: Transaction[] }) {
    const getStatusBadge = (status: Transaction['status']) => {
        switch (status) {
            case 'COMPLETED':
                return <Badge className="bg-emerald-500/15 text-emerald-200 hover:bg-emerald-500/20 border border-emerald-500/20"><CheckCircle className="w-3 h-3 mr-1" /> Payé</Badge>;
            case 'PENDING':
                return <Badge className="bg-amber-500/15 text-amber-200 hover:bg-amber-500/20 border border-amber-500/20"><Clock className="w-3 h-3 mr-1" /> En attente</Badge>;
            case 'FAILED':
                return <Badge className="bg-rose-500/15 text-rose-200 hover:bg-rose-500/20 border border-rose-500/20"><XCircle className="w-3 h-3 mr-1" /> Échoué</Badge>;
            default:
                return <Badge variant="outline" className="border-white/10 text-neutral-300">{status}</Badge>;
        }
    };

    return (
        <Card className="bg-surface-card border border-white/10">
            <CardHeader>
                <CardTitle className="flex items-center text-lg text-white">
                    <CreditCard className="w-5 h-5 mr-2 text-brand-accent" />
                    Historique des Transactions
                </CardTitle>
            </CardHeader>
            <CardContent>
                {transactions.length === 0 ? (
                    <div className="text-center py-8 text-neutral-400">Aucune transaction récente.</div>
                ) : (
                    <Table>
                        <TableHeader>
                            <TableRow className="border-white/10">
                                <TableHead className="text-neutral-400">Date</TableHead>
                                <TableHead className="text-neutral-400">Description</TableHead>
                                <TableHead className="text-neutral-400">Montant</TableHead>
                                <TableHead className="text-right text-neutral-400">Statut</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {transactions.map((transaction) => (
                                <TableRow key={transaction.id} className="border-white/10 hover:bg-white/5">
                                    <TableCell className="font-medium text-neutral-200">
                                        {new Date(transaction.date).toLocaleDateString('fr-FR')}
                                    </TableCell>
                                    <TableCell className="text-neutral-300">{transaction.description}</TableCell>
                                    <TableCell className="text-neutral-200">{transaction.amount.toFixed(2)} TND</TableCell>
                                    <TableCell className="text-right">
                                        {getStatusBadge(transaction.status)}
                                    </TableCell>
                                </TableRow>
                            ))}
                        </TableBody>
                    </Table>
                )}
            </CardContent>
        </Card>
    );
}
