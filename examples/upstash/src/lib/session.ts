import {
	upstashSessionStore,
	type upstashRedisSessionOptions
} from '@ethercorps/sveltekit-redis-session';
import { SECRET, REDIS_URL, TOKEN } from '$env/static/private';
import {Redis} from "@upstash/redis"


const redisClient = new Redis({
	url: REDIS_URL,
	token: TOKEN,
});

const sessionOptions: upstashRedisSessionOptions = {
	redisClient: redisClient,
	secret: SECRET,
	sessionPrefix: 'netlify-node-srs-example-session',
	userSessionsPrefix: 'netlify-node-srs-example-user',
	cookieName: 'session',
	cookiesOptions: {
		maxAge: 10 * 60
	}
};
export const sessionManager = new upstashSessionStore(sessionOptions);
