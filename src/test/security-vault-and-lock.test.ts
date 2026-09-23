import { describe, it, expect, beforeEach } from 'vitest';
import {
  encryptVault,
  decryptVault,
  calculateSha256,
  bufferToBase64,
  base64ToBuffer,
} from '@/services/cryptoVaultService';

describe('Segurança Criptográfica & Cofre E2EE (Fase 2)', () => {
  const masterPassword = 'MinhaSenhaSegura!123';
  const sampleFinancialData = {
    accounts: [
      { id: 'acc-1', name: 'Nubank Principal', balance: 14250.75 },
      { id: 'acc-2', name: 'Inter Investimentos', balance: 52000.0 },
    ],
    transactions: [
      { id: 'tx-1', description: 'Aporte Tesouro Selic', amount: 5000, type: 'expense' },
      { id: 'tx-2', description: 'Salário Consultoria', amount: 18000, type: 'income' },
    ],
    rules: [
      { id: 'rule-1', name: 'Auto Alimentação', pattern: 'ifood' },
    ],
  };

  it('deve calcular hashes SHA-256 consistentes e determinísticos', async () => {
    const hash1 = await calculateSha256('1234:salt-dispositivo-xyz');
    const hash2 = await calculateSha256('1234:salt-dispositivo-xyz');
    const hash3 = await calculateSha256('4321:salt-dispositivo-xyz');

    expect(hash1).toBe(hash2);
    expect(hash1).not.toBe(hash3);
    expect(hash1).toHaveLength(64); // 256 bits em hexadecimal
  });

  it('deve converter corretamente entre ArrayBuffer e Base64', () => {
    const originalText = 'FinMaster Super Seguro 2026';
    const encoder = new TextEncoder();
    const buffer = encoder.encode(originalText);

    const base64 = bufferToBase64(buffer);
    expect(base64).toBeDefined();

    const decodedBuffer = base64ToBuffer(base64);
    const decoder = new TextDecoder();
    const decodedText = decoder.decode(decodedBuffer);

    expect(decodedText).toBe(originalText);
  });

  it('deve criptografar e descriptografar dados do cofre com AES-GCM 256 bits', async () => {
    const encryptedPayload = await encryptVault(sampleFinancialData, masterPassword);

    expect(encryptedPayload.version).toBe('1.0');
    expect(encryptedPayload.salt).toBeDefined();
    expect(encryptedPayload.iv).toBeDefined();
    expect(encryptedPayload.ciphertext).toBeDefined();
    expect(encryptedPayload.checksum).toBeDefined();

    // Descriptografa com a senha correta
    const decryptedData = await decryptVault(encryptedPayload, masterPassword);

    expect(decryptedData).toEqual(sampleFinancialData);
    expect(decryptedData.accounts[0].name).toBe('Nubank Principal');
    expect(decryptedData.transactions[1].amount).toBe(18000);
  });

  it('deve rejeitar descriptografia quando a senha mestra estiver incorreta', async () => {
    const encryptedPayload = await encryptVault(sampleFinancialData, masterPassword);

    await expect(
      decryptVault(encryptedPayload, 'SenhaTotalmenteIncorreta999')
    ).rejects.toThrow();
  });

  it('deve rejeitar payloads violados ou com checksum inconsistente', async () => {
    const encryptedPayload = await encryptVault(sampleFinancialData, masterPassword);

    // Altera o checksum propositalmente para simular adulteração
    const tamperedPayload = {
      ...encryptedPayload,
      checksum: '0000000000000000000000000000000000000000000000000000000000000000',
    };

    await expect(
      decryptVault(tamperedPayload, masterPassword)
    ).rejects.toThrow(/Falha na verificação de integridade/);
  });

  it('deve exigir uma senha mestra com comprimento mínimo de 6 caracteres', async () => {
    await expect(
      encryptVault(sampleFinancialData, '123')
    ).rejects.toThrow(/pelo menos 6 caracteres/);
  });
});
