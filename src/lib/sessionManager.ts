import type * as ioRedis from 'ioredis';
import type { Cookies } from '@sveltejs/kit';
import { dev } from '$app/environment';
import crypto from 'crypto';

const defaultExpireSeconds: number = 60 * 60 * 24; // One day in seconds
const defaultRenewBeforeSeconds: number = 30 * 60; // 30 minutes in seconds
const defaultCookiesOption: CookieSerializeOptions = {
	path: '/',
	httpOnly: true,
	sameSite: 'strict',
	secure: !dev,
	maxAge: defaultExpireSeconds
};
export class RedisSessionStore {
	private readonly redisClient: RedisClientTypes;
	private readonly secret: string;
	private readonly cookieName: string;
	private readonly uniqueIdGenerator = crypto.randomUUID;
	private readonly prefix: string;
	private readonly signedCookies: boolean;
	private readonly encryptedCookies: boolean;
	private readonly useTTL: boolean;
	private readonly ttlSeconds: number | undefined;
	private readonly renewSessionBeforeExpire: boolean;
	private readonly renewBeforeSeconds: number;
	private readonly scanCount: number;
	private readonly serializer: Serializer;
	private readonly cookieOptions: CookieSerializeOptions;
	private readonly aesAlgorithm = 'aes-256-cbc';
	private readonly aesKey = Buffer.alloc(32);
	private readonly aesIv = crypto.randomBytes(16);
	constructor(options: redisSessionOptions) {
		if (!options.redisClient) {
			throw new Error('A client must be directly provided to the RedisStore');
		}

		options.redisClient.on('connect', () => {
			console.log('Connected to Redis');
		});

		options.redisClient.on('error', (error) => {
			console.error(`Error connecting to Redis: ${error}`);
			throw new Error('Unable to connect with RedisClient');
		});
		if (
			options.cookiesOptions &&
			options.cookiesOptions.maxAge &&
			options.cookiesOptions.maxAge < 1
		) {
			console.log('Please define a valid time in cookies maxAge parameter');
			throw new Error('Invalid maxAge in cookies options');
		}

		if (
			options.renewSessionBeforeExpire &&
			options.renewBeforeSeconds &&
			options.renewBeforeSeconds < 1
		) {
			console.log('Please define a valid time in renewBeforeSeconds');
			throw new Error('Invalid renewBeforeSeconds in options');
		}
		this.redisClient = options.redisClient;
		this.secret = options.secret;
		this.cookieName = options.cookieName || 'session';
		this.uniqueIdGenerator = crypto.randomUUID;
		this.prefix = options.prefix || 'sk-session:';
		this.signedCookies = options.signed || true;
		this.encryptedCookies = options.encrypted || false;
		this.useTTL = options.useTTL || true;
		this.renewSessionBeforeExpire = options.renewSessionBeforeExpire || false;
		this.renewBeforeSeconds = options.renewBeforeSeconds || defaultRenewBeforeSeconds;
		this.scanCount = Number( options.scanCount ) || 100;
		this.serializer = options.serializer || JSON;
		this.cookieOptions = { ...defaultCookiesOption, ...options.cookiesOptions };
		this.ttlSeconds = this.cookieOptions.maxAge;
		this.aesKey.write( options.secret );
	}

	async getSession(
		cookies: Cookies
	): Promise<{ data: any; error: boolean; message: string }> {
		let { data, error, message } = await this._validateCookie( cookies );
		if (error) return this._returnValid( data, error, message );
		const sessionData = await this.redisClient.get( `${this.prefix}${data}` );
		if (!sessionData) return this._returnValid( null, true, "Invalid session found." );
		let parsedSession;
		try {
			parsedSession = this.serializer.parse( sessionData );
		} catch (err) {
			console.log( err );
			return this._returnValid( null, true, "Unable to parse the session data." );
		}
		// logic for renew cookies and session before expire
		if (this.renewSessionBeforeExpire) {
			const sessionValidity = await this.redisClient.ttl( `${this.prefix}${data}` );
			if (sessionValidity < this.renewBeforeSeconds && this.ttlSeconds) {
				const { error, message } = await this.updateSessionExpiry( cookies, true, data );
				if (error) {
					console.log( message );
				}
			}
		}
		return this._returnValid( parsedSession, false, "Session Data" ); // return session data
	}

