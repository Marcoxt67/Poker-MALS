import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Plus, LogIn, Users } from "lucide-react";
import { Layout } from "../components/Layout";
import { Card, Input, Label } from "../components/Card";
import { Button } from "../components/Button";
import { Modal } from "../components/Modal";
import { StatusBadge } from "../components/StatusBadge";
import { useAuth } from "../contexts/AuthContext";
import { tableApi } from "../services/tableApi";
import { getErrorMessage } from "../services/api";
import { TableView } from "../types";

const emptyCreateForm = {
  name: "",
  code: "",
  maxPlayers: 8,
  minBuyIn: 20,
  startingChips: 100,
};

export default function Dashboard() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [tables, setTables] = useState<TableView[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);
  const [showJoin, setShowJoin] = useState(false);
  const [createForm, setCreateForm] = useState(emptyCreateForm);
  const [joinCode, setJoinCode] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const loadTables = async () => {
    setLoading(true);
    try {
      const data = await tableApi.list(false);
      setTables(data);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadTables();
  }, []);

  const myTables = tables.filter((t) => t.myRole !== null || t.isMember);

  const onCreate = async () => {
    setError(null);
    setSubmitting(true);
    try {
      const table = await tableApi.create({
        name: createForm.name,
        code: createForm.code || undefined,
        maxPlayers: Number(createForm.maxPlayers),
        minBuyIn: Number(createForm.minBuyIn),
        startingChips: Number(createForm.startingChips),
      });
      setShowCreate(false);
      setCreateForm(emptyCreateForm);
      navigate(`/tables/${table.id}`);
    } catch (err) {
      setError(getErrorMessage(err, "Não foi possível criar a mesa."));
    } finally {
      setSubmitting(false);
    }
  };

  const onJoin = async () => {
    setError(null);
    setSubmitting(true);
    try {
      const table = await tableApi.join(joinCode);
      setShowJoin(false);
      setJoinCode("");
      navigate(`/tables/${table.id}`);
    } catch (err) {
      setError(getErrorMessage(err, "Não foi possível entrar na mesa."));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Layout>
      <div className="max-w-5xl mx-auto px-4 py-6 space-y-6">
        <div>
          <h1 className="text-2xl font-bold">Olá, {user?.displayName} 👋</h1>
          <p className="text-white/50 text-sm mt-1">Bem-vindo ao simulador de fichas virtuais.</p>
        </div>

        <Card className="bg-gradient-to-br from-felt to-felt-dark border-gold/20">
          <p className="text-sm text-white/70 uppercase tracking-wide">Suas fichas virtuais</p>
          <p className="text-4xl font-bold text-gold mt-1">{user?.chips}</p>
          <div className="flex flex-col sm:flex-row gap-3 mt-5">
            <Button variant="gold" onClick={() => setShowCreate(true)} className="flex-1">
              <Plus size={18} /> Criar mesa
            </Button>
            <Button variant="ghost" onClick={() => setShowJoin(true)} className="flex-1">
              <LogIn size={18} /> Entrar em mesa
            </Button>
          </div>
        </Card>

        {myTables.length > 0 && (
          <section>
            <h2 className="text-sm font-semibold text-white/60 uppercase tracking-wide mb-3">Minhas mesas</h2>
            <div className="grid sm:grid-cols-2 gap-3">
              {myTables.map((table) => (
                <TableCard key={table.id} table={table} onClick={() => navigate(`/tables/${table.id}`)} />
              ))}
            </div>
          </section>
        )}

        <section>
          <h2 className="text-sm font-semibold text-white/60 uppercase tracking-wide mb-3">Mesas públicas</h2>
          {loading ? (
            <p className="text-white/40 text-sm">Carregando mesas...</p>
          ) : tables.length === 0 ? (
            <Card className="text-center text-white/50 text-sm py-8">Nenhuma mesa criada ainda. Crie a primeira!</Card>
          ) : (
            <div className="grid sm:grid-cols-2 gap-3">
              {tables.map((table) => (
                <TableCard key={table.id} table={table} onClick={() => navigate(`/tables/${table.id}`)} />
              ))}
            </div>
          )}
        </section>
      </div>

      {showCreate && (
        <Modal title="Criar mesa" onClose={() => setShowCreate(false)}>
          <div className="space-y-4">
            <div>
              <Label>Nome da mesa</Label>
              <Input value={createForm.name} onChange={(e) => setCreateForm({ ...createForm, name: e.target.value })} placeholder="Mesa Principal" />
            </div>
            <div>
              <Label>Código da mesa (opcional)</Label>
              <Input
                value={createForm.code}
                onChange={(e) => setCreateForm({ ...createForm, code: e.target.value.toUpperCase() })}
                placeholder="POKER123"
                maxLength={12}
              />
            </div>
            <div className="grid grid-cols-3 gap-3">
              <div>
                <Label>Máx. jogadores</Label>
                <Input
                  type="number"
                  min={2}
                  max={10}
                  value={createForm.maxPlayers}
                  onChange={(e) => setCreateForm({ ...createForm, maxPlayers: Number(e.target.value) })}
                />
              </div>
              <div>
                <Label>Entrada mín.</Label>
                <Input
                  type="number"
                  min={1}
                  value={createForm.minBuyIn}
                  onChange={(e) => setCreateForm({ ...createForm, minBuyIn: Number(e.target.value) })}
                />
              </div>
              <div>
                <Label>Fichas iniciais</Label>
                <Input
                  type="number"
                  min={1}
                  value={createForm.startingChips}
                  onChange={(e) => setCreateForm({ ...createForm, startingChips: Number(e.target.value) })}
                />
              </div>
            </div>
            {error && <p className="text-sm text-red-400 bg-red-500/10 border border-red-500/30 rounded-lg px-3 py-2">{error}</p>}
            <Button variant="gold" fullWidth disabled={submitting || !createForm.name} onClick={onCreate}>
              {submitting ? "Criando..." : "CRIAR MESA"}
            </Button>
          </div>
        </Modal>
      )}

      {showJoin && (
        <Modal title="Entrar em mesa" onClose={() => setShowJoin(false)}>
          <div className="space-y-4">
            <div>
              <Label>Código da mesa</Label>
              <Input value={joinCode} onChange={(e) => setJoinCode(e.target.value.toUpperCase())} placeholder="POKER123" />
            </div>
            {error && <p className="text-sm text-red-400 bg-red-500/10 border border-red-500/30 rounded-lg px-3 py-2">{error}</p>}
            <Button fullWidth disabled={submitting || !joinCode} onClick={onJoin}>
              {submitting ? "Entrando..." : "ENTRAR"}
            </Button>
          </div>
        </Modal>
      )}
    </Layout>
  );
}

const TableCard = ({ table, onClick }: { table: TableView; onClick: () => void }) => (
  <Card className="cursor-pointer hover:border-gold/40 transition-colors" onClick={onClick}>
    <div className="flex items-start justify-between gap-2">
      <div>
        <p className="font-semibold">{table.name}</p>
        <p className="text-xs text-white/40 mt-0.5">Código: {table.code}</p>
      </div>
      <StatusBadge status={table.status} />
    </div>
    <div className="flex items-center gap-4 mt-4 text-xs text-white/60">
      <span className="flex items-center gap-1">
        <Users size={14} />
        {table.playerCount}/{table.maxPlayers} jogadores
      </span>
      <span>Mín. {table.minBuyIn} fichas</span>
    </div>
  </Card>
);
