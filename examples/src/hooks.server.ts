import type { Handle } from '@sveltejs/kit';
import { sessionManger } from './routes/session';
import { redirect } from '@sveltejs/kit';

export const handle: Handle = async ({ event, resolve }) => {
	const userSession = await sessionManger.getSession(await event.cookies);
	event.locals = {
		isUserLoggedIn: false,
		user: null
	};
	if (userSession.error) {
		console.log(userSession);
		await sessionManger.deleteCookie(await event.cookies);
		return resolve(event);
	}
	event.locals = {
		isUserLoggedIn: true,
		user: { email: userSession.data.email as string }
	};
	return resolve(event);
};
