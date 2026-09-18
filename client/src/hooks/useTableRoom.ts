import { useCallback, useEffect, useRef, useState } from "react";
import { useSocket } from "../contexts/SocketContext";
import { tableApi } from "../services/tableApi";
import { TableView } from "../types";

export interface FeedItem {
  id: string;
  text: string;
  at: number;
}

const REALTIME_EVENTS = [
  "player_joined",
  "player_left",
  "round_started",
  "player_bet",
  "player_folded",
  "turn_changed",
  "pot_updated",
  "round_finished",
  "round_finalizing",
  "chips_updated",
  "table_paused",
  "table_resumed",
  "table_settings_updated",
] as const;

export const useTableRoom = (tableId: string | undefined) => {
  const socket = useSocket();
  const [table, setTable] = useState<TableView | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [feed, setFeed] = useState<FeedItem[]>([]);
  const feedCounter = useRef(0);
  const tableRef = useRef<TableView | null>(null);
  tableRef.current = table;

  const pushFeed = useCallback((text: string) => {
    feedCounter.current += 1;
    setFeed((prev) => [{ id: `${Date.now()}-${feedCounter.current}`, text, at: Date.now() }, ...prev].slice(0, 40));
  }, []);

  const refresh = useCallback(async () => {
    if (!tableId) return;
    try {
      const data = await tableApi.get(tableId);
      setTable(data);
      setError(null);
    } catch {
      setError("Não foi possível carregar a mesa.");
    } finally {
      setLoading(false);
    }
  }, [tableId]);

  useEffect(() => {
    setLoading(true);
    refresh();
  }, [refresh]);

  useEffect(() => {
    if (!socket || !tableId) return;

    socket.emit("join_table", tableId);

    const handler = () => refresh();
    REALTIME_EVENTS.forEach((event) => socket.on(event, handler));

    socket.on("player_bet", (payload: { type: string; amount: number; userId: string }) => {
      const player = tableRef.current?.players.find((p) => p.userId === payload.userId);
      const label = player?.displayName ?? "Jogador";
      const verb = payload.type === "BET" ? "apostou" : payload.type === "CALL" ? "pagou" : "aumentou para";
      pushFeed(`${label} ${verb} ${payload.amount} fichas`);
    });
    socket.on("player_folded", (payload: { userId: string }) => {
      const player = tableRef.current?.players.find((p) => p.userId === payload.userId);
      pushFeed(`${player?.displayName ?? "Jogador"} saiu da rodada`);
    });
    socket.on("round_finished", (round: { winnerId?: string | null; potTotal: number }) => {
      const winner = tableRef.current?.players.find((p) => p.userId === round.winnerId);
      if (winner) pushFeed(`${winner.displayName} venceu o pote de ${round.potTotal} fichas`);
    });
    socket.on("player_joined", (payload: { userId: string }) => {
      pushFeed(`Um jogador entrou na mesa`);
      void payload;
    });
    socket.on("player_left", (payload: { userId: string }) => {
      pushFeed(`Um jogador saiu da mesa`);
      void payload;
    });

    return () => {
      REALTIME_EVENTS.forEach((event) => socket.off(event, handler));
      socket.off("player_bet");
      socket.off("player_folded");
      socket.off("round_finished");
      socket.off("player_joined");
      socket.off("player_left");
      socket.emit("leave_table_room", tableId);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [socket, tableId, refresh]);

  return { table, loading, error, feed, refresh };
};