	async createNewSession(
		cookies: Cookies,
		sessionData = {},
		key?: string
	): Promise<{ data: any; error: boolean; message: string }> {
		let serializedSessionData;
		try {
			serializedSessionData = this.serializer.stringify( sessionData );
		} catch (er) {
			console.log( "Error in Set Session while serializing", er );
			return this._returnValid( null, true, "Unable to stringify session data." );
		}
		const uniqueKey = key || this.uniqueIdGenerator();
		if (typeof uniqueKey !== "string")
			return this._returnValid(
				null,
				true,
				'Please check your key is a string or uniqueIdGenerator return type'
			);
		const keyWithPrefix = this.prefix + uniqueKey;
		const args = [keyWithPrefix, serializedSessionData];
		if (this.useTTL && this.ttlSeconds) {
			args.push( "EX", this.ttlSeconds );
		}
		// @ts-ignore
		this.redisClient.set( args );
		let finalKey = uniqueKey;
		if (this.signedCookies) finalKey = await this._signKey( finalKey );
		if (this.encryptedCookies) finalKey = await this._encrypt( finalKey );
		cookies.set( this.cookieName, finalKey, this.cookieOptions );
		return this._returnValid( { uniqueKey, finalKey }, false, "Ready get set go" ); // Returns cookie value after setting to cookie
	}

	async updateSessionExpiry(
		cookies: Cookies,
		skipValidation: boolean = false,
		key: string = ""
	): Promise<{ data: any; error: boolean; message: string }> {
		let uniqueKey = key;
		if (!skipValidation) {
			const { data, error, message } = await this._validateCookie( cookies );
			if (error) {
				console.log( "Error in updateSessionExpiry method", message );
				return this._returnValid( data, error, "Unable to validate key while updating session" );
			}
			uniqueKey = data;
		}
		let isExpireTimeUpdated = 1;
		if (this.useTTL && this.ttlSeconds) {
			isExpireTimeUpdated = await this.redisClient.expire(
				`${this.prefix}${uniqueKey}`,
				this.ttlSeconds as number
			);
		}
		if (isExpireTimeUpdated) {
			let finalKey = uniqueKey;
			if (this.signedCookies) finalKey = await this._signKey( finalKey );
			if (this.encryptedCookies) finalKey = await this._encrypt( finalKey );
			cookies.set( this.cookieName, finalKey, this.cookieOptions );
			return this._returnValid(
				{ uniqueKey, finalKey },
				false,
				"Session validity extended successfully"
			); // return cookie value after updating expiry
		}
		return this._returnValid( null, true, "Unable to extended session validity" );
	}

	async delSession(
		cookies: Cookies
	): Promise<{ data: any; error: boolean; message: string }> {
		const { data, error, message } = await this._validateCookie( cookies );
		if (error) {
			console.log( "Error in delSession method", message );
			return this._returnValid( data, error, "Unable to validate key while deleting" );
		}
		const deleteData = await this.redisClient.del( `${this.prefix}${data}` );
		if (!deleteData) return this._returnValid( null, true, `Key not found while deleting` );
		await this.deleteCookie( cookies );
		return this._returnValid( data, false, `Key successfully deleted` ); // Returns unique key without prefix which is deleted from redis
	}

	async deleteCookie(cookies: Cookies) {
		const allCookieOptionsCopy = { ...this.cookieOptions };
		delete allCookieOptionsCopy.maxAge;
		try {
			cookies.delete( this.cookieName, allCookieOptionsCopy );
		} catch (err) {
			console.log( "error while deleting cookies in deleteCookie method", err );
		}
	}

	async _validateCookie(cookies: Cookies) {
		const cookiesSessionKey = cookies.get( this.cookieName );
		if (!cookiesSessionKey) return this._returnValid( null, true, "No session found in cookies." );
		let verifiedSessionKey = cookiesSessionKey;
		if (this.encryptedCookies) {
			const { encrypted, iv } = this.serializer.parse( verifiedSessionKey );
			verifiedSessionKey = (await this._decrypt( { encrypted, iv } )) as string;
		}
		if (this.signedCookies)
			verifiedSessionKey = (await this._verifyKeySignature( verifiedSessionKey )) as string;
		if (!verifiedSessionKey)
			return this._returnValid( null, true, "Cookies session is not verified." );
		return this._returnValid( verifiedSessionKey, false, "Successfully validated cookies" ); // it returns uniques that will make redis key with prefix
	}
	_signKey = async (key: string) => {
		const newDigest = await crypto.createHmac('sha256', this.secret).update(key).digest('hex');
		return `${key}.${newDigest}`;
	};

	_encrypt = async (keyToBeEncrypted: string) => {
		const cipherAES = crypto.createCipheriv( this.aesAlgorithm, this.aesKey, this.aesIv );
		let encrypted;
		try {
			encrypted = cipherAES.update( keyToBeEncrypted, "utf8", "hex" );
			encrypted += cipherAES.final( "hex" );
		} catch (e) {
			console.log( "Error in encrypt method", e );
			throw new Error( "Encryption Error" );
		}
		const encryptedCookiesValue = this.serializer.stringify( {
			encrypted,
			iv: this.aesIv.toString( "hex" )
		} );
		return encryptedCookiesValue;
	};

