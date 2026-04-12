import WebSocket, { WebSocketServer } from "ws";
import http from "http";
import crypto from "crypto";

interface Room {
  host: WebSocket;
  guest: WebSocket | null;
  word: string;
  finished: { host: boolean; guest: boolean };
  timeout: ReturnType<typeof setTimeout>;
}

interface IncomingMessage {
  type: string;
  payload?: {
    roomId?: string;
    guess?: string;
  };
}

const rooms: Record<string, Room> = {};

const API_ORIGIN =
  process.env.WORDLE_API_URL ||
  (process.env.NODE_ENV === "production" && process.env.VERCEL_URL
    ? `https://${process.env.VERCEL_URL}`
    : "http://localhost:3000");

console.log("🔗 Wordle API origin is:", API_ORIGIN);

function generateRoomId(): string {
  return crypto.randomUUID().slice(0, 6);
}

function deleteRoom(roomId: string, reason = "expired"): void {
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
  console.log(`🧹 Room ${roomId} deleted (${reason})`);
}

async function fetchWordFromAPI(): Promise<string | null> {
  const url = `${API_ORIGIN}/api/word`;
  console.log(`🎲 Fetching new word from ${url}…`);
  try {
    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ length: 5 }),
    });
    if (!res.ok) throw new Error(`status ${res.status}`);
    const data = await res.json() as { word: string };
    console.log("✅ Got word:", data.word);
    return data.word;
  } catch (err) {
    console.error("❌ Failed to fetch word from API:", (err as Error).message);
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
      console.warn("⚠️  Invalid JSON from client:", msg);
      return;
    }

    const { type, payload } = parsed;

    if (type === "create-room") {
      const roomId = generateRoomId();
      const timeout = setTimeout(() => deleteRoom(roomId), 10 * 60_000);
      const word = await fetchWordFromAPI();
      if (!word) {
        socket.send(JSON.stringify({ type: "error", payload: "Could not generate word." }));
        return;
      }
      rooms[roomId] = { host: socket, guest: null, word, finished: { host: false, guest: false }, timeout };
      socket.send(JSON.stringify({ type: "room-created", payload: { roomId, word } }));
      console.log(`🎲 Room ${roomId} created (word=${word})`);
    }

    if (type === "join-room" && payload?.roomId) {
      const room = rooms[payload.roomId];
      if (room && !room.guest) {
        room.guest = socket;
        socket.send(JSON.stringify({ type: "room-joined", payload: { roomId: payload.roomId, word: room.word } }));
        room.host.send(JSON.stringify({ type: "guest-joined" }));
        console.log(`👤 Guest joined room ${payload.roomId}`);
      } else {
        socket.send(JSON.stringify({ type: "room-expired" }));
      }
    }

    if (type === "send-guess" && payload?.roomId) {
      const room = rooms[payload.roomId];
      if (room) {
        const out = JSON.stringify({ type: "guess", payload: { guess: payload.guess } });
        if (socket === room.host && room.guest) room.guest.send(out);
        if (socket === room.guest) room.host.send(out);
      }
    }

    if (type === "player-finished" && payload?.roomId) {
      const room = rooms[payload.roomId];
      if (room) {
        const who: "host" | "guest" = socket === room.host ? "host" : "guest";
        room.finished[who] = true;
        console.log(`🏁 ${who} finished in room ${payload.roomId}`);
        if (room.finished.host && room.finished.guest) {
          const cd = JSON.stringify({ type: "start-cooldown" });
          room.host?.send(cd);
          room.guest?.send(cd);
          setTimeout(() => deleteRoom(payload.roomId!, "both finished"), 30_000);
        }
      }
    }
  });

  socket.on("close", () => {
    for (const id in rooms) {
      const { host, guest } = rooms[id];
      if (host === socket || guest === socket) {
        deleteRoom(id, "disconnect");
        break;
      }
    }
  });
});

const PORT = process.env.PORT ?? 3005;
server.listen(PORT, () => {
  console.log(`🟢 WebSocket server up on ws://localhost:${PORT}`);
});
