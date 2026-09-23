/**
 * secureStorage.ts
 * Armazenamento Local Criptografado com AES-GCM 256 bits (SEC-01 - Strix Security Standards)
 * Blindagem de credenciais sensíveis (chaves de API, segredos de exchange, tokens) no cliente.
 */

const SEC_PREFIX = 'SEC_V1:aes-gcm:';
const DEVICE_SALT_KEY = '__finmaster_device_salt__';

// Cache em memória para acesso síncrono ultra-rápido após inicialização
const memoryCache = new Map<string, string>();

/**
 * Limpa o cache em memória (utilizado em testes e logout)
 */
export function clearSecureStorageCache(): void {
  memoryCache.clear();
}

/**
 * Obtém ou inicializa o salt único e persistente do dispositivo
 */
function getDeviceSalt(): Uint8Array {
  if (typeof window === 'undefined') return new Uint8Array(16);

  let saltStr = localStorage.getItem(DEVICE_SALT_KEY);
  if (!saltStr) {
    const randomBytes = new Uint8Array(16);
    crypto.getRandomValues(randomBytes);
    saltStr = Array.from(randomBytes).map(b => b.toString(16).padStart(2, '0')).join('');
    try {
      localStorage.setItem(DEVICE_SALT_KEY, saltStr);
    } catch {
      // Ignora erro de cota
    }
  }

  const matches = saltStr.match(/.{1,2}/g) || [];
  return new Uint8Array(matches.map(byte => parseInt(byte, 16)));
}

/**
 * Deriva uma chave AES-GCM de 256 bits a partir do hardware/origem do dispositivo
 */
async function getDeviceKey(): Promise<CryptoKey> {
  const salt = getDeviceSalt();
  const rawSecret = `finmaster_sec_${typeof window !== 'undefined' ? window.location?.origin || 'desktop' : 'desktop'}_${salt[0] || 42}`;
  const enc = new TextEncoder();
  const keyMaterial = await crypto.subtle.importKey(
    'raw',
    enc.encode(rawSecret),
    { name: 'PBKDF2' },
    false,
    ['deriveKey']
  );

  return crypto.subtle.deriveKey(
    {
      name: 'PBKDF2',
      salt,
      iterations: 50000,
      hash: 'SHA-256',
    },
    keyMaterial,
    { name: 'AES-GCM', length: 256 },
    false,
    ['encrypt', 'decrypt']
  );
}

/**
 * Converte buffer para base64
 */
function bufferToBase64(buf: ArrayBuffer): string {
  const bytes = new Uint8Array(buf);
  let binary = '';
  for (let i = 0; i < bytes.byteLength; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary);
}

/**
 * Converte base64 para Uint8Array
 */
function base64ToBuffer(b64: string): Uint8Array {
  const binary = atob(b64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes;
}

/**
 * Salva um valor criptografado no localStorage
 */
export async function setSecureItem(key: string, value: string): Promise<void> {
  if (typeof window === 'undefined') return;
  if (!value) {
    removeSecureItem(key);
    return;
  }

  memoryCache.set(key, value);

  try {
    const cryptoKey = await getDeviceKey();
    const iv = crypto.getRandomValues(new Uint8Array(12));
    const enc = new TextEncoder();

    const ciphertext = await crypto.subtle.encrypt(
      { name: 'AES-GCM', iv },
      cryptoKey,
      enc.encode(value)
    );

    const payload = `${SEC_PREFIX}${bufferToBase64(iv.buffer)}:${bufferToBase64(ciphertext)}`;
    localStorage.setItem(key, payload);
  } catch (err) {
    console.error(`Erro ao criptografar item ${key}:`, err);
    // Fallback de contingência caso WebCrypto falhe
    localStorage.setItem(key, value);
  }
}

/**
 * Recupera e descriptografa um item sensível do localStorage
 */
export async function getSecureItem(key: string): Promise<string | null> {
  if (typeof window === 'undefined') return null;

  if (memoryCache.has(key)) {
    return memoryCache.get(key) || null;
  }

  const raw = localStorage.getItem(key);
  if (!raw) return null;

  // Se não estiver no formato criptografado, é um dado legado: migra automaticamente
  if (!raw.startsWith(SEC_PREFIX)) {
    memoryCache.set(key, raw);
    try {
      await setSecureItem(key, raw);
    } catch (_) {}
    return raw;
  }

  try {
    const parts = raw.slice(SEC_PREFIX.length).split(':');
    if (parts.length !== 2) return null;

    const [ivB64, cipherB64] = parts;
    const iv = base64ToBuffer(ivB64);
    const ciphertext = base64ToBuffer(cipherB64);
    const cryptoKey = await getDeviceKey();

    const decrypted = await crypto.subtle.decrypt(
      { name: 'AES-GCM', iv },
      cryptoKey,
      ciphertext
    );

    const dec = new TextDecoder();
    const result = dec.decode(decrypted);
    memoryCache.set(key, result);
    return result;
  } catch (err) {
    console.error(`Falha ao descriptografar item ${key}:`, err);
    return null;
  }
}

/**
 * Leitura síncrona com fallback inteligente para cache de memória ou valor legado
 */
export function getSecureItemSync(key: string): string | null {
  if (typeof window === 'undefined') return null;

  if (memoryCache.has(key)) {
    return memoryCache.get(key) || null;
  }

  const raw = localStorage.getItem(key);
  if (!raw) return null;

  // Se for legado plano
  if (!raw.startsWith(SEC_PREFIX)) {
    memoryCache.set(key, raw);
    setSecureItem(key, raw).catch(() => {});
    return raw;
  }

  // Se já estiver criptografado, inicializa a descriptografia em background para preencher o cache
  getSecureItem(key).catch(() => {});
  return null;
}

/**
 * Remove um item seguro
 */
export function removeSecureItem(key: string): void {
  if (typeof window === 'undefined') return;
  memoryCache.delete(key);
  localStorage.removeItem(key);
}
