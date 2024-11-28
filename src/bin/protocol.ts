// Import necessary types, enums, and error classes
import type { IQSocketProtocolChunk, IQSocketProtocolMessage, TChunkBinary } from './protocol.types';
import { EQSocketProtocolContentType } from './protocol.enums';
import { QSocketProtocolEncodeError, QSocketProtocolDecodeError } from './protocol.errors';

//#region Text Encoding/Decoding

/**
 * Encodes a string into a Uint8Array using the most efficient available method.
 * Falls back to manual UTF-8 encoding if neither TextEncoder nor Buffer is available.
 *
 * @returns {(str: string) => Uint8Array} A function that takes a string and returns its Uint8Array representation.
 */
const encodeString = ((): ((str: string) => Uint8Array) => {
	// Use TextEncoder if available (modern browsers and Node.js v11+)
	if (typeof TextEncoder !== 'undefined') {
		const encoder = new TextEncoder();
		return (str: string): Uint8Array => encoder.encode(str);
	}

	// Fallback to Buffer if available (Node.js environment)
	if (typeof Buffer !== 'undefined') {
		return (str: string): Uint8Array => {
			const buffer = Buffer.from(str, 'utf8'); // Encode string to Buffer
			const copy = new Uint8Array(buffer.length); // Create a new Uint8Array with the same length
			copy.set(buffer); // Copy Buffer contents to Uint8Array
			return copy; // Return the copied Uint8Array
		};
	}

	// Manual UTF-8 encoding as a last resort
	return (str: string): Uint8Array => {
		const maxLength = str.length * 4; // Maximum possible length (each character can take up to 4 bytes in UTF-8)
		const result = new Uint8Array(maxLength); // Initialize the result array
		let offset = 0; // Current position in the result array

		for (let i = 0; i < str.length; i++) {
			let charCode = str.charCodeAt(i); // Get UTF-16 code unit

			if (charCode < 0x80) {
				// 1-byte ASCII character
				result[offset++] = charCode;
			} else if (charCode < 0x800) {
				// 2-byte UTF-8 character
				result[offset++] = 0xc0 | (charCode >> 6);
				result[offset++] = 0x80 | (charCode & 0x3f);
			} else if (charCode < 0xd800 || charCode >= 0xe000) {
				// 3-byte UTF-8 character (excluding surrogate pairs)
				result[offset++] = 0xe0 | (charCode >> 12);
				result[offset++] = 0x80 | ((charCode >> 6) & 0x3f);
				result[offset++] = 0x80 | (charCode & 0x3f);
			} else {
				// 4-byte UTF-8 character (surrogate pairs)
				if (++i >= str.length) throw new Error('Invalid surrogate pair in string');
				// Combine surrogate pair into a single code point
				charCode = 0x10000 + (((charCode & 0x3ff) << 10) | (str.charCodeAt(i) & 0x3ff));
				result[offset++] = 0xf0 | (charCode >> 18);
				result[offset++] = 0x80 | ((charCode >> 12) & 0x3f);
				result[offset++] = 0x80 | ((charCode >> 6) & 0x3f);
				result[offset++] = 0x80 | (charCode & 0x3f);
			}
		}

		// Slice the result to the actual length used
		const resultBuffer = result.slice(0, offset);
		return resultBuffer;
	};
})();

/**
 * Decodes a Uint8Array into a string using the most efficient available method.
 * Falls back to manual UTF-8 decoding if neither TextDecoder nor Buffer is available.
 *
 * @returns {(bytes: Uint8Array) => string} A function that takes a Uint8Array and returns its string representation.
 */
