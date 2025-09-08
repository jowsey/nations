import { betterAuth } from 'better-auth';
import { db } from './db';
import { drizzleAdapter } from 'better-auth/adapters/drizzle';

if (!process.env.DISCORD_CLIENT_ID || !process.env.DISCORD_CLIENT_SECRET) {
	throw new Error('Missing DISCORD_CLIENT_ environment variables!');
}

export const auth = betterAuth({
	database: drizzleAdapter(db, {
		provider: 'pg'
	}),
	socialProviders: {
		discord: {
			clientId: process.env.DISCORD_CLIENT_ID,
			clientSecret: process.env.DISCORD_CLIENT_SECRET
		}
	}
});
