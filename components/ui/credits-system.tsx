'use client';

import { Calculator, Clock, Zap } from 'lucide-react';
import { Badge } from './badge';
import { Card, CardContent } from './card';




interface CreditsSystemProps {
  balance: number;
  transactions: Array<{
    id: string;
    amount: number;
    type: 'DEBIT' | 'CREDIT';
    description: string;
    date: string;
  }>;
}

export function CreditsSystem({ balance, transactions }: CreditsSystemProps) {
  return (
    <Card className="bg-gradient-to-r from-blue-600 to-slate-700 text-white border-0 shadow-lg">
      <CardContent className="p-6">
        <div className="flex items-center justify-between mb-6">
          <div>
            <p className="text-blue-100 font-medium mb-1">Solde de Crédits</p>
            <div className="text-3xl font-bold flex items-center gap-2">
              <Calculator className="w-8 h-8" />
              {balance}
            </div>
          </div>
          <div className="hidden sm:block">
            <Badge className="bg-white/20 text-white border-0">
              <Zap className="w-4 h-4 mr-1" />
              Actif
            </Badge>
          </div>
        </div>

        <div className="space-y-4">
          <h3 className="text-sm font-medium text-blue-100 uppercase tracking-wider">
            Dernières Transactions
          </h3>
          <div className="bg-white/10 rounded-lg p-4 space-y-3">
            {transactions.length === 0 ? (
              <p className="text-sm text-blue-100 text-center">Aucune transaction récente</p>
            ) : (
              transactions.slice(0, 3).map((tx) => (
                <div key={tx.id} className="flex justify-between items-center text-sm">
                  <div className="flex items-center gap-3">
                    <div className={`p-1.5 rounded-full ${tx.type === 'CREDIT' ? 'bg-green-500/20' : 'bg-slate-1000/20'}`}>
                      {tx.type === 'CREDIT' ? <Zap className="w-3 h-3" /> : <Clock className="w-3 h-3" />}
                    </div>
                    <span className="truncate max-w-[150px]">{tx.description}</span>
                  </div>
                  <span className={`font-mono font-medium ${tx.type === 'CREDIT' ? 'text-green-300' : 'text-slate-200'}`}>
                    {tx.type === 'CREDIT' ? '+' : '-'}{tx.amount}
                  </span>
                </div>
              ))
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
