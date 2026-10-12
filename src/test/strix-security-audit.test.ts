/// <reference types="node" />
import { describe, it, expect, beforeEach } from 'vitest';
import { sanitizeHtml } from '@/lib/sanitize';
import { preventPrototypePollution, safeMerge } from '@/lib/utils';
import { setSecureItem, getSecureItem, removeSecureItem, clearSecureStorageCache } from '@/lib/secureStorage';
import fs from 'fs';
import path from 'path';

describe('Strix Security Auditor (SAST & DevSecOps Compliance)', () => {
  beforeEach(() => {
    localStorage.clear();
    clearSecureStorageCache();
  });

  describe('SEC-01: Secrets & Credentials Protection (AES-GCM 256 bits)', () => {
    it('deve criptografar credenciais sensíveis no localStorage com prefixo SEC_V1', async () => {
      const sensitiveApiKey = 'AIzaSyA_SUPER_SECRET_GEMINI_KEY_12345';
      await setSecureItem('CUSTOM_AI_API_KEY', sensitiveApiKey);

      const rawStored = localStorage.getItem('CUSTOM_AI_API_KEY');
      expect(rawStored).toBeTruthy();
      expect(rawStored?.startsWith('SEC_V1:aes-gcm:')).toBe(true);
      expect(rawStored).not.toContain(sensitiveApiKey);

      const decrypted = await getSecureItem('CUSTOM_AI_API_KEY');
      expect(decrypted).toBe(sensitiveApiKey);
    });

    it('deve migrar automaticamente credenciais legadas em texto plano para envelope seguro', async () => {
      const legacyKey = 'gsk_LEGACY_PLAIN_GROQ_KEY_999';
      localStorage.setItem('CUSTOM_AI_API_KEY', legacyKey);

      const readVal = await getSecureItem('CUSTOM_AI_API_KEY');
      expect(readVal).toBe(legacyKey);

      // Aguarda persistência assíncrona
      await new Promise(resolve => setTimeout(resolve, 50));
      const updatedRaw = localStorage.getItem('CUSTOM_AI_API_KEY');
      expect(updatedRaw?.startsWith('SEC_V1:aes-gcm:')).toBe(true);
    });

    it('deve remover itens com segurança', async () => {
      await setSecureItem('OKX_API_KEY', 'my-okx-key');
      expect(localStorage.getItem('OKX_API_KEY')).toBeTruthy();

      removeSecureItem('OKX_API_KEY');
      expect(localStorage.getItem('OKX_API_KEY')).toBeNull();
      const read = await getSecureItem('OKX_API_KEY');
      expect(read).toBeNull();
    });
  });

  describe('SEC-02: XSS & DOM Sanitization (DOMPurify)', () => {
    it('deve neutralizar injeções de script e manipuladores de eventos maliciosos', () => {
      const payload1 = '<script>alert("xss")</script><p>Mensagem legítima</p>';
      const sanitized1 = sanitizeHtml(payload1);
      expect(sanitized1).not.toContain('<script>');
      expect(sanitized1).not.toContain('alert');
      expect(sanitized1).toContain('Mensagem legítima');

      const payload2 = '<img src="x" onerror="alert(document.cookie)" /><strong>Negrito</strong>';
      const sanitized2 = sanitizeHtml(payload2);
      expect(sanitized2).not.toContain('onerror');
      expect(sanitized2).not.toContain('document.cookie');
      expect(sanitized2).toContain('Negrito');
    });

    it('deve preservar formatação segura (tabelas, listas, links seguros)', () => {
      const safeMarkdownHtml = '<h3>Resumo Financeiro</h3><table class="w-full"><tr><th>Item</th></tr></table>';
      const clean = sanitizeHtml(safeMarkdownHtml);
      expect(clean).toContain('<h3>Resumo Financeiro</h3>');
      expect(clean).toContain('<table');
      expect(clean).toContain('<th>Item</th>');
    });
  });

  describe('SEC-03: Prototype Pollution Protection', () => {
    it('deve purgar chaves __proto__, constructor e prototype de objetos', () => {
      const maliciousPayload = JSON.parse('{"validKey": 123, "__proto__": {"polluted": true}, "constructor": "bad"}');
      const clean = preventPrototypePollution(maliciousPayload);

      expect(clean.validKey).toBe(123);
      expect(Object.prototype.hasOwnProperty('polluted')).toBe(false);
      expect((clean as any).polluted).toBeUndefined();
      expect((clean as any).constructor).toBe(Object);
    });

    it('deve realizar fusão segura de objetos sem poluir o protótipo global', () => {
      const target = { a: 1, config: { deep: true } };
      const source = JSON.parse('{"b": 2, "__proto__": {"isAdmin": true}, "config": {"deep": false}}');

      const merged = safeMerge(target, source);
      expect(merged.a).toBe(1);
      expect(merged.b).toBe(2);
      expect(merged.config.deep).toBe(false);
      expect((Object.prototype as any).isAdmin).toBeUndefined();
    });
  });

  describe('SEC-04: Electron & Desktop Process Hardening', () => {
    it('deve garantir que electron/main.cjs possui webSecurity: true, sandbox: true e contextIsolation: true', () => {
      const mainPath = path.resolve(__dirname, '../../electron/main.cjs');
      const mainContent = fs.readFileSync(mainPath, 'utf-8');

      expect(mainContent).toContain('contextIsolation: true');
      expect(mainContent).toContain('nodeIntegration: false');
      expect(mainContent).toContain('sandbox: true');
      expect(mainContent).toContain('webSecurity: true');
      expect(mainContent).toContain('allowRunningInsecureContent: false');
      expect(mainContent).toContain('will-navigate');
    });

    it('deve garantir que electron/preload.cjs não expõe ipcRenderer diretamente ao renderer', () => {
      const preloadPath = path.resolve(__dirname, '../../electron/preload.cjs');
      const preloadContent = fs.readFileSync(preloadPath, 'utf-8');

      expect(preloadContent).toContain('contextBridge.exposeInMainWorld');
      expect(preloadContent).not.toContain('window.ipcRenderer = ipcRenderer');
    });
  });

  describe('SEC-05: Code Injection Prevention', () => {
    it('deve banir eval() e new Function() em todo o código fonte de src/', () => {
      const srcDir = path.resolve(__dirname, '../..');
      
      function scanDir(dir: string): string[] {
        let files: string[] = [];
        for (const item of fs.readdirSync(dir)) {
          if (item === 'node_modules' || item === 'dist' || item === 'release' || item === 'android') continue;
          const fullPath = path.join(dir, item);
          const stat = fs.statSync(fullPath);
          if (stat.isDirectory()) {
            files = files.concat(scanDir(fullPath));
          } else if (/\.(ts|tsx|js|cjs|mjs)$/.test(item) && !item.includes('strix-security-audit.test.ts')) {
            files.push(fullPath);
          }
        }
        return files;
      }

      const allFiles = scanDir(path.join(srcDir, 'src'));
      const violations: string[] = [];

      for (const file of allFiles) {
        const content = fs.readFileSync(file, 'utf-8');
        if (/\beval\s*\(/.test(content)) {
          violations.push(`eval() encontrado em: ${file}`);
        }
        if (/new\s+Function\s*\(/.test(content)) {
          violations.push(`new Function() encontrado em: ${file}`);
        }
      }

      expect(violations).toEqual([]);
    });
  });
});
