import { ReactNode } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { History, LayoutDashboard, LogOut, Spade, User as UserIcon } from "lucide-react";
import { SimulationBanner } from "./SimulationBanner";
import { useAuth } from "../contexts/AuthContext";

const navItems = [
  { to: "/", label: "Início", icon: LayoutDashboard },
  { to: "/history", label: "Histórico", icon: History },
  { to: "/profile", label: "Perfil", icon: UserIcon },
];

export const Layout = ({ children }: { children: ReactNode }) => {
  const location = useLocation();
  const navigate = useNavigate();
  const { user, logout } = useAuth();

  return (
    <div className="min-h-screen flex flex-col bg-felt-darker">
      <SimulationBanner compact />

      <header className="hidden md:flex items-center justify-between px-6 py-4 border-b border-white/10 bg-panel/60 backdrop-blur">
        <Link to="/" className="flex items-center gap-2 font-bold text-lg text-gold">
          <Spade size={22} />
          Poker MALS
        </Link>
        <nav className="flex items-center gap-1">
          {navItems.map((item) => {
            const active = location.pathname === item.to;
            return (
              <Link
                key={item.to}
                to={item.to}
                className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                  active ? "bg-white/10 text-white" : "text-white/60 hover:text-white hover:bg-white/5"
                }`}
              >
                <item.icon size={16} />
                {item.label}
              </Link>
            );
          })}
        </nav>
        <div className="flex items-center gap-3">
          <div className="text-right leading-tight">
            <div className="text-sm font-semibold">{user?.displayName}</div>
            <div className="text-xs text-gold">{user?.chips} fichas</div>
          </div>
          <button
            onClick={() => {
              logout();
              navigate("/login");
            }}
            className="p-2 rounded-lg text-white/60 hover:text-white hover:bg-white/10"
            aria-label="Sair"
          >
            <LogOut size={18} />
          </button>
        </div>
      </header>

      <header className="flex md:hidden items-center justify-between px-4 py-3 border-b border-white/10 bg-panel/60">
        <Link to="/" className="flex items-center gap-2 font-bold text-gold">
          <Spade size={20} />
          Poker MALS
        </Link>
        <div className="text-xs font-semibold text-gold">{user?.chips} fichas</div>
      </header>

      <main className="flex-1 overflow-y-auto pb-20 md:pb-0">{children}</main>

      <nav className="md:hidden fixed bottom-0 inset-x-0 bg-panel border-t border-white/10 flex items-stretch safe-bottom z-20">
        {navItems.map((item) => {
          const active = location.pathname === item.to;
          return (
            <Link
              key={item.to}
              to={item.to}
              className={`flex-1 flex flex-col items-center justify-center gap-0.5 py-2.5 touch-target ${
                active ? "text-gold" : "text-white/50"
              }`}
            >
              <item.icon size={20} />
              <span className="text-[10px] font-medium">{item.label}</span>
            </Link>
          );
        })}
        <button
          onClick={() => {
            logout();
            navigate("/login");
          }}
          className="flex-1 flex flex-col items-center justify-center gap-0.5 py-2.5 text-white/50 touch-target"
        >
          <LogOut size={20} />
          <span className="text-[10px] font-medium">Sair</span>
        </button>
      </nav>
    </div>
  );
};
