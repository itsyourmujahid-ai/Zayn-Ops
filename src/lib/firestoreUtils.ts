/**
 * Utility helpers for Firestore operations
 */

/**
 * Recursively removes all `undefined` values from an object or array.
 * Firestore strictly rejects documents and batch operations containing `undefined` values.
 */
export function cleanFirestoreData<T>(obj: T): T {
  if (obj === null || obj === undefined) {
    return obj;
  }
  if (Array.isArray(obj)) {
    return obj
      .filter((item) => item !== undefined)
      .map((item) => (typeof item === 'object' && item !== null ? cleanFirestoreData(item) : item)) as unknown as T;
  }
  if (typeof obj === 'object' && !(obj instanceof Date)) {
    const clean: Record<string, any> = {};
    for (const [key, value] of Object.entries(obj as Record<string, any>)) {
      if (value !== undefined) {
        if (value !== null && typeof value === 'object' && !(value instanceof Date)) {
          clean[key] = cleanFirestoreData(value);
        } else {
          clean[key] = value;
        }
      }
    }
    return clean as T;
  }
  return obj;
}
