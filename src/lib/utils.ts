import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/**
 * Previne ataques de Prototype Pollution eliminando chaves perigosas como
 * __proto__, constructor e prototype de objetos recebidos externamente (SEC-03).
 */
export function preventPrototypePollution<T>(obj: T): T {
  if (obj === null || typeof obj !== 'object') {
    return obj;
  }

  if (Array.isArray(obj)) {
    return obj.map(preventPrototypePollution) as unknown as T;
  }

  const cleanObj: Record<string, any> = {};
  for (const key of Object.keys(obj)) {
    if (key === '__proto__' || key === 'constructor' || key === 'prototype') {
      continue;
    }
    cleanObj[key] = preventPrototypePollution((obj as Record<string, any>)[key]);
  }

  return cleanObj as T;
}

/**
 * Fusão segura de objetos com imunidade a Prototype Pollution (SEC-03).
 */
export function safeMerge<T extends object, U extends object>(target: T, source: U): T & U {
  const cleanTarget = preventPrototypePollution(target);
  const cleanSource = preventPrototypePollution(source);

  const result: Record<string, any> = { ...cleanTarget };

  for (const [key, value] of Object.entries(cleanSource)) {
    if (key === '__proto__' || key === 'constructor' || key === 'prototype') {
      continue;
    }

    if (
      value !== null &&
      typeof value === 'object' &&
      !Array.isArray(value) &&
      typeof result[key] === 'object' &&
      result[key] !== null &&
      !Array.isArray(result[key])
    ) {
      result[key] = safeMerge(result[key], value);
    } else {
      result[key] = preventPrototypePollution(value);
    }
  }

  return result as T & U;
}
