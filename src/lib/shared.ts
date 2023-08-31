import type { Redis } from 'ioredis';
import type { RedisClientType } from 'redis';
import type { Redis as upstashRedisClient } from '@upstash/redis';
import { dev } from '$app/environment';
import type { Cookies } from '@sveltejs/kit';

// code copied from Nanoid:
// https://github.com/ai/nanoid/blob/9b748729f8ad5409503b508b65958636e55bd87a/index.browser.js
// nanoid uses Node dependencies on default bundler settings

const getRandomValues = (bytes: number) => crypto.getRandomValues(new Uint8Array(bytes));

const DEFAULT_ALPHABET = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ1234567890';

export const generateRandomString = (size = 36, alphabet = DEFAULT_ALPHABET) => {
	const mask = (2 << (Math.log(alphabet.length - 1) / Math.LN2)) - 1;
	const step = -~((1.6 * mask * size) / alphabet.length);

	let bytes = getRandomValues(step);
	let id = '';
	let index = 0;

	while (id.length !== size) {
		id += alphabet[bytes[index] & mask] ?? '';
		index += 1;
		if (index > bytes.length) {
			bytes = getRandomValues(step);
			index = 0;
		}
	}
	return id;
};

export const getSessionKey = (sessionPrefix: string, sessionId: string): string => {
	return [sessionPrefix, sessionId].join(':');
};

export const getUserSessionKey = (userSessionsPrefix: string, userId: string): string => {
	return [userSessionsPrefix, userId].join(':');
};

export const formattedReturn = (data: any, error: boolean, message: string) => {
	return { data, error, message };
};

const importKey = async (secret: string) => {
	return crypto.subtle.importKey(
		'raw',
		new TextEncoder().encode(secret),
		{ name: 'HMAC', hash: 'SHA-256' },
		false,
		['sign', 'verify']
	);
};

export const signSessionKey = async (key: string, secret: string) => {
	const secretKeyEncoded = await importKey(secret);

	const signature = await crypto.subtle.sign(
		'HMAC',
		secretKeyEncoded,
		new TextEncoder().encode(key)
	);

	const newDigest = btoa(String.fromCharCode(...new Uint8Array(signature)));
	return `${key}.${newDigest}`;
};

export const verifySignature = async (signedCookie: string, secret: string) => {
	const valueWithSignature = signedCookie.split('.');
	try {
		const value = valueWithSignature[0];
		const signature = valueWithSignature[1];
		const key = await importKey(secret);
		const sigBuf = Uint8Array.from(atob(signature), (c) => c.charCodeAt(0));

		const isValidSignature = await crypto.subtle.verify(
			'HMAC',
			key,
			sigBuf,
			new TextEncoder().encode(value)
		);
		if (!isValidSignature) {
			return null;
		}
		return value;
	} catch (e) {
		console.log('decryption error: ', e);
		return null;
	}
};

export const validateCookie = async (
	cookies: Cookies,
	cookieName: string,
	secret: string,
	signedCookies: boolean
) => {
	const cookiesSessionKey = cookies.get(cookieName);
	if (!cookiesSessionKey) return formattedReturn(null, true, 'No session found in cookies.');
	let verifiedSessionKey = cookiesSessionKey;
	if (signedCookies)
		verifiedSessionKey = (await verifySignature(verifiedSessionKey, secret)) as string;
	if (!verifiedSessionKey) return formattedReturn(null, true, 'Cookies session is not verified.');
	return formattedReturn(verifiedSessionKey, false, 'Successfully validated cookies');
};

export interface CookieSerializeOptions {
	domain?: string | undefined;
	encode?(value: string): string;
	expires?: Date | undefined;
	httpOnly?: boolean | undefined;
	maxAge?: number | undefined;
	path?: string | undefined;
	priority?: 'low' | 'medium' | 'high' | undefined;
	sameSite?: true | false | 'lax' | 'strict' | 'none' | undefined;
	secure?: boolean | undefined;
}

export interface ioRedisSessionOptions extends redisSessionOptions {
	redisClient: Redis;
}

export interface nodeRedisSessionOptions extends redisSessionOptions {
	redisClient: RedisClientType;
}

export interface upstashRedisSessionOptions extends redisSessionOptions {
	redisClient: upstashRedisClient;
}

interface redisSessionOptions {
	secret: string;
	cookieName?: string;
	userSessionsPrefix?: string;
	sessionPrefix?: string;
	signed?: boolean;
	useTTL?: boolean;
	renewSessionBeforeExpire?: boolean;
	renewBeforeSeconds?: number;
	serializer?: Serializer | JSON;
	cookiesOptions?: CookieSerializeOptions;
}

export const defaultExpireSeconds: number = 60 * 60 * 24; // One day in seconds
export const defaultRenewBeforeSeconds: number = 30 * 60; // 30 minutes in seconds
export const defaultCookiesOption: CookieSerializeOptions = {
	path: '/',
	httpOnly: true,
	sameSite: 'strict',
	secure: !dev,
	maxAge: defaultExpireSeconds
};

export type Serializer = {
	// eslint-disable-next-line @typescript-eslint/ban-types
	stringify: Function;
	// eslint-disable-next-line @typescript-eslint/ban-types
	parse: Function;
};
