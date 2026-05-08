import WebSocket, { WebSocketServer } from "ws";
import http from "http";
import crypto from "crypto";

interface Room {
  host: WebSocket;
  guest: WebSocket | null;
  hostUsername: string;
  guestUsername: string | null;
  hostColor: string;
  guestColor: string;
  word: string;
  finished: { host: boolean; guest: boolean };
  timeout: ReturnType<typeof setTimeout>;
}

interface IncomingMessage {
  type: string;
  payload?: {
    roomId?: string;
    guess?: string;
    length?: number;
    username?: string;
    text?: string;
    color?: string;
    isTyping?: boolean;
  };
}

const DEFAULT_NAME_COLOR = "#4a90e2";

function sanitizeColor(c: unknown): string {
  if (typeof c !== "string") return DEFAULT_NAME_COLOR;
  return /^#[0-9a-fA-F]{6}$/.test(c) ? c : DEFAULT_NAME_COLOR;
}

function sanitizeUsername(name: unknown): string {
  if (typeof name !== "string") return "Player";
  const trimmed = name.trim().slice(0, 24);
  return trimmed || "Player";
}

const MIN_WORD_LENGTH = 3;
const MAX_WORD_LENGTH = 10;
const DEFAULT_WORD_LENGTH = 5;

function clampLength(n: unknown): number {
  const v = typeof n === "number" ? Math.floor(n) : NaN;
  if (!Number.isFinite(v)) return DEFAULT_WORD_LENGTH;
  return Math.min(MAX_WORD_LENGTH, Math.max(MIN_WORD_LENGTH, v));
}

const rooms: Record<string, Room> = {};

const API_ORIGIN =
  process.env.WORDLE_API_URL ||
  (process.env.NODE_ENV === "production" && process.env.VERCEL_URL
    ? `https://${process.env.VERCEL_URL}`
    : "http://localhost:3000");

function generateRoomId(): string {
  return crypto.randomUUID().slice(0, 6).toUpperCase();
}

function normalizeRoomId(id: string | undefined): string | undefined {
  return id?.trim().toUpperCase();
}

function deleteRoom(roomId: string): void {
  const room = rooms[roomId];
  if (!room) return;
  try {
    room.host?.send(JSON.stringify({ type: "room-expired" }));
    room.guest?.send(JSON.stringify({ type: "room-expired" }));
    room.host?.close();
    room.guest?.close();
  } catch { /* ignore */ }
  clearTimeout(room.timeout);
  delete rooms[roomId];
}

async function fetchWordFromAPI(length: number): Promise<string | null> {
  const url = `${API_ORIGIN}/api/word`;
  try {
    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ length }),
    });
    if (!res.ok) throw new Error(`status ${res.status}`);
    const data = await res.json() as { word: string };
    return data.word;
  } catch (err) {
    console.error("Failed to fetch word from API:", (err as Error).message);
    return null;
  }
}

const server = http.createServer();
const wss = new WebSocketServer({ server });

wss.on("connection", (socket: WebSocket) => {
  socket.on("message", async (msg) => {
    let parsed: IncomingMessage;
    try {
      parsed = JSON.parse(msg.toString()) as IncomingMessage;
    } catch {
      return;
    }

    const { type, payload } = parsed;

    if (type === "create-room") {
      const roomId = generateRoomId();
      const length = clampLength(payload?.length);
      const hostUsername = sanitizeUsername(payload?.username);
      const hostColor = sanitizeColor(payload?.color);
      const timeout = setTimeout(() => deleteRoom(roomId), 10 * 60_000);
      const word = await fetchWordFromAPI(length);
      if (!word) {
        socket.send(JSON.stringify({ type: "error", payload: "Could not generate word." }));
        return;
      }
      rooms[roomId] = {
        host: socket,
        guest: null,
        hostUsername,
        guestUsername: null,
        hostColor,
        guestColor: DEFAULT_NAME_COLOR,
        word,
        finished: { host: false, guest: false },
        timeout,
      };
      socket.send(JSON.stringify({ type: "room-created", payload: { roomId, word } }));
    }

    if (type === "join-room" && payload?.roomId) {
      const roomId = normalizeRoomId(payload.roomId)!;
      const room = rooms[roomId];
      if (room && !room.guest) {
        const guestUsername = sanitizeUsername(payload?.username);
        const guestColor = sanitizeColor(payload?.color);
        room.guest = socket;
        room.guestUsername = guestUsername;
        room.guestColor = guestColor;
        socket.send(JSON.stringify({
          type: "room-joined",
          payload: { roomId, word: room.word, opponentUsername: room.hostUsername, opponentColor: room.hostColor },
        }));
        room.host.send(JSON.stringify({
          type: "guest-joined",
          payload: { opponentUsername: guestUsername, opponentColor: guestColor },
        }));
      } else {
        socket.send(JSON.stringify({ type: "room-expired" }));
      }
    }

    if (type === "send-guess" && payload?.roomId) {
      const roomId = normalizeRoomId(payload.roomId)!;
      const room = rooms[roomId];
      if (room) {
        const out = JSON.stringify({ type: "guess", payload: { guess: payload.guess } });
        if (socket === room.host && room.guest) room.guest.send(out);
        if (socket === room.guest) room.host.send(out);
      }
    }

    if (type === "chat" && payload?.roomId) {
      const roomId = normalizeRoomId(payload.roomId)!;
      const room = rooms[roomId];
      const text = typeof payload.text === "string" ? payload.text.trim().slice(0, 280) : "";
      if (!room || !text) return;
      const isHost = socket === room.host;
      const from = isHost ? room.hostUsername : (room.guestUsername || "Player");
      const color = isHost ? room.hostColor : room.guestColor;
      const out = JSON.stringify({ type: "chat", payload: { text, from, color } });
      const peer = isHost ? room.guest : room.host;
      peer?.send(out);
    }

    if (type === "typing" && payload?.roomId) {
      const roomId = normalizeRoomId(payload.roomId)!;
      const room = rooms[roomId];
      if (!room) return;
      const isHost = socket === room.host;
      const from = isHost ? room.hostUsername : (room.guestUsername || "Player");
      const color = isHost ? room.hostColor : room.guestColor;
      const peer = isHost ? room.guest : room.host;
      peer?.send(JSON.stringify({
        type: "typing",
        payload: { from, color, isTyping: !!payload.isTyping },
      }));
    }

    if (type === "player-finished" && payload?.roomId) {
      const roomId = normalizeRoomId(payload.roomId)!;
      const room = rooms[roomId];
      if (room) {
        const who: "host" | "guest" = socket === room.host ? "host" : "guest";
        room.finished[who] = true;
        if (room.finished.host && room.finished.guest) {
          const cd = JSON.stringify({ type: "start-cooldown" });
          room.host?.send(cd);
          room.guest?.send(cd);
          setTimeout(() => deleteRoom(roomId), 30_000);
        }
      }
    }
  });

  socket.on("close", () => {
    for (const id in rooms) {
      const { host, guest } = rooms[id];
      if (host === socket || guest === socket) {
        deleteRoom(id);
        break;
      }
    }
  });
});

const PORT = process.env.PORT ?? 3005;
server.listen(PORT);
