/**
 * sanitize.ts
 * Utilitário de Sanitização XSS usando DOMPurify (SEC-02 - Strix Security Standards)
 */

import DOMPurify from 'dompurify';

/**
 * Sanitiza strings HTML ou Markdown renderizado para impedir execução de scripts maliciosos,
 * injeções SVG, iframes ou manipuladores inline de eventos (onerror, onload, etc.).
 */
export function sanitizeHtml(dirty: string, options?: Record<string, unknown>): string {
  if (!dirty) return '';
  if (typeof window === 'undefined') {
    // Fallback se executado fora do contexto do browser (ex: SSR / build)
    return dirty
      .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '')
      .replace(/on\w+\s*=\s*["'][^"']*["']/gi, '');
  }

  const purifier = (typeof (DOMPurify as any)?.sanitize === 'function')
    ? DOMPurify
    : ((DOMPurify as any)?.default || DOMPurify);

  return String(purifier.sanitize(dirty, {
    USE_PROFILES: { html: true },
    ALLOWED_TAGS: [
      'b', 'i', 'em', 'strong', 'a', 'p', 'span', 'ul', 'ol', 'li', 'code', 'pre',
      'blockquote', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'table', 'thead', 'tbody',
      'tr', 'th', 'td', 'hr', 'br',
    ],
    ALLOWED_ATTR: ['href', 'target', 'rel', 'class', 'style'],
    ...options,
  }));
}
