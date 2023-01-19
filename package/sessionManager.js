import { dev } from '$app/environment';
import crypto from 'crypto';
const defaultExpireSeconds = 60 * 60 * 24; // One day in seconds
const defaultRenewBeforeSeconds = 30 * 60; // 30 minutes in seconds
const defaultCookiesOption = {
    path: '/',
    httpOnly: true,
    sameSite: 'strict',
    secure: !dev,
    maxAge: defaultExpireSeconds
};
export class RedisSessionStore {
    redisClient;
    secret;
    cookieName;
    uniqueIdGenerator = crypto.randomUUID;
    prefix;
    signedCookies;
    encryptedCookies;
    useTTL;
    ttlSeconds;
    renewSessionBeforeExpire;
    renewBeforeSeconds;
    scanCount;
    serializer;
    cookieOptions;
    aesAlgorithm = 'aes-256-cbc';
    aesKey = Buffer.alloc(32);
    aesIv = crypto.randomBytes(16);
    constructor(options) {
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
        if (options.cookiesOptions &&
            options.cookiesOptions.maxAge &&
            options.cookiesOptions.maxAge < 1) {
            console.log('Please define a valid time in cookies maxAge parameter');
            throw new Error('Invalid maxAge in cookies options');
        }
        if (options.renewSessionBeforeExpire &&
            options.renewBeforeSeconds &&
            options.renewBeforeSeconds < 1) {
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
        this.scanCount = Number(options.scanCount) || 100;
        this.serializer = options.serializer || JSON;
        this.cookieOptions = { ...defaultCookiesOption, ...options.cookiesOptions };
        this.ttlSeconds = this.cookieOptions.maxAge;
        this.aesKey.write(options.secret);
    }
    async getSession(cookies) {
        let { data, error, message } = await this._validateCookie(cookies);
        if (error)
            return this._returnValid(data, error, message);
        const sessionData = await this.redisClient.get(`${this.prefix}${data}`);
        if (!sessionData)
            return this._returnValid(null, true, "Invalid session found.");
        let parsedSession;
        try {
            parsedSession = this.serializer.parse(sessionData);
        } catch (err) {
            console.log(err);
            return this._returnValid(null, true, "Unable to parse the session data.");
        }
        // logic for renew cookies and session before expire
        if (this.renewSessionBeforeExpire) {
            const sessionValidity = await this.redisClient.ttl(`${this.prefix}${data}`);
            if (sessionValidity < this.renewBeforeSeconds && this.ttlSeconds) {
                const { error, message } = await this.updateSessionExpiry(cookies, true, data);
                if (error) {
                    console.log(message);
                }
            }
        }
        return this._returnValid(parsedSession, false, "Session Data"); // return session data
    }

    async createNewSession(cookies, sessionData = {}, key) {
        let serializedSessionData;
        try {
            serializedSessionData = this.serializer.stringify(sessionData);
        } catch (er) {
            console.log("Error in Set Session while serializing", er);
            return this._returnValid(null, true, "Unable to stringify session data.");
        }
        const uniqueKey = key || this.uniqueIdGenerator();
        if (typeof uniqueKey !== "string")
            return this._returnValid(null, true, "Please check your key is a string or uniqueIdGenerator return type");
        const keyWithPrefix = this.prefix + uniqueKey;
        const args = [keyWithPrefix, serializedSessionData];
        if (this.useTTL && this.ttlSeconds) {
            args.push("EX", this.ttlSeconds);
        }
        // @ts-ignore
        this.redisClient.set(args);
        let finalKey = uniqueKey;
        if (this.signedCookies)
            finalKey = await this._signKey(finalKey);
        if (this.encryptedCookies)
            finalKey = await this._encrypt(finalKey);
        cookies.set(this.cookieName, finalKey, this.cookieOptions);
        return this._returnValid({ uniqueKey, finalKey }, false, "Ready get set go"); // Returns cookie value after setting to cookie
    }

    async updateSessionExpiry(cookies, skipValidation = false, key = "") {
        let uniqueKey = key;
        if (!skipValidation) {
            const { data, error, message } = await this._validateCookie(cookies);
            if (error) {
                console.log("Error in updateSessionExpiry method", message);
                return this._returnValid(data, error, "Unable to validate key while updating session");
            }
            uniqueKey = data;
        }
        let isExpireTimeUpdated = 1;
        if (this.useTTL && this.ttlSeconds) {
            isExpireTimeUpdated = await this.redisClient.expire(`${this.prefix}${uniqueKey}`, this.ttlSeconds);
        }
        if (isExpireTimeUpdated) {
            let finalKey = uniqueKey;
            if (this.signedCookies)
                finalKey = await this._signKey(finalKey);
            if (this.encryptedCookies)
                finalKey = await this._encrypt(finalKey);
            cookies.set(this.cookieName, finalKey, this.cookieOptions);
            return this._returnValid({ uniqueKey, finalKey }, false, "Session validity extended successfully"); // return cookie value after updating expiry
        }
        return this._returnValid(null, true, "Unable to extended session validity");
    }

    async delSession(cookies) {
        const { data, error, message } = await this._validateCookie(cookies);
        if (error) {
            console.log("Error in delSession method", message);
            return this._returnValid(data, error, "Unable to validate key while deleting");
        }
        const deleteData = await this.redisClient.del(`${this.prefix}${data}`);
        if (!deleteData)
            return this._returnValid(null, true, `Key not found while deleting`);
        await this.deleteCookie(cookies);
        return this._returnValid(data, false, `Key successfully deleted`); // Returns unique key without prefix which is deleted from redis
    }
    async deleteCookie(cookies) {
        const allCookieOptionsCopy = { ...this.cookieOptions };
        delete allCookieOptionsCopy.maxAge;
        try {
            cookies.delete(this.cookieName, allCookieOptionsCopy);
        } catch (err) {
            console.log("error while deleting cookies in deleteCookie method", err);
        }
    }
    async _validateCookie(cookies) {
        const cookiesSessionKey = cookies.get(this.cookieName);
        if (!cookiesSessionKey)
            return this._returnValid(null, true, "No session found in cookies.");
        let verifiedSessionKey = cookiesSessionKey;
        if (this.encryptedCookies) {
            const { encrypted, iv } = this.serializer.parse(verifiedSessionKey);
            verifiedSessionKey = (await this._decrypt({ encrypted, iv }));
        }
        if (this.signedCookies)
            verifiedSessionKey = (await this._verifyKeySignature(verifiedSessionKey));
        if (!verifiedSessionKey)
            return this._returnValid(null, true, "Cookies session is not verified.");
        return this._returnValid(verifiedSessionKey, false, "Successfully validated cookies"); // it returns uniques that will make redis key with prefix
    }

    _signKey = async (key) => {
        const newDigest = await crypto.createHmac("sha256", this.secret).update(key).digest("hex");
        return `${key}.${newDigest}`;
    };
    _encrypt = async (keyToBeEncrypted) => {
        const cipherAES = crypto.createCipheriv(this.aesAlgorithm, this.aesKey, this.aesIv);
        let encrypted;
        try {
            encrypted = cipherAES.update(keyToBeEncrypted, "utf8", "hex");
            encrypted += cipherAES.final("hex");
        } catch (e) {
            console.log("Error in encrypt method", e);
            throw new Error("Encryption Error");
        }
        const encryptedCookiesValue = this.serializer.stringify({
            encrypted,
            iv: this.aesIv.toString("hex")
        });
        return encryptedCookiesValue;
    };
    _decrypt = async ({ encrypted, iv }) => {
        try {
            const decipher = crypto.createDecipheriv(this.aesAlgorithm, this.aesKey, Buffer.from(iv, "hex"));
            let decrypted = decipher.update(encrypted, "hex", "utf8");
            decrypted += decipher.final("utf8");
            return decrypted;
        } catch (e) {
            console.log("decryption error: ", e);
            return null;
        }
    };
    _verifyKeySignature = async (signedCookie) => {
        const valueWithSignature = signedCookie.split(".");
        try {
            const value = valueWithSignature[0];
            const signature = valueWithSignature[1];
            const hmac = crypto.createHmac("sha256", this.secret);
            hmac.update(value);
            const expectedSignature = hmac.digest("hex");
            const isValidSignature = crypto.timingSafeEqual(Buffer.from(signature, "hex"), Buffer.from(expectedSignature, "hex"));
            if (!isValidSignature) {
                return null;
            }
            return value;
        } catch (e) {
        }
    };

    _returnValid(data, error, message) {
        return { data, error, message };
    }
}
