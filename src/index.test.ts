import { describe, it, expect } from 'vitest';
import { RedisSessionStore } from "$lib/sessionManager";
import Redis from "ioredis";
import { dev } from "$app/environment";
import type { Cookies } from '@sveltejs/kit';

const sessionManager = new RedisSessionStore({
	redisClient: new Redis(),
	secret: 'hjghghgh',
	useTTL: true,
	cookiesOptions: {
		path: '/',
		httpOnly: true,
		sameSite: 'strict',
		secure: !dev,
		maxAge: 24 * 60 * 60
	},
	renewSessionBeforeExpire: true
});

let cookie: Cookies;

describe('sum test', () => {
	it('adds 1 + 2 to equal 3', () => {
		expect(1 + 2).toBe(3);
	});
});
