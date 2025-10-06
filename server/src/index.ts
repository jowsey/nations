import Elysia from "elysia";
import { auth } from "./lib/auth";

const betterAuth = new Elysia({ name: "better-auth" }).mount(auth.handler).macro({
  auth: {
    resolve: async ({ status, request }) => {
      console.log("Headers: ", request.headers);

      const session = await auth.api.getSession({
        headers: request.headers,
      });

      console.log("Session: ", session);

      if (!session) return status(401);

      return {
        auth: {
          user: session.user,
          session: session.session,
        },
      };
    },
  },
});

const app = new Elysia()
  .use(betterAuth)
  .get("/api/auth/sign-in/discord", async (req) => {
    const signInRes = await auth.api.signInSocial({
      body: { provider: "discord" },
    });
    console.log(signInRes);
    return req.redirect(signInRes.url!);
  })
  .listen(3000);
console.log(`Server running on http://${app.server?.hostname}:${app.server?.port}`);