const decodeString = ((): ((bytes: Uint8Array) => string) => {
	// Use TextDecoder if available (modern browsers and Node.js v11+)
	if (typeof TextDecoder !== 'undefined') {
		const decoder = new TextDecoder('utf-8');
		return (bytes: Uint8Array): string => decoder.decode(bytes);
	}

	// Fallback to Buffer if available (Node.js environment)
	if (typeof Buffer !== 'undefined') {
		return (bytes: Uint8Array): string => Buffer.from(bytes).toString('utf8');
	}

	// Manual UTF-8 decoding as a last resort
	return (bytes: Uint8Array): string => {
		let result = ''; // Initialize the result string
		let i = 0; // Current position in the byte array

		while (i < bytes.length) {
			const byte1 = bytes[i++]; // Read the first byte

			if (byte1 < 0x80) {
				// 1-byte ASCII character
				result += String.fromCharCode(byte1);
			} else if (byte1 < 0xe0) {
				// 2-byte UTF-8 character
				const byte2 = bytes[i++];
				if ((byte2 & 0xc0) !== 0x80) throw new Error('Invalid UTF-8 sequence');
				result += String.fromCharCode(((byte1 & 0x1f) << 6) | (byte2 & 0x3f));
			} else if (byte1 < 0xf0) {
				// 3-byte UTF-8 character
				const byte2 = bytes[i++];
				const byte3 = bytes[i++];
				if ((byte2 & 0xc0) !== 0x80 || (byte3 & 0xc0) !== 0x80) throw new Error('Invalid UTF-8 sequence');
				result += String.fromCharCode(((byte1 & 0x0f) << 12) | ((byte2 & 0x3f) << 6) | (byte3 & 0x3f));
			} else {
				// 4-byte UTF-8 character (surrogate pairs)
				const byte2 = bytes[i++];
				const byte3 = bytes[i++];
				const byte4 = bytes[i++];
				if ((byte2 & 0xc0) !== 0x80 || (byte3 & 0xc0) !== 0x80 || (byte4 & 0xc0) !== 0x80) throw new Error('Invalid UTF-8 sequence');

				const codePoint = ((byte1 & 0x07) << 18) | ((byte2 & 0x3f) << 12) | ((byte3 & 0x3f) << 6) | (byte4 & 0x3f);

				// Convert code point to surrogate pair for UTF-16
				const highSurrogate = 0xd800 + ((codePoint - 0x10000) >> 10);
				const lowSurrogate = 0xdc00 + ((codePoint - 0x10000) & 0x3ff);

				result += String.fromCharCode(highSurrogate, lowSurrogate);
			}
		}

		return result;
	};
})();

//#endregion

//#region Integer Encoding/Decoding

/**
 * Writes a 32-bit unsigned integer into a Uint8Array at the specified offset in big-endian format.
 *
 * @param {Uint8Array} buffer - The buffer to write the integer into.
 * @param {number} offset - The position in the buffer to start writing.
 * @param {number} value - The 32-bit unsigned integer to write.
 */
function writeUInt32BE(buffer: Uint8Array, offset: number, value: number): void {
	buffer[offset] = (value >>> 24) & 0xff;
	buffer[offset + 1] = (value >>> 16) & 0xff;
	buffer[offset + 2] = (value >>> 8) & 0xff;
	buffer[offset + 3] = value & 0xff;
}

/**
 * Reads a 32-bit unsigned integer from a Uint8Array at the specified offset in big-endian format.
 *
 * @param {Uint8Array} buffer - The buffer to read the integer from.
 * @param {number} offset - The position in the buffer to start reading.
 * @returns {number} The 32-bit unsigned integer read from the buffer.
 */
function readUInt32BE(buffer: Uint8Array, offset: number): number {
	return ((buffer[offset] << 24) | (buffer[offset + 1] << 16) | (buffer[offset + 2] << 8) | buffer[offset + 3]) >>> 0;
}

//#endregion

//#region Floating-Point Number Encoding/Decoding

/**
 * A static buffer used for temporary storage during floating-point number encoding/decoding.
 * This buffer should only be used within the encoding/decoding functions to avoid unintended side effects.
 */
const staticDataViewBuffer = new Uint8Array(8);
const staticDataView = new DataView(staticDataViewBuffer.buffer);

/**
 * Writes a 64-bit floating-point number into a Uint8Array at the specified offset in big-endian format.
 *
 * @param {Uint8Array} buffer - The buffer to write the floating-point number into.
 * @param {number} offset - The position in the buffer to start writing.
 * @param {number} value - The 64-bit floating-point number to write.
 */
function writeDoubleBE(buffer: Uint8Array, offset: number, value: number): void {
	staticDataView.setFloat64(0, value, false); // false for big-endian
	buffer.set(staticDataViewBuffer, offset); // Copy the bytes into the target buffer
}

