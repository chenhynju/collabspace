import {createHmac,timingSafeEqual} from 'crypto';
/** A signed, one-way stamp; never put the password hash itself in a token. */
export function credentialVersion(passwordHash:string|null,secret:string){return createHmac('sha256',secret).update(passwordHash||'oauth-only').digest('base64url');}
export function credentialMatches(stamp:unknown,passwordHash:string|null,secret:string){const expected=credentialVersion(passwordHash,secret);return typeof stamp==='string'&&/^[A-Za-z0-9_-]{43}$/.test(stamp)&&stamp.length===expected.length&&timingSafeEqual(Buffer.from(stamp),Buffer.from(expected));}
