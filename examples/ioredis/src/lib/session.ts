import {
	IoRedisSessionStore,
	type ioRedisSessionOptions
} from '@ethercorps/sveltekit-redis-session';
import { SECRET, REDIS_URL } from '$env/static/private';
import Redis from 'ioredis';

const sessionOptions: ioRedisSessionOptions = {
	redisClient: new Redis(REDIS_URL),
	secret: SECRET,
	sessionPrefix: 'vercel-ioredis-srs-example-session',
	userSessionsPrefix: 'vercel-ioredis-srs-example-user',
	cookieName: 'session',
	cookiesOptions: {
		maxAge: 10 * 60
	}
};
export const sessionManager = new IoRedisSessionStore(sessionOptions);
