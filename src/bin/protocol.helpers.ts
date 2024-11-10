/** Check if Buffer is available (Node.js environment) */
export const hasBuffer = typeof Buffer !== 'undefined' && typeof Buffer.isBuffer === 'function';

/**
 * Helper function to determine if an object is a Buffer.
 *
 * @param obj - The object to check.
 * @returns A boolean indicating whether the object is a Buffer.
 */
export function isBuffer(obj: any): obj is Buffer {
	return hasBuffer && Buffer.isBuffer(obj);
}
