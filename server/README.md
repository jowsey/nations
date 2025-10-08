# Nations server

This is the server package for Nations. It's written in TypeScript with [Bun](https://bun.sh).

---

1. Fill out .env based on [.env.example](./.env.example)
2. Initialize postgres: `docker compose up -d`
3. Push schema: `bun run db:push`
4. Run dev server: `bun run dev`