/**
 * Reads a 64-bit floating-point number from a Uint8Array at the specified offset in big-endian format.
 *
 * @param {Uint8Array} buffer - The buffer to read the floating-point number from.
 * @param {number} offset - The position in the buffer to start reading.
 * @returns {number} The 64-bit floating-point number read from the buffer.
 */
function readDoubleBE(buffer: Uint8Array, offset: number): number {
	staticDataViewBuffer.set(buffer.subarray(offset, offset + 8)); // Copy 8 bytes to the static buffer
	return staticDataView.getFloat64(0, false); // false for big-endian
}

//#endregion

//#region Encoding

/**
 * Serializes an IQSocketProtocolMessage into a single Uint8Array.
 *
 * @param {IQSocketProtocolMessage} message - The message to serialize.
 * @returns {Uint8Array} The serialized binary representation of the message.
 * @throws {QSocketProtocolEncodeError} If an encoding error occurs.
 */
export function to(message: IQSocketProtocolMessage): Uint8Array {
	try {
		// Calculate the total length required for the serialized buffer
		let totalLength = 0;
		const chunkBinaries: TChunkBinary[] = new Array(message.length);

		let chunk: IQSocketProtocolChunk;
		let meta: Uint8Array;
		let data: Uint8Array;

		// Serialize each chunk in the message
		for (let i = 0; i < message.length; i++) {
			chunk = message[i];

			// Encode metadata and payload
			meta = encodeString(JSON.stringify(chunk.meta));
			data = encodePayload(chunk);

			// Accumulate the total length:
			// 1 byte for encoding, 4 bytes for meta length, meta.length bytes,
			// 4 bytes for data length, and data.length bytes
			totalLength += 1 + 4 + meta.length + 4 + data.length;

			// Store the serialized chunk data
			chunkBinaries[i] = {
				encoding: chunk.payload['Content-Type'],
				meta,
				data,
			};
		}

		// Create a buffer to hold the entire serialized message
		const messageBinary = new Uint8Array(totalLength);
		let offset = 0;
		let chunkBinary: TChunkBinary;

		// Write each serialized chunk into the buffer
		for (let i = 0; i < chunkBinaries.length; i++) {
			chunkBinary = chunkBinaries[i];

			// Write the content type encoding (1 byte)
			messageBinary[offset] = chunkBinary.encoding;
			offset += 1;

			// Write the length of the metadata (4 bytes)
			writeUInt32BE(messageBinary, offset, chunkBinary.meta.length);
			offset += 4;

			// Write the metadata bytes
			messageBinary.set(chunkBinary.meta, offset);
			offset += chunkBinary.meta.length;

			// Write the length of the payload data (4 bytes)
			writeUInt32BE(messageBinary, offset, chunkBinary.data.length);
			offset += 4;

			// Write the payload data bytes
			messageBinary.set(chunkBinary.data, offset);
			offset += chunkBinary.data.length;
		}

		return messageBinary; // Return the fully serialized message
	} catch (error) {
		// Wrap and rethrow any encoding errors
		throw new QSocketProtocolEncodeError((error as Error).message);
	}
}

/**
 * Encodes the payload of a protocol chunk into a Uint8Array based on its content type.
 *
 * @param {IQSocketProtocolChunk} chunk - The protocol chunk containing the payload to encode.
 * @returns {Uint8Array} The encoded payload data.
 * @throws {Error} If the content type is unknown or the data type is invalid.
 */
