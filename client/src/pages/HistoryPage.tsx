import { useEffect, useState } from "react";
import { Layout } from "../components/Layout";
import { Card } from "../components/Card";
import { userApi } from "../services/userApi";
import { TransactionEntry } from "../types";

const typeLabels: Record<string, string> = {
  ADMIN_ADD: "Fichas adicionadas pelo DIRE",
  ADMIN_REMOVE: "Fichas removidas pelo DIRE",
  BUY_IN: "Fichas iniciais",
  BET: "Aposta",
  CALL: "Pagamento",
  RAISE: "Aumento",
  POT_WIN: "Pote recebido",
  REFUND: "Reembolso",
};

const isPositive = (type: string) => ["ADMIN_ADD", "BUY_IN", "POT_WIN", "REFUND"].includes(type);

export default function HistoryPage() {
  const [transactions, setTransactions] = useState<TransactionEntry[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    userApi
      .myTransactions()
      .then(setTransactions)
      .finally(() => setLoading(false));
  }, []);

  return (
    <Layout>
      <div className="max-w-3xl mx-auto px-4 py-6">
        <h1 className="text-xl font-bold mb-1">Meu histórico</h1>
        <p className="text-white/50 text-sm mb-6">Todas as movimentações de fichas virtuais registradas nas suas mesas.</p>

        {loading && <p className="text-white/40 text-sm">Carregando...</p>}

        <div className="space-y-2">
          {transactions.map((tx) => (
            <Card key={tx.id} className="flex items-center justify-between py-3">
              <div>
                <p className="font-medium text-sm">{typeLabels[tx.type] ?? tx.type}</p>
                <p className="text-xs text-white/40 mt-0.5">
                  {tx.tableName} · {new Date(tx.createdAt).toLocaleString("pt-BR")}
                </p>
                {tx.description && <p className="text-xs text-white/30 mt-0.5">{tx.description}</p>}
              </div>
              <span className={`font-bold ${isPositive(tx.type) ? "text-emerald-400" : "text-red-400"}`}>
                {isPositive(tx.type) ? "+" : "-"}
                {tx.amount}
              </span>
            </Card>
          ))}
          {!loading && transactions.length === 0 && <p className="text-white/40 text-sm">Nenhuma movimentação ainda.</p>}
        </div>
      </div>
    </Layout>
  );
}
