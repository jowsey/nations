import { eq } from "drizzle-orm";
import { db } from "./db";
import { mapCells, users } from "./db/schema";
import { nanoid } from "nanoid";
import { WorldMap } from "./map";

interface WebsocketData {
  userId: string;
}

// Returns a user's id from their token or empty if invalid
const auth = async (token: string): Promise<string> => {
  if (!token) return ""; // no token provided

  const identifier = token.split(".")[0];
  const verifier = token.split(".")[1];

  if (!identifier || !verifier) return ""; // malformed token

  const foundUser = await db
    .select({ id: users.id, tokenIdentifier: users.tokenIdentifier, tokenHash: users.tokenHash })
    .from(users)
    .where(eq(users.tokenIdentifier, identifier))
    .limit(1);
  if (!foundUser[0]) return ""; // token identifier doesn't exist in db

  if (!(await Bun.password.verify(verifier, foundUser[0].tokenHash))) {
    return ""; // tokens don't match
  }

  return foundUser[0].id; // all good!
};

if (!process.env.PORT) {
  throw new Error("PORT not set in environment!");
}

const map = new WorldMap();

const forceRegenerate = false;
if (forceRegenerate || (await db.select().from(mapCells).limit(1)).length === 0) {
  await map.regenerate({ x: 512, y: 384 }, "gaming4");
  await map.pushToDb();
} else {
  await map.pullFromDb();
}

const server = Bun.serve<WebsocketData, object>({
  port: parseInt(process.env.PORT),
  async fetch(req, server) {
    const url = new URL(req.url);
    switch (url.pathname) {
      case "/api/map": {
        const id = await auth(req.headers.get("token") || "");
        if (!id) return new Response("Unauthorized", { status: 401 });

        // todo check if map is dirty before building a new buffer
        const [cells, dimensions] = map.getCells();

        const stride = 2; // uint16 details
        const buffer = new ArrayBuffer(2 + 2 + cells.length * stride);
        const view = new DataView(buffer);

        view.setUint16(0, dimensions.x, true);
        view.setUint16(2, dimensions.y, true);

        let offset = 4;
        cells.forEach((cell) => {
          view.setUint16(offset, cell.details, true);
          offset += 2;
        });

        console.log(buffer.byteLength, "bytes sent");

        return new Response(buffer, {
          status: 200,
          headers: { "Content-Type": "application/octet-stream" },
        });
      }
      case "/api/new-user": {
        const identifier = nanoid(16);
        const verifier = nanoid(32);
        const token = `${identifier}.${verifier}`;

        await db
          .insert(users)
          .values({ tokenIdentifier: identifier, tokenHash: await Bun.password.hash(verifier) });

        console.log(`New token generated: ${token}`);
        return new Response(token);
      }
      case "/ws": {
        const id = await auth(req.headers.get("token") || "");
        if (!id) return new Response("Unauthorized", { status: 401 });

        return server.upgrade(req, { data: { userId: id } })
          ? new Response("Upgrade successful", { status: 101 })
          : new Response("Upgrade failed", { status: 400 });
      }
      default: {
        // 🤷
      }
    }
  },
  websocket: {
    async open(ws) {
      console.log(`New websocket client (${ws.remoteAddress})`);
      console.log(ws.data);
    },
    async message(ws, message) {
      console.log(`ws message: ${message}`);
    },
    async close(ws, code, reason) {
      console.log(`ws closed: code ${code} ("${reason}")`);
    },
  },
});

console.log(`Server started on http://localhost:${server.port}`);
