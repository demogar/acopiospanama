import {
  createCipheriv,
  createDecipheriv,
  createHash,
  createHmac,
  hkdfSync,
  randomBytes,
  randomInt,
  timingSafeEqual,
} from 'node:crypto';

/**
 * Claves derivadas de SECRET_KEY con HKDF, una por propósito, para que comprometer un uso
 * no reutilice la misma clave en otro.
 */
export class Keys {
  readonly otp: Buffer;
  readonly email: Buffer;
  readonly recovery: Buffer;
  readonly totpEnc: Buffer;
  readonly codeEnc: Buffer;

  constructor(secret: string) {
    const ikm = Buffer.from(secret, 'utf8');
    const derive = (info: string) =>
      Buffer.from(hkdfSync('sha256', ikm, Buffer.from('acopio-panama'), Buffer.from(info), 32));
    this.otp = derive('otp-code-hmac-v1');
    this.email = derive('email-hmac-v1');
    this.recovery = derive('recovery-code-hmac-v1');
    this.totpEnc = derive('totp-secret-aes-gcm-v1');
    this.codeEnc = derive('otp-code-aes-gcm-v1');
  }
}

export function hmac(key: Buffer, value: string): string {
  return createHmac('sha256', key).update(value, 'utf8').digest('base64url');
}

export function sha256(value: string): string {
  return createHash('sha256').update(value, 'utf8').digest('base64url');
}

export function safeEqual(a: string, b: string): boolean {
  const ab = Buffer.from(a);
  const bb = Buffer.from(b);
  if (ab.length !== bb.length) return false;
  return timingSafeEqual(ab, bb);
}

/** Token opaco de 256 bits. */
export function randomToken(): string {
  return randomBytes(32).toString('base64url');
}

/** Código numérico de longitud fija, uniforme (randomInt evita sesgo de módulo). */
export function numericCode(digits: number): string {
  let out = '';
  for (let i = 0; i < digits; i++) out += String(randomInt(0, 10));
  return out;
}

const REPORT_ALPHABET = '23456789ABCDEFGHJKLMNPQRSTUVWXYZ'; // sin 0/O/1/I para dictarlo por teléfono

export function reportNumber(): string {
  let out = 'R-';
  for (let i = 0; i < 7; i++) out += REPORT_ALPHABET[randomInt(0, REPORT_ALPHABET.length)];
  return out;
}

export function recoveryCode(): string {
  // 10 caracteres en dos grupos: XXXXX-XXXXX
  let s = '';
  for (let i = 0; i < 10; i++) s += REPORT_ALPHABET[randomInt(0, REPORT_ALPHABET.length)];
  return `${s.slice(0, 5)}-${s.slice(5)}`;
}

export function encrypt(key: Buffer, plaintext: string): string {
  const iv = randomBytes(12);
  const cipher = createCipheriv('aes-256-gcm', key, iv);
  const ct = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()]);
  const tag = cipher.getAuthTag();
  return ['v1', iv.toString('base64url'), ct.toString('base64url'), tag.toString('base64url')].join('.');
}

export function decrypt(key: Buffer, payload: string): string {
  const [v, ivB, ctB, tagB] = payload.split('.');
  if (v !== 'v1' || !ivB || !ctB || !tagB) throw new Error('Formato de cifrado desconocido');
  const decipher = createDecipheriv('aes-256-gcm', key, Buffer.from(ivB, 'base64url'));
  decipher.setAuthTag(Buffer.from(tagB, 'base64url'));
  return Buffer.concat([decipher.update(Buffer.from(ctB, 'base64url')), decipher.final()]).toString('utf8');
}

/** Normalización conservadora: solo espacios y mayúsculas. No se quitan puntos ni sufijos «+». */
export function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}
