import { FormEvent, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Spade } from "lucide-react";
import { useAuth } from "../contexts/AuthContext";
import { getErrorMessage } from "../services/api";
import { SimulationBanner } from "../components/SimulationBanner";
import { Card, Input, Label } from "../components/Card";
import { Button } from "../components/Button";

export default function Register() {
  const { register } = useAuth();
  const navigate = useNavigate();
  const [form, setForm] = useState({ username: "", displayName: "", email: "", password: "", confirmPassword: "" });
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      await register(form);
      navigate("/");
    } catch (err) {
      setError(getErrorMessage(err, "Não foi possível criar sua conta."));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex flex-col bg-felt-darker">
      <SimulationBanner />
      <div className="flex-1 flex items-center justify-center px-4 py-8">
        <Card className="w-full max-w-md">
          <div className="flex flex-col items-center mb-6">
            <Spade className="text-gold mb-2" size={32} />
            <h1 className="text-xl font-bold">Criar conta</h1>
            <p className="text-white/50 text-sm text-center mt-1">Simulador de mesa de poker com fichas virtuais</p>
          </div>

          <form onSubmit={onSubmit} className="space-y-4">
            <div>
              <Label htmlFor="username">Nome de usuário</Label>
              <Input
                id="username"
                required
                value={form.username}
                onChange={(e) => setForm({ ...form, username: e.target.value })}
                placeholder="marcos123"
                autoComplete="username"
              />
            </div>
            <div>
              <Label htmlFor="displayName">Nome de exibição</Label>
              <Input
                id="displayName"
                required
                value={form.displayName}
                onChange={(e) => setForm({ ...form, displayName: e.target.value })}
                placeholder="Marcos"
              />
            </div>
            <div>
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                type="email"
                required
                value={form.email}
                onChange={(e) => setForm({ ...form, email: e.target.value })}
                placeholder="voce@email.com"
                autoComplete="email"
              />
            </div>
            <div>
              <Label htmlFor="password">Senha</Label>
              <Input
                id="password"
                type="password"
                required
                minLength={6}
                value={form.password}
                onChange={(e) => setForm({ ...form, password: e.target.value })}
                autoComplete="new-password"
              />
            </div>
            <div>
              <Label htmlFor="confirmPassword">Confirmar senha</Label>
              <Input
                id="confirmPassword"
                type="password"
                required
                minLength={6}
                value={form.confirmPassword}
                onChange={(e) => setForm({ ...form, confirmPassword: e.target.value })}
                autoComplete="new-password"
              />
            </div>

            {error && <p className="text-sm text-red-400 bg-red-500/10 border border-red-500/30 rounded-lg px-3 py-2">{error}</p>}

            <Button type="submit" fullWidth disabled={loading}>
              {loading ? "Criando conta..." : "Criar conta"}
            </Button>
          </form>

          <p className="text-center text-sm text-white/50 mt-6">
            Já tem uma conta?{" "}
            <Link to="/login" className="text-gold hover:underline">
              Entrar
            </Link>
          </p>
        </Card>
      </div>
    </div>
  );
}
