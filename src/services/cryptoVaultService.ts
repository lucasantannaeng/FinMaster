/**
 * Serviço de Criptografia de Ponta a Ponta (E2EE Vault) para o FinMaster.
 * Utiliza exclusivamente a Web Crypto API nativa (AES-GCM 256 bits + PBKDF2 com 100.000 iterações).
 * Em conformidade com a filosofia Ponytail (zero dependências externas, pura stdlib do browser/Node).
 */

export interface EncryptedVaultPayload {
  version: string;
  timestamp: string;
  salt: string; // Base64
  iv: string; // Base64
  ciphertext: string; // Base64
  checksum: string; // SHA-256 em Hex
}

/**
 * Converte ArrayBuffer para string Base64.
 */
export function bufferToBase64(buffer: ArrayBuffer | Uint8Array): string {
  const bytes = new Uint8Array(buffer);
  let binary = '';
  for (let i = 0; i < bytes.byteLength; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary);
}

/**
 * Converte string Base64 para Uint8Array.
 */
export function base64ToBuffer(base64: string): Uint8Array {
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes;
}

/**
 * Calcula o hash SHA-256 de uma string para checagem de integridade ou PIN.
 */
export async function calculateSha256(data: string): Promise<string> {
  const encoder = new TextEncoder();
  const buffer = await window.crypto.subtle.digest('SHA-256', encoder.encode(data));
  const hashArray = Array.from(new Uint8Array(buffer));
  return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
}

/**
 * Deriva uma chave AES-GCM de 256 bits a partir de uma senha usando PBKDF2 (100.000 iterações).
 */
export async function deriveKeyFromPassword(password: string, salt: Uint8Array): Promise<CryptoKey> {
  const encoder = new TextEncoder();
  const passwordKey = await window.crypto.subtle.importKey(
    'raw',
    encoder.encode(password),
    'PBKDF2',
    false,
    ['deriveKey']
  );

  return window.crypto.subtle.deriveKey(
    {
      name: 'PBKDF2',
      salt: salt as any,
      iterations: 100000,
      hash: 'SHA-256',
    },
    passwordKey,
    { name: 'AES-GCM', length: 256 },
    false,
    ['encrypt', 'decrypt']
  );
}

/**
 * Criptografa qualquer objeto de dados com AES-GCM 256 bits e gera payload seguro para download.
 */
export async function encryptVault(data: any, masterPassword: string): Promise<EncryptedVaultPayload> {
  if (!masterPassword || masterPassword.length < 6) {
    throw new Error('A senha mestra deve ter pelo menos 6 caracteres.');
  }

  const jsonString = JSON.stringify(data);
  const checksum = await calculateSha256(jsonString);

  // Gera Salt de 16 bytes e IV de 12 bytes criptograficamente seguros
  const salt = window.crypto.getRandomValues(new Uint8Array(16));
  const iv = window.crypto.getRandomValues(new Uint8Array(12));

  const key = await deriveKeyFromPassword(masterPassword, salt);
  const encoder = new TextEncoder();

  const ciphertextBuffer = await window.crypto.subtle.encrypt(
    {
      name: 'AES-GCM',
      iv: iv as any,
    },
    key,
    encoder.encode(jsonString)
  );

  return {
    version: '1.0',
    timestamp: new Date().toISOString(),
    salt: bufferToBase64(salt),
    iv: bufferToBase64(iv),
    ciphertext: bufferToBase64(ciphertextBuffer),
    checksum,
  };
}

/**
 * Descriptografa um payload seguro do cofre e valida a integridade dos dados via checksum.
 */
export async function decryptVault(payload: EncryptedVaultPayload, masterPassword: string): Promise<any> {
  if (!payload.ciphertext || !payload.salt || !payload.iv) {
    throw new Error('Formato de cofre criptografado inválido ou corrompido.');
  }

  const salt = base64ToBuffer(payload.salt);
  const iv = base64ToBuffer(payload.iv);
  const ciphertext = base64ToBuffer(payload.ciphertext);

  const key = await deriveKeyFromPassword(masterPassword, salt);

  try {
    const decryptedBuffer = await window.crypto.subtle.decrypt(
      {
        name: 'AES-GCM',
        iv: iv as any,
      },
      key,
      ciphertext as any
    );

    const decoder = new TextDecoder();
    const jsonString = decoder.decode(decryptedBuffer);

    // Valida o checksum SHA-256 se fornecido
    if (payload.checksum) {
      const calculatedChecksum = await calculateSha256(jsonString);
      if (calculatedChecksum !== payload.checksum) {
        throw new Error('Falha na verificação de integridade: os dados foram corrompidos ou alterados.');
      }
    }

    return JSON.parse(jsonString);
  } catch (err: any) {
    if (err.name === 'OperationError' || err.message?.includes('operation')) {
      throw new Error('Senha mestra incorreta ou arquivo violado.');
    }
    throw err;
  }
}

/**
 * Exporta os dados do cofre e aciona o download local do arquivo `.finmaster.enc`.
 */
export async function downloadEncryptedVault(data: any, masterPassword: string, fileNamePrefix = 'finmaster-vault'): Promise<void> {
  const payload = await encryptVault(data, masterPassword);
  const jsonBlob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(jsonBlob);

  const dateStr = new Date().toISOString().split('T')[0];
  const a = document.createElement('a');
  a.href = url;
  a.download = `${fileNamePrefix}-${dateStr}.finmaster.enc`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

/**
 * Lê e descriptografa um arquivo `.finmaster.enc` enviado pelo usuário.
 */
export async function parseEncryptedVaultFile(file: File, masterPassword: string): Promise<any> {
  const text = await file.text();
  let payload: EncryptedVaultPayload;
  try {
    payload = JSON.parse(text);
  } catch {
    throw new Error('O arquivo selecionado não é um arquivo JSON/Cofre válido.');
  }

  return await decryptVault(payload, masterPassword);
}
