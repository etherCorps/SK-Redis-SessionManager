import type { Redis } from 'ioredis';
import type { CookieSerializeOptions, ioRedisSessionOptions, Serializer } from '$lib/shared.js';
import {
	defaultCookiesOption,
	defaultRenewBeforeSeconds,
	formattedReturn,
	generateRandomString,
	getSessionKey,
	getUserSessionKey,
	signSessionKey,
	validateCookie
} from '$lib/shared.js';
import type { Cookies } from '@sveltejs/kit';

export class IoRedisSessionStore {
	private readonly redisClient: Redis;
	private readonly secret: string;
	private readonly cookieName: string;
	private readonly uniqueIdGenerator = generateRandomString;
	private readonly sessionPrefix: string;
	private readonly userSessionsPrefix: string;
	private readonly signedCookies: boolean;
	private readonly useTTL: boolean;
	private readonly ttlSeconds: number | undefined;
	private readonly renewSessionBeforeExpire: boolean;
	private readonly renewBeforeSeconds: number;
	private readonly serializer: Serializer;
	private readonly cookieOptions: CookieSerializeOptions;

	constructor({
		redisClient,
		secret,
		cookieName = 'session',
		sessionPrefix = 'sk_ioredis_session',
		userSessionsPrefix = 'sk_ioredis_user_sessions',
		signed = true,
		useTTL = true,
		renewSessionBeforeExpire = false,
		renewBeforeSeconds = defaultRenewBeforeSeconds,
		serializer = JSON,
		cookiesOptions = {}
	}: ioRedisSessionOptions) {
		if (!redisClient) {
			throw new Error('A pre-initiated redis client must be provided to the RedisStore');
		}

		redisClient.on('connect', () => {
			console.log('Connected to Redis');
		});

		redisClient.on('error', (error: any) => {
			console.error(`Error connecting to Redis: ${error}`);
			throw new Error('Unable to connect with RedisClient');
		});
		if (cookiesOptions && cookiesOptions.maxAge && cookiesOptions.maxAge < 1) {
			console.log('Please define a valid time in cookies maxAge parameter');
			throw new Error('Invalid maxAge in cookies options');
		}

		if (renewSessionBeforeExpire && renewBeforeSeconds && renewBeforeSeconds < 1) {
			console.log('Please define a valid time in renewBeforeSeconds');
			throw new Error('Invalid renewBeforeSeconds in options');
		}
		this.redisClient = redisClient;
		this.secret = secret;
		this.cookieName = cookieName;
		this.uniqueIdGenerator = generateRandomString;
		this.sessionPrefix = sessionPrefix;
		this.userSessionsPrefix = userSessionsPrefix;
		this.signedCookies = signed;
		this.useTTL = useTTL;
		this.renewSessionBeforeExpire = renewSessionBeforeExpire || false;
		this.renewBeforeSeconds = renewBeforeSeconds || defaultRenewBeforeSeconds;
		this.serializer = serializer || JSON;
		this.cookieOptions = { ...defaultCookiesOption, ...cookiesOptions };
		this.ttlSeconds = this.cookieOptions.maxAge;
	}
	createSession = async (
		cookies: Cookies,
		sessionData: any,
		userId: string
	): Promise<{ data: any; error: boolean; message: string }> => {
		let sessionKey = this.uniqueIdGenerator();

		let serializedSessionData;
		try {
			serializedSessionData = this.serializer.stringify(sessionData);
		} catch (er) {
			console.log('Error in Set Session while serializing', er);
			return formattedReturn(null, true, 'Unable to stringify session data.');
		}

		const prefixedSessionKey = getSessionKey(this.sessionPrefix, sessionKey);
		const redisPipeline = this.redisClient.pipeline();
		redisPipeline.set(prefixedSessionKey, serializedSessionData);
		redisPipeline.sadd(getUserSessionKey(this.userSessionsPrefix, userId), sessionKey);
		if (this.useTTL && this.ttlSeconds) {
			redisPipeline.expire(prefixedSessionKey, this.ttlSeconds);
		}
		await redisPipeline.exec();
		if (this.signedCookies) {
			sessionKey = await signSessionKey(sessionKey, this.secret);
		}
		cookies.set(this.cookieName, sessionKey, this.cookieOptions);
		return formattedReturn(sessionKey, false, 'Successfully created new session.');
	};

	getSession = async (cookies: Cookies) => {
		const {
			data: sessionId,
			error,
			message
		} = await validateCookie(cookies, this.cookieName, this.secret, this.signedCookies);
		if (error) return formattedReturn(sessionId, error, message);
		const sessionData = await this.redisClient.get(getSessionKey(this.sessionPrefix, sessionId));

		if (!sessionData)
			return formattedReturn(null, true, `Unable to find data for the provided key - ${sessionId}`);

		let parsedSession;
		try {
			parsedSession = this.serializer.parse(sessionData);
		} catch (err) {
			console.log(err);
			return formattedReturn(null, true, 'Unable to parse the session data.');
		}

		if (this.renewSessionBeforeExpire) {
			const sessionValidity = await this.redisClient.ttl(
				getSessionKey(this.sessionPrefix, sessionId)
			);
			if (sessionValidity < this.renewBeforeSeconds && this.ttlSeconds) {
				const { error, message } = await this.updateSessionExpiry(cookies, true, sessionId);
				if (error) {
					console.log(message);
				}
			}
		}
		return formattedReturn(parsedSession, false, 'Session Data'); // return session data
	};