	_decrypt = async ({ encrypted, iv }: { encrypted: string; iv: string }) => {
		try {
			const decipher = crypto.createDecipheriv(
				this.aesAlgorithm,
				this.aesKey,
				Buffer.from( iv, "hex" )
			);
			let decrypted = decipher.update( encrypted, "hex", "utf8" );
			decrypted += decipher.final( "utf8" );
			return decrypted as string;
		} catch (e) {
			console.log( "decryption error: ", e );
			return null;
		}
	};

	_verifyKeySignature = async (signedCookie: string) => {
		const valueWithSignature = signedCookie.split( "." );
		try {
			const value = valueWithSignature[0];
			const signature = valueWithSignature[1];
			const hmac = crypto.createHmac( "sha256", this.secret );
			hmac.update( value );
			const expectedSignature = hmac.digest( "hex" );
			const isValidSignature = crypto.timingSafeEqual(
				Buffer.from(signature, 'hex'),
				Buffer.from(expectedSignature, 'hex')
			);
			if (!isValidSignature) {
				return null;
			}
			return value;
		} catch (e) {}
	};
	_returnValid(data: any, error: boolean, message: string) {
		return { data, error, message };
	}

	// clear(cb = noop) {
	//   this._getAllKeys((err, keys) => {
	//     if (err) return cb(err)
	//     this.client.del(keys, cb)
	//   })
	// }
	//
	// length(cb = noop) {
	//   this._getAllKeys((err, keys) => {
	//     if (err) return cb(err)
	//     return cb(null, keys.length)
	//   })
	// }
	//
	// ids(cb = noop) {
	//   let prefixLen = this.prefix.length;
	//
	//   this._getAllKeys((err, keys) => {
	//     if (err) return cb(err)
	//     keys = keys.map((key) => key.substr(prefixLen))
	//     return cb(null, keys)
	//   })
	// }
	//
	// all(cb = noop) {
	//   let prefixLen = this.prefix.length
	//
	//   this._getAllKeys((err, keys) => {
	//     if (err) return cb(err)
	//     if (keys.length === 0) return cb(null, [])
	//
	//     this.client.mget(keys, (err, sessions) => {
	//       if (err) return cb(err)
	//
	//       let result
	//       try {
	//         result = sessions.reduce((accum, data, index) => {
	//           if (!data) return accum
	//           data = this.serializer.parse(data)
	//           data.id = keys[index].substr(prefixLen)
	//           accum.push(data)
	//           return accum
	//         }, [])
	//       } catch (e) {
	//         err = e
	//       }
	//       return cb(err, result)
	//     })
	//   })
	// }
	//
	//
	// _getAllKeys(cb = noop) {
	//   let pattern = this.prefix + "*"
	//   this._scanKeys({}, 0, pattern, this.scanCount, cb)
	// }
	//
	// _scanKeys(keys = {}, cursor, pattern, count, cb = noop) {
	//   let args = [cursor, "match", pattern, "count", count]
	//   this.client.scan(args, (err, data) => {
	//     if (err) return cb(err)
	//
	//     let [nextCursorId, scanKeys] = data
	//     for (let key of scanKeys) {
	//       keys[key] = true
	//     }
	//
	//     // This can be a string or a number. We check both.
	//     if (Number(nextCursorId) !== 0) {
	//       return this._scanKeys(keys, nextCursorId, pattern, count, cb)
	//     }
	//
	//     cb(null, Object.keys(keys))
	//   })
	// }
}

export type RedisClientTypes = ioRedis.Redis | ioRedis.Cluster;
export interface redisSessionOptions {
	redisClient: RedisClientTypes;
	secret: string;
	cookieName?: string;
	prefix?: string;
	signed?: boolean;
	encrypted?: boolean;
	useTTL?: boolean;
	renewSessionBeforeExpire?: boolean;
	renewBeforeSeconds?: number;
	scanCount?: number; // currently not using, future plans to add some functionality
	serializer?: Serializer | JSON;
	cookiesOptions?: CookieSerializeOptions;
}

export type Serializer = {
	stringify: Function;
	parse: Function;
};

export interface CookieSerializeOptions {
	/**
	 * Specifies the value for the {@link https://tools.ietf.org/html/rfc6265#section-5.2.3|Domain Set-Cookie attribute}. By default, no
	 * domain is set, and most clients will consider the cookie to apply to only
	 * the current domain.
	 */
	domain?: string | undefined;

