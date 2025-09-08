import { getRequestEvent } from '$app/server';
import { createAuthClient } from 'better-auth/svelte';
import { sveltekitCookies } from 'better-auth/svelte-kit';

export const authClient = createAuthClient({
	plugins: [sveltekitCookies(getRequestEvent)]
});
