import { RedisSessionStore } from "@ethercorps/sveltekit-redis-session";
import Redis from "ioredis";
import { SECRET, REDIS_URL } from '$env/static/private';
export const sessionManger = new RedisSessionStore({
	redisClient: new Redis(REDIS_URL),
	secret: SECRET,
	prefix: 'redisk-example:',
	cookieName: 'session',
	cookiesOptions: {
		maxAge: 10 * 60
	}
});