	// From lucia auth & made my own changes
	getSessionsByUserId = async (userId: string) => {
		const sessionIds = await this.redisClient.smembers(
			getUserSessionKey(this.userSessionsPrefix, userId)
		);
		if (!sessionIds)
			return formattedReturn(null, true, `Unable to find session for user: ${userId}.`);
		const sessionData = await Promise.all(
			sessionIds.map((sessionId) =>
				this.redisClient.get(getSessionKey(this.sessionPrefix, sessionId))
			)
		);
		const sessions = sessionData
			.filter((val): val is string => val !== null)
			.map((val) => this.serializer.parse(val) as any);
		return formattedReturn(
			sessions,
			false,
			`We found ${sessionData.length} active session for user: ${userId}`
		);
	};
	// till here

	deleteSession = async (cookies: Cookies, userId = null) => {
		const {
			data: sessionId,
			error,
			message
		} = await validateCookie(cookies, this.cookieName, this.secret, this.signedCookies);
		if (error) {
			console.log('Error in delSession method', message);
			return formattedReturn(sessionId, error, 'Unable to validate key while deleting');
		}
		const prefixedSessionKey = getSessionKey(this.sessionPrefix, sessionId);
		const sessionData = await this.redisClient.get(prefixedSessionKey);
		if (!sessionData) return formattedReturn(sessionId, true, `Not a valid session key`);

		if (userId) {
			const redisPipeline = this.redisClient.pipeline();
			redisPipeline.del(prefixedSessionKey);
			redisPipeline.srem(getUserSessionKey(this.userSessionsPrefix, userId), sessionId);
			await redisPipeline.exec();
		} else {
			await this.redisClient.del(prefixedSessionKey);
		}

		await this.deleteCookie(cookies);
		return formattedReturn(sessionId, false, `Key successfully deleted`); // Returns unique key without prefix which is deleted from redis
	};

	deleteSessionsByUserId = async (userId: string) => {
		const sessionIds = await this.redisClient.smembers(
			getUserSessionKey(this.userSessionsPrefix, userId)
		);
		if (!sessionIds)
			return formattedReturn(null, true, `Unable to find session for user: ${userId}.`);
		await Promise.all([
			...sessionIds.map((sessionId) =>
				this.redisClient.del(getSessionKey(this.sessionPrefix, sessionId))
			),
			this.redisClient.del(getUserSessionKey(this.userSessionsPrefix, userId))
		]);
		return formattedReturn(userId, false, `Successfully deleted`); // Returns userId without prefix which is deleted from redis
	};

	deleteCookie = async (cookies: Cookies) => {
		const allCookieOptionsCopy = { ...this.cookieOptions };
		delete allCookieOptionsCopy.maxAge;
		try {
			cookies.delete(this.cookieName, allCookieOptionsCopy);
		} catch (err) {
			console.log('error while deleting cookies in deleteCookie method', err);
		}
	};

	async updateSession(
		cookies: Cookies,
		sessionData = {}
	): Promise<{ data: any; error: boolean; message: string }> {
		const {
			data: sessionId,
			error,
			message
		} = await validateCookie(cookies, this.cookieName, this.secret, this.signedCookies);
		if (error) {
			console.log('Error in updateSessionExpiry method', message);
			return formattedReturn(sessionId, error, 'Unable to validate key while updating session');
		}
		const keyWithPrefix = getSessionKey(this.sessionPrefix, sessionId);
		let serializedSessionData;
		try {
			serializedSessionData = this.serializer.stringify(sessionData);
		} catch (er) {
			console.log('Error in Set Session while serializing', er);
			return formattedReturn(null, true, 'Unable to stringify session data.');
		}
		const redisPipe = this.redisClient.pipeline();
		redisPipe.set(keyWithPrefix, serializedSessionData);
		if (this.useTTL && this.ttlSeconds) {
			redisPipe.expire(keyWithPrefix, this.ttlSeconds);
		}
		await redisPipe.exec();
		return formattedReturn(sessionId, false, 'Cookie data has been updated');
	}

	updateSessionExpiry = async (
		cookies: Cookies,
		skipValidation = false,
		key = ''
	): Promise<{ data: any; error: boolean; message: string }> => {
		let uniqueKey = key;
		if (!skipValidation) {
			const {
				data: sessionKey,
				error,
				message
			} = await validateCookie(cookies, this.cookieName, this.secret, this.signedCookies);
			if (error) {
				console.log('Error in updateSessionExpiry method', message);
				return formattedReturn(sessionKey, error, 'Unable to validate key while updating session');
			}
			uniqueKey = sessionKey;
		}
		let isExpireTimeUpdated = 1;
		if (this.useTTL && this.ttlSeconds) {
			isExpireTimeUpdated = await this.redisClient.expire(
				getSessionKey(this.sessionPrefix, uniqueKey),
				this.ttlSeconds as number
			);
		}
		if (isExpireTimeUpdated) {
			if (this.signedCookies) uniqueKey = await signSessionKey(uniqueKey, this.secret);
			cookies.set(this.cookieName, uniqueKey, this.cookieOptions);
			return formattedReturn(uniqueKey, false, 'Session validity extended successfully');
		}
		return formattedReturn(null, true, 'Unable to extended session validity');
	};
}