function encodePayload(chunk: IQSocketProtocolChunk): Uint8Array {
	const { data } = chunk.payload;
	const contentType = chunk.payload['Content-Type'];

	switch (contentType) {
		case EQSocketProtocolContentType.UNDEFINED:
		case EQSocketProtocolContentType.NULL:
			return new Uint8Array(0); // No data for undefined or null

		case EQSocketProtocolContentType.BOOLEAN:
			return new Uint8Array([data ? 1 : 0]); // 1 byte representing boolean value

		case EQSocketProtocolContentType.NUMBER:
			const numberBuffer = new Uint8Array(8); // 8 bytes for 64-bit float
			writeDoubleBE(numberBuffer, 0, data as number); // Encode the number
			return numberBuffer;

		case EQSocketProtocolContentType.STRING:
			return encodeString(data as string); // Encode the string

		case EQSocketProtocolContentType.JSON:
			return encodeString(JSON.stringify(data)); // Encode the JSON string

		case EQSocketProtocolContentType.BUFFER:
			if (data instanceof Uint8Array) {
				return data; // Return the existing Uint8Array
			} else if (data instanceof Buffer) {
				return new Uint8Array(data); // Convert Buffer to Uint8Array
			} else {
				throw new Error('Invalid data type for BUFFER content type'); // Unsupported data type
			}

		default:
			throw new Error('Unknown content type'); // Unsupported content type
	}
}

//#endregion

//#region Decoding

/**
 * Deserializes a Uint8Array into an IQSocketProtocolMessage.
 *
 * @param {Uint8Array} buffer - The binary data to deserialize.
 * @returns {IQSocketProtocolMessage} The deserialized message.
 * @throws {QSocketProtocolDecodeError} If a decoding error occurs.
 */
export function from(buffer: Uint8Array): IQSocketProtocolMessage {
	try {
		const message: IQSocketProtocolMessage = []; // Initialize the message array
		let offset = 0; // Current position in the buffer

		// Iterate through the buffer until all data is processed
		while (offset < buffer.length) {
			// Read the content type encoding (1 byte)
			const contentType = buffer[offset];
			offset += 1;

			// Read the length of the metadata (4 bytes)
			const metaLength = readUInt32BE(buffer, offset);
			offset += 4;

			// Read and decode the metadata
			const metaString = decodeString(buffer.slice(offset, offset + metaLength));
			let meta: any;
			try {
				meta = JSON.parse(metaString); // Parse the JSON metadata
			} catch (error) {
				console.log('Failed to parse metadata');
				throw error; // Rethrow the parsing error
			}

			offset += metaLength; // Move the offset past the metadata

			// Read the length of the payload data (4 bytes)
			const dataLength = readUInt32BE(buffer, offset);
			offset += 4;

			// Read and decode the payload data
			const data = decodePayloadData(buffer, contentType, offset, dataLength);
			offset += dataLength; // Move the offset past the payload data

			// Push the decoded chunk into the message array
			message.push({
				meta,
				payload: {
					data,
					'Content-Type': contentType,
				},
			});
		}

		return message; // Return the fully decoded message
	} catch (error) {
		// Wrap and rethrow any decoding errors
		throw new QSocketProtocolDecodeError((error as Error).message);
	}
}

/**
 * Decodes the payload data of a protocol chunk based on its content type.
 *
 * @param {Uint8Array} buffer - The binary data containing the payload.
 * @param {EQSocketProtocolContentType} contentType - The content type identifier.
 * @param {number} offset - The position in the buffer where the payload data starts.
 * @param {number} length - The length of the payload data in bytes.
 * @returns {any} The decoded payload data.
 * @throws {Error} If the content type is unknown.
 */
function decodePayloadData(buffer: Uint8Array, contentType: EQSocketProtocolContentType, offset: number, length: number): any {
	switch (contentType) {
		case EQSocketProtocolContentType.UNDEFINED:
			return undefined; // No data for undefined

		case EQSocketProtocolContentType.NULL:
			return null; // No data for null

		case EQSocketProtocolContentType.BOOLEAN:
			return buffer[offset] !== 0; // Decode boolean value

		case EQSocketProtocolContentType.NUMBER:
			return readDoubleBE(buffer, offset); // Decode 64-bit float

		case EQSocketProtocolContentType.STRING:
			return decodeString(buffer.slice(offset, offset + length)); // Decode string

		case EQSocketProtocolContentType.JSON:
			return JSON.parse(decodeString(buffer.slice(offset, offset + length))); // Decode JSON string

		case EQSocketProtocolContentType.BUFFER:
			return buffer.slice(offset, offset + length); // Return a slice of the buffer

		default:
			throw new Error('Unknown content type'); // Unsupported content type
	}
}

//#endregion
