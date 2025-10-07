import { eq } from "drizzle-orm";
import { db } from "./db";
import { users } from "./db/schema";
import { nanoid } from "nanoid";

interface WebsocketData {
  userId: string;
}

interface NewUserMessage {
  type: "newUser";
  data: {
    id: string;
    token: string;
  };
}

type OutboundMessage = NewUserMessage;

type AuthResult = "success" | "fail" | "create";

const auth = async (id: string, token: string): Promise<AuthResult> => {
  if (!id) return "create"; // no id
  if (!token) return "fail"; // id but no token

  const user = await db.select().from(users).where(eq(users.id, id));
  if (!user[0]) return "fail"; // no user in db
  if (!user[0].token) return "fail"; // user has no token in db

  if (!(await Bun.password.verify(token, user[0].token))) {
    return "fail"; // tokens don't match
  }

  return "success"; // all good!
};

const server = Bun.serve<WebsocketData, {}>({
  port: 3000,
  async fetch(req, server) {
    const url = new URL(req.url);
    if (url.pathname === "/ws") {
      const id = req.headers.get("id") || "";
      const token = req.headers.get("token") || "";

      const authResult = await auth(id, token);

      if (authResult === "fail") {
        return new Response("Unauthorized", { status: 401 });
      }

      return server.upgrade(req, { data: { userId: id } })
        ? new Response("Upgrade successful", { status: 101 })
        : new Response("Upgrade failed", { status: 400 });
    }

    return new Response("OK", { status: 200 });
  },
  websocket: {
    async open(ws) {
      console.log(`New websocket client @ ${ws.remoteAddress}`);
      console.log(ws.data);

      // create new user
      if (!ws.data.userId) {
        const token = nanoid(24);
        const user = await db
          .insert(users)
          .values({ token: await Bun.password.hash(token) })
          .returning();

        ws.send(
          JSON.stringify({ type: "newUser", data: { id: user[0]!.id, token } } as OutboundMessage),
        );
      }
    },
    async message(ws, message) {},
    async close(ws, code, reason) {},
  },
});

console.log(`Server started on http://localhost:${server.port}`);