	/**
	 * Specifies a function that will be used to encode a cookie's value. Since
	 * value of a cookie has a limited character set (and must be a simple
	 * string), this function can be used to encode a value into a string suited
	 * for a cookie's value.
	 *
	 * The default function is the global `encodeURIComponent`, which will
	 * encode a JavaScript string into UTF-8 byte sequences and then URL-encode
	 * any that fall outside the cookie range.
	 */
	encode?(value: string): string;

	/**
	 * Specifies the `Date` object to be the value for the {@link https://tools.ietf.org/html/rfc6265#section-5.2.1|`Expires` `Set-Cookie` attribute}. By default,
	 * no expiration is set, and most clients will consider this a "non-persistent cookie" and will delete
	 * it on a condition like exiting a web browser application.
	 *
	 * *Note* the {@link https://tools.ietf.org/html/rfc6265#section-5.3|cookie storage model specification}
	 * states that if both `expires` and `maxAge` are set, then `maxAge` takes precedence, but it is
	 * possible not all clients by obey this, so if both are set, they should
	 * point to the same date and time.
	 */
	expires?: Date | undefined;
	/**
	 * Specifies the boolean value for the {@link https://tools.ietf.org/html/rfc6265#section-5.2.6|`HttpOnly` `Set-Cookie` attribute}.
	 * When truthy, the `HttpOnly` attribute is set, otherwise it is not. By
	 * default, the `HttpOnly` attribute is not set.
	 *
	 * *Note* be careful when setting this to true, as compliant clients will
	 * not allow client-side JavaScript to see the cookie in `document.cookie`.
	 */
	httpOnly?: boolean | undefined;
	/**
	 * Specifies the number (in seconds) to be the value for the `Max-Age`
	 * `Set-Cookie` attribute. The given number will be converted to an integer
	 * by rounding down. By default, no maximum age is set.
	 *
	 * *Note* the {@link https://tools.ietf.org/html/rfc6265#section-5.3|cookie storage model specification}
	 * states that if both `expires` and `maxAge` are set, then `maxAge` takes precedence, but it is
	 * possible not all clients by obey this, so if both are set, they should
	 * point to the same date and time.
	 */
	maxAge?: number | undefined;
	/**
	 * Specifies the value for the {@link https://tools.ietf.org/html/rfc6265#section-5.2.4|`Path` `Set-Cookie` attribute}.
	 * By default, the path is considered the "default path".
	 */
	path?: string | undefined;
	/**
	 * Specifies the `string` to be the value for the [`Priority` `Set-Cookie` attribute][rfc-west-cookie-priority-00-4.1].
	 *
	 * - `'low'` will set the `Priority` attribute to `Low`.
	 * - `'medium'` will set the `Priority` attribute to `Medium`, the default priority when not set.
	 * - `'high'` will set the `Priority` attribute to `High`.
	 *
	 * More information about the different priority levels can be found in
	 * [the specification][rfc-west-cookie-priority-00-4.1].
	 *
	 * **note** This is an attribute that has not yet been fully standardized, and may change in the future.
	 * This also means many clients may ignore this attribute until they understand it.
	 */
	priority?: 'low' | 'medium' | 'high' | undefined;
	/**
	 * Specifies the boolean or string to be the value for the {@link https://tools.ietf.org/html/draft-ietf-httpbis-rfc6265bis-03#section-4.1.2.7|`SameSite` `Set-Cookie` attribute}.
	 *
	 * - `true` will set the `SameSite` attribute to `Strict` for strict same
	 * site enforcement.
	 * - `false` will not set the `SameSite` attribute.
	 * - `'lax'` will set the `SameSite` attribute to Lax for lax same site
	 * enforcement.
	 * - `'strict'` will set the `SameSite` attribute to Strict for strict same
	 * site enforcement.
	 *  - `'none'` will set the SameSite attribute to None for an explicit
	 *  cross-site cookie.
	 *
	 * More information about the different enforcement levels can be found in {@link https://tools.ietf.org/html/draft-ietf-httpbis-rfc6265bis-03#section-4.1.2.7|the specification}.
	 *
	 * *note* This is an attribute that has not yet been fully standardized, and may change in the future. This also means many clients may ignore this attribute until they understand it.
	 */
	sameSite?: true | false | 'lax' | 'strict' | 'none' | undefined;
	/**
	 * Specifies the boolean value for the {@link https://tools.ietf.org/html/rfc6265#section-5.2.5|`Secure` `Set-Cookie` attribute}. When truthy, the
	 * `Secure` attribute is set, otherwise it is not. By default, the `Secure` attribute is not set.
	 *
	 * *Note* be careful when setting this to `true`, as compliant clients will
	 * not send the cookie back to the server in the future if the browser does
	 * not have an HTTPS connection.
	 */
	secure?: boolean | undefined;
}
