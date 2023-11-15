import type { RequestHandler } from '@sveltejs/kit';
import { fail, json, redirect } from '@sveltejs/kit';
import { sessionManager } from '$lib/session';

export const POST = (async ({ request, locals, cookies }) => {
	if (locals && locals.isUserLoggedIn) {
		const additionalData = await request.json();
		const newSessionData = { ...locals.user, ...additionalData };
		const { data, error, message } = await sessionManager.updateSession(cookies, newSessionData);
		if (!error) {
			locals.user = newSessionData;
		}
		return json({
			success: !error,
			message,
			sessionData: await sessionManager.getSession(cookies)
		});
	}
	throw redirect(302, '/');
}) satisfies RequestHandler;
