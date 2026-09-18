import { useEffect, useState } from "react";
import { Layout } from "../components/Layout";
import { Card } from "../components/Card";
import { useAuth } from "../contexts/AuthContext";
import { tableApi } from "../services/tableApi";
import { TableView } from "../types";

export default function Profile() {
  const { user } = useAuth();
  const [tables, setTables] = useState<TableView[]>([]);

  useEffect(() => {
    tableApi.list(true).then(setTables).catch(() => setTables([]));
  }, []);

  return (
    <Layout>
      <div className="max-w-3xl mx-auto px-4 py-6 space-y-6">
        <Card className="flex items-center gap-4">
          <div className="w-16 h-16 rounded-full bg-gold/20 text-gold flex items-center justify-center text-2xl font-bold">
            {user?.displayName?.[0]?.toUpperCase()}
          </div>
          <div>
            <h1 className="text-xl font-bold">{user?.displayName}</h1>
            <p className="text-white/50 text-sm">@{user?.username}</p>
            <p className="text-white/30 text-xs mt-1">ID: {user?.id}</p>
          </div>
        </Card>

        <div className="grid grid-cols-2 gap-3">
          <Card className="text-center">
            <p className="text-white/50 text-xs uppercase">Fichas virtuais</p>
            <p className="text-2xl font-bold text-gold mt-1">{user?.chips}</p>
          </Card>
          <Card className="text-center">
            <p className="text-white/50 text-xs uppercase">Mesas participadas</p>
            <p className="text-2xl font-bold mt-1">{tables.length}</p>
          </Card>
        </div>

        <section>
          <h2 className="text-sm font-semibold text-white/60 uppercase tracking-wide mb-3">Minhas mesas</h2>
          <div className="space-y-2">
            {tables.length === 0 && <p className="text-white/40 text-sm">Você ainda não participa de nenhuma mesa.</p>}
            {tables.map((t) => (
              <Card key={t.id} className="flex items-center justify-between py-3">
                <div>
                  <p className="font-medium">{t.name}</p>
                  <p className="text-xs text-white/40">{t.myRole === "DIRE" ? "DIRE (administrador)" : "Jogador"}</p>
                </div>
                <span className="text-xs text-white/50">{t.playerCount}/{t.maxPlayers}</span>
              </Card>
            ))}
          </div>
        </section>
      </div>
    </Layout>
  );
}
