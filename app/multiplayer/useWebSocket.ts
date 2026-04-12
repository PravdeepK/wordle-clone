import { useEffect, useRef, useState } from "react";

interface WebSocketOptions {
  onRoomJoined?: (roomId: string, word: string) => void;
  onGuestJoined?: () => void;
  onOpponentGuess?: (guess: string) => void;
  onPlayerFinished?: () => void;
}

const MAX_RETRIES = 5;
const RETRY_DELAY_MS = 2000;

export default function useWebSocket(options: WebSocketOptions = {}) {
  const [socket, setSocket] = useState<WebSocket | null>(null);
  const [connected, setConnected] = useState(false);
  const [wsError, setWsError] = useState<string | null>(null);
  const retriesRef = useRef(0);
  const unmountedRef = useRef(false);

  useEffect(() => {
    unmountedRef.current = false;

    const url =
      typeof window !== "undefined" && window.location.hostname === "localhost"
        ? "ws://localhost:3005"
        : process.env.NEXT_PUBLIC_WS_URL ?? "";

    let ws: WebSocket;

    function connect() {
      if (unmountedRef.current) return;
      ws = new WebSocket(url);

      ws.onopen = () => {
        if (unmountedRef.current) { ws.close(); return; }
        console.log("[WebSocket] Connected");
        retriesRef.current = 0;
        setSocket(ws);
        setConnected(true);
        setWsError(null);
      };

      ws.onmessage = (event: MessageEvent) => {
        try {
          const { type, payload } = JSON.parse(event.data as string);
          if (type === "room-created")    options.onRoomJoined?.(payload.roomId, payload.word);
          if (type === "room-joined")     options.onRoomJoined?.(payload.roomId, payload.word);
          if (type === "guest-joined")    options.onGuestJoined?.();
          if (type === "guess")           options.onOpponentGuess?.(payload.guess);
          if (type === "player-finished") options.onPlayerFinished?.();
          if (type === "room-expired")    setWsError("Room has expired. Please refresh and try again.");
        } catch (err) {
          console.warn("[WebSocket] Invalid message:", err);
        }
      };

      ws.onerror = () => {
        console.warn("[WebSocket] Connection failed, will retry…");
      };

      ws.onclose = () => {
        if (unmountedRef.current) return;
        setConnected(false);
        setSocket(null);
        if (retriesRef.current < MAX_RETRIES) {
          retriesRef.current++;
          console.log(`[WebSocket] Reconnecting (attempt ${retriesRef.current}/${MAX_RETRIES})`);
          setWsError(`Connecting to server… (attempt ${retriesRef.current}/${MAX_RETRIES})`);
          setTimeout(connect, RETRY_DELAY_MS);
        } else {
          setWsError("Could not connect to the multiplayer server. Make sure it is running and refresh.");
        }
      };
    }

    connect();

    return () => {
      unmountedRef.current = true;
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
