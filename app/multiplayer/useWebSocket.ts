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

    const url = (() => {
      if (typeof window === "undefined") return "";
      const { hostname } = window.location;
      const envUrl = process.env.NEXT_PUBLIC_WS_URL ?? "";
      if (hostname === "localhost" || hostname === "127.0.0.1") {
        return "ws://localhost:3005";
      }
      // Dev access from a phone/another device on the LAN: env URL still points at
      // localhost, but localhost on the client device isn't the dev machine. Rewrite
      // to the host that's serving the page.
      if (/^(ws|wss):\/\/(localhost|127\.0\.0\.1)/.test(envUrl)) {
        return `ws://${hostname}:3005`;
      }
      return envUrl;
    })();

    function connect() {
      if (cancelled) return;
      ws = new WebSocket(url);

      ws.onopen = () => {
        if (cancelled) { ws?.close(); return; }
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
        } catch {
          // Malformed payload from server; ignore and keep the socket open.
        }
      };

      ws.onerror = () => {
        // Connection failure is surfaced to the user via wsError on close.
      };

      ws.onclose = () => {
        if (cancelled) return;
        setConnected(false);
        setSocket(null);
        if (retries < MAX_RETRIES) {
          retries++;
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
