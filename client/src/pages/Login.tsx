import { FormEvent, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Spade } from "lucide-react";
import { useAuth } from "../contexts/AuthContext";
import { getErrorMessage } from "../services/api";
import { SimulationBanner } from "../components/SimulationBanner";
import { Card, Input, Label } from "../components/Card";
import { Button } from "../components/Button";

export default function Login() {
  const { login } = useAuth();
  const navigate = useNavigate();
  const [identifier, setIdentifier] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      await login({ identifier, password });
      navigate("/");
    } catch (err) {
      setError(getErrorMessage(err, "Não foi possível entrar."));
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
            <h1 className="text-xl font-bold">Entrar</h1>
            <p className="text-white/50 text-sm text-center mt-1">Simulador de mesa de poker com fichas virtuais</p>
          </div>

          <form onSubmit={onSubmit} className="space-y-4">
            <div>
              <Label htmlFor="identifier">Email ou nome de usuário</Label>
              <Input
                id="identifier"
                required
                value={identifier}
                onChange={(e) => setIdentifier(e.target.value)}
                autoComplete="username"
              />
            </div>
            <div>
              <Label htmlFor="password">Senha</Label>
              <Input
                id="password"
                type="password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                autoComplete="current-password"
              />
            </div>

            {error && <p className="text-sm text-red-400 bg-red-500/10 border border-red-500/30 rounded-lg px-3 py-2">{error}</p>}

            <Button type="submit" fullWidth disabled={loading}>
              {loading ? "Entrando..." : "Entrar"}
            </Button>
          </form>

          <p className="text-center text-sm text-white/50 mt-6">
            Não tem uma conta?{" "}
            <Link to="/register" className="text-gold hover:underline">
              Cadastre-se
            </Link>
          </p>
        </Card>
      </div>
    </div>
  );
}
