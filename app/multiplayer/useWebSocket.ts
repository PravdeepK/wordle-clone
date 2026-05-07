import { useEffect, useRef, useState } from "react";

interface WebSocketOptions {
  onRoomJoined?: (roomId: string, word: string, opponentUsername?: string) => void;
  onGuestJoined?: (opponentUsername?: string) => void;
  onOpponentGuess?: (guess: string) => void;
  onPlayerFinished?: () => void;
  onChat?: (text: string, from: string) => void;
}

const MAX_RETRIES = 5;
const RETRY_DELAY_MS = 2000;

export default function useWebSocket(options: WebSocketOptions = {}) {
  const [socket, setSocket] = useState<WebSocket | null>(null);
  const [connected, setConnected] = useState(false);
  const [wsError, setWsError] = useState<string | null>(null);
  const optionsRef = useRef(options);
  optionsRef.current = options;

  useEffect(() => {
    let cancelled = false;
    let retries = 0;
    let ws: WebSocket | null = null;
    let reconnectTimer: ReturnType<typeof setTimeout> | null = null;

    const url =
      typeof window !== "undefined" && window.location.hostname === "localhost"
        ? "ws://localhost:3005"
        : process.env.NEXT_PUBLIC_WS_URL ?? "";

    function connect() {
      if (cancelled) return;
      ws = new WebSocket(url);

      ws.onopen = () => {
        if (cancelled) { ws?.close(); return; }
        console.log("[WebSocket] Connected");
        retries = 0;
        setSocket(ws);
        setConnected(true);
        setWsError(null);
      };

      ws.onmessage = (event: MessageEvent) => {
        if (cancelled) return;
        try {
          const { type, payload } = JSON.parse(event.data as string);
          const opts = optionsRef.current;
          if (type === "room-created")    opts.onRoomJoined?.(payload.roomId, payload.word, payload.opponentUsername);
          if (type === "room-joined")     opts.onRoomJoined?.(payload.roomId, payload.word, payload.opponentUsername);
          if (type === "guest-joined")    opts.onGuestJoined?.(payload?.opponentUsername);
          if (type === "guess")           opts.onOpponentGuess?.(payload.guess);
          if (type === "player-finished") opts.onPlayerFinished?.();
          if (type === "chat")            opts.onChat?.(payload?.text ?? "", payload?.from ?? "Opponent");
          if (type === "room-expired")    setWsError("Room has expired. Please refresh and try again.");
        } catch (err) {
          console.warn("[WebSocket] Invalid message:", err);
        }
      };

      ws.onerror = () => {
        console.warn("[WebSocket] Connection failed, will retry…");
      };

      ws.onclose = () => {
        if (cancelled) return;
        setConnected(false);
        setSocket(null);
        if (retries < MAX_RETRIES) {
          retries++;
          console.log(`[WebSocket] Reconnecting (attempt ${retries}/${MAX_RETRIES})`);
          setWsError(`Connecting to server… (attempt ${retries}/${MAX_RETRIES})`);
          reconnectTimer = setTimeout(connect, RETRY_DELAY_MS);
        } else {
          setWsError("Could not connect to the multiplayer server. Make sure it is running and refresh.");
        }
      };
    }

    connect();

    return () => {
      cancelled = true;
      if (reconnectTimer) clearTimeout(reconnectTimer);
      ws?.close();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const sendJsonMessage = (type: string, payload?: unknown) => {
    if (socket?.readyState === WebSocket.OPEN) {
      socket.send(JSON.stringify({ type, payload }));
    }
  };

  return { socket, sendJsonMessage, connected, wsError };
}
