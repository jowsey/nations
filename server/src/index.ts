import { eq } from "drizzle-orm";
import { db } from "./db";
import { mapCells, tokens, users } from "./db/schema";
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

  const foundToken = await db
    .select()
    .from(tokens)
    .where(eq(tokens.identifier, identifier))
    .limit(1);
  if (!foundToken[0]) return ""; // token identifier doesn't exist in db

  if (!(await Bun.password.verify(verifier, foundToken[0].hash))) {
    return ""; // tokens don't match
  }

  const user = await db
    .select({ id: users.id })
    .from(users)
    .where(eq(users.id, foundToken[0].userId))
    .limit(1);
  if (!user[0]) return ""; // user doesn't exist (should be impossible from cascade)

  return user[0].id; // all good!
};

if (!process.env.PORT) {
  throw new Error("PORT not set in environment!");
}

const map = new WorldMap();

const forceRegenerate = false;
if (forceRegenerate || (await db.select().from(mapCells).limit(1)).length === 0) {
  map.regenerate({ x: 4, y: 3 }, "gaming4");
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

        const stride = 1; // uint8 height
        const buffer = new ArrayBuffer(2 + 2 + cells.length * stride);
        const view = new DataView(buffer);

        view.setUint16(0, dimensions.x, true);
        view.setUint16(2, dimensions.y, true);

        let offset = 4;
        cells.forEach((cell) => {
          view.setUint8(offset, cell.height);
          offset += 1;
        });

        return new Response(buffer, {
          status: 200,
          headers: { "Content-Type": "application/octet-stream" },
        });
      }
      case "/api/new-user": {
        const user = await db.insert(users).values({}).returning({ id: users.id });
        if (!user[0]) return new Response("Error creating user", { status: 500 }); // god knows how

        const identifier = nanoid(16);
        const verifier = nanoid(32);
        const token = `${identifier}.${verifier}`;

        await db
          .insert(tokens)
          .values({ identifier, hash: await Bun.password.hash(verifier), userId: user[0].id });

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
