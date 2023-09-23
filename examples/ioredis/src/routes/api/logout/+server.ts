import { json, redirect } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { sessionManager } from '$lib/session';

export const POST = (async ({ request, locals, cookies }) => {
	if (locals && locals.isUserLoggedIn) {
		const { email } = await request.json();
		const deleteData = await sessionManager.delSession(cookies);
		if (deleteData.error) await sessionManager.deleteCookie(cookies);
		return json({ loggedIn: false, message: 'Successfully logged out' });
	}
	throw redirect(302, '/');
}) satisfies RequestHandler;
