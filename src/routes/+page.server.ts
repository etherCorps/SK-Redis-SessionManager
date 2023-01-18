import { RedisSessionStore } from '$lib/sessionManager';
import type { PageServerLoad } from './$types';
import Redis from 'ioredis';
import { dev } from '$app/environment';
import { SECRET } from "$env/static/private";

const sessionManager = new RedisSessionStore({
	redisClient: new Redis(),
	secret: SECRET,
	useTTL: true,
	cookiesOptions: {
		path: '/',
		httpOnly: true,
		sameSite: 'strict',
		secure: !dev,
		maxAge: 24 * 60 * 60
	},
	renewSessionBeforeExpire: true
	// renewBeforeSeconds: 1
});

export const load: PageServerLoad = async ({ locals, cookies }) => {
	// const data = await sessionManager.setNewSession(cookies, { hii: 'Haiiiiya' });
	// const data = await sessionManager.getSession(cookies);
	// const data = await sessionManager.updateSessionExpiry(cookies);
	// const data  = await sessionManager.delSession(cookies)
	// console.log(data);
};


