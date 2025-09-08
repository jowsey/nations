import type { LayoutServerLoad } from './$types';

export const load: LayoutServerLoad = async ({ locals, depends }) => {
	depends('app:authed'); // invalidated when user signs out

	return {
		session: locals.session,
		user: locals.user
	};
};
