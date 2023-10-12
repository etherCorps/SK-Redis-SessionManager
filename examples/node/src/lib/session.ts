import {
	RedisSessionStore,
	type nodeRedisSessionOptions
} from '@ethercorps/sveltekit-redis-session';
import { SECRET, REDIS_URL } from '$env/static/private';
import { createClient } from 'redis';

const redisClient = createClient({ url: REDIS_URL });
await redisClient.connect();

const sessionOptions: nodeRedisSessionOptions = {
	redisClient: redisClient,
	secret: SECRET,
	sessionPrefix: 'netlify-node-srs-example-session',
	userSessionsPrefix: 'netlify-node-srs-example-user',
	cookieName: 'session',
	cookiesOptions: {
		maxAge: 10 * 60
	}
};
export const sessionManager = new RedisSessionStore(sessionOptions);
