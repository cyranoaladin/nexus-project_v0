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
                return <Badge className="bg-green-100 text-green-800 hover:bg-green-100"><CheckCircle className="w-3 h-3 mr-1" /> Payé</Badge>;
            case 'PENDING':
                return <Badge className="bg-yellow-100 text-yellow-800 hover:bg-yellow-100"><Clock className="w-3 h-3 mr-1" /> En attente</Badge>;
            case 'FAILED':
                return <Badge className="bg-red-100 text-red-800 hover:bg-red-100"><XCircle className="w-3 h-3 mr-1" /> Échoué</Badge>;
            default:
                return <Badge variant="outline">{status}</Badge>;
        }
    };

    return (
        <Card>
            <CardHeader>
                <CardTitle className="flex items-center text-lg">
                    <CreditCard className="w-5 h-5 mr-2 text-gray-500" />
                    Historique des Transactions
                </CardTitle>
            </CardHeader>
            <CardContent>
                {transactions.length === 0 ? (
                    <div className="text-center py-8 text-gray-500">Aucune transaction récente.</div>
                ) : (
                    <Table>
                        <TableHeader>
                            <TableRow>
                                <TableHead>Date</TableHead>
                                <TableHead>Description</TableHead>
                                <TableHead>Montant</TableHead>
                                <TableHead className="text-right">Statut</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {transactions.map((transaction) => (
                                <TableRow key={transaction.id}>
                                    <TableCell className="font-medium">
                                        {new Date(transaction.date).toLocaleDateString('fr-FR')}
                                    </TableCell>
                                    <TableCell>{transaction.description}</TableCell>
                                    <TableCell>{transaction.amount.toFixed(2)} TND</TableCell>
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
