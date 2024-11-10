//#region Import types
import type { IQSocketProtocolChunk, IQSocketProtocolMessage, TQSocketProtocolCompressor, TQSocketProtocolPayloadData } from './protocol.types';
//#endregion

//#region Import modules
import { EQSocketProtocolContentEncoding, EQSocketProtocolContentType } from './protocol.enums';
import { QSocketProtocolDecodeError, QSocketProtocolEncodeError } from './protocol.errors';
import { hasBuffer, isBuffer } from './protocol.helpers';
//#endregion

/**
 * The `QSocketProtocol` class implements a protocol for serializing and deserializing messages
 * for data transmission, supporting compression and various payload data types.
 *
 * This class provides methods for encoding (`to`) and decoding (`from`) messages, allowing users to
 * efficiently transmit data as structured messages. It handles payloads with support for data types
 * such as JSON, strings, binary buffers, and more.
 *
 * Key Features:
 * - Message serialization with support for metadata and payload data.
 * - Message decoding, including header validation and decompression if necessary.
 * - Message compression support (GZIP and DEFLATE) to reduce data size during transmission.
 * - Configurable maximum uncompressed data size and support for custom compressors.
 *
 * Usage:
 * Useful in high-performance data transmission systems where minimizing latency and optimizing
 * data size is critical. Compatible with both Node.js and browser environments.
 *
 * @example
 * // Creating an instance with a GZIP compressor
 * const protocol = new QSocketProtocol(compressor, 1024);
 *
 * @example
 * // Encoding a message
 * const encodedMessage = await protocol.to(message);
 *
 * @example
 * // Decoding a message
 * const decodedMessage = await protocol.from(encodedBuffer);
 */
export default class QSocketProtocol {
	private compressor?: TQSocketProtocolCompressor;
	private maxUncompressedSize: number;

	/**
	 * @description Initializes the `QSocketProtocol` instance with an optional compressor and a specified maximum size for uncompressed data.
	 *
	 * @param compressor - Optional object implementing `TQSocketProtocolCompressor` for data compression and decompression.
	 * @param maxUncompressedSize - Maximum size in bytes for uncompressed data. Default is 10KB.
	 */
	constructor(compressor?: TQSocketProtocolCompressor, maxUncompressedSize: number = 10 * 1024) {
		this.compressor = compressor;
		this.maxUncompressedSize = maxUncompressedSize;
	}

	/**
	 * @description Encodes a message into a `Buffer` or `Uint8Array`, applying optional compression if the message exceeds the maximum uncompressed size.
	 *
	 * @param message - A structured protocol message to encode.
	 * @returns A `Promise` resolving to the encoded message as `Buffer` or `Uint8Array`, or an `EncodeError` on failure.
	 */
	public async to(message: IQSocketProtocolMessage): Promise<Buffer | Uint8Array | QSocketProtocolEncodeError> {
		try {
			const chunkBuffers: (Buffer | Uint8Array)[] = [];

			// Encode each chunk in the message
			for (const chunk of message) {
				const chunkBuffer = await this.encodeChunk(chunk);
				const chunkLengthBuffer = this.writeUInt32(chunkBuffer.length);
				const chunkEntryBuffer = this.concatBuffers([chunkLengthBuffer, chunkBuffer]);
				chunkBuffers.push(chunkEntryBuffer);
			}

			// Concatenate all chunk buffers
			const messageData = this.concatBuffers(chunkBuffers);
			let compressedMessageData = messageData;
			let compressionFlag = 0;
			let compressionFormat = EQSocketProtocolContentEncoding.RAW;
			const uncompressedLength = messageData.length;
			let compressedLength = messageData.length;

			// Apply compression if necessary
			if (this.compressor && uncompressedLength > this.maxUncompressedSize) {
				compressedMessageData = await this.compressor.toGzip(messageData);
				compressedLength = compressedMessageData.length;
				compressionFlag = 1;
				compressionFormat = EQSocketProtocolContentEncoding.GZIP;
			}

			// Create header
			const compressionFlagByte = this.writeUInt8(compressionFlag);
			const compressionFormatByte = this.writeUInt8(compressionFormat);
			const uncompressedLengthBuffer = this.writeUInt32(uncompressedLength);
			const compressedLengthBuffer = this.writeUInt32(compressedLength);

			const headerBuffers = [compressionFlagByte, compressionFormatByte, uncompressedLengthBuffer, compressedLengthBuffer];

			// Combine header and message data
			const finalBuffers = [...headerBuffers, compressedMessageData];
			const finalMessageBuffer = this.concatBuffers(finalBuffers);

			return finalMessageBuffer;
		} catch (error) {
			return new QSocketProtocolEncodeError((error as Error).message);
		}
	}

	/**
	 * @description Decodes a message from a `Buffer` or `Uint8Array`, decompressing if necessary, and converts it into structured protocol chunks.
	 *
	 * @param buffer - Encoded message data.
	 * @returns A `Promise` resolving to a structured protocol message, or a `DecodeError` on failure.
	 */
	public async from(buffer: Buffer | Uint8Array): Promise<IQSocketProtocolMessage | QSocketProtocolDecodeError> {
		try {
			let offset = 0;

			if (buffer.length < 10) {
				throw new QSocketProtocolDecodeError('Buffer too small to contain header');
			}

			// Read header
			const compressionFlag = this.readUInt8(buffer, offset);
			offset += 1;
			const compressionFormat = this.readUInt8(buffer, offset);
			offset += 1;
			const uncompressedLength = this.readUInt32(buffer, offset);
			offset += 4;
			const compressedLength = this.readUInt32(buffer, offset);
			offset += 4;

			if (buffer.length < offset + compressedLength) {
				throw new QSocketProtocolDecodeError('Buffer too small for compressed data');
			}

			const compressedMessageData = buffer.subarray(offset, offset + compressedLength);
			offset += compressedLength;

			if (compressedMessageData.length !== compressedLength) {
				throw new QSocketProtocolDecodeError('Compressed data length mismatch');
			}

			let messageData: Buffer | Uint8Array = compressedMessageData;

			// Decompress if necessary
			if (compressionFlag === 1) {
				if (!this.compressor) {
					throw new QSocketProtocolDecodeError('Compressor not available for decompression');
				}
				if (compressionFormat === EQSocketProtocolContentEncoding.GZIP) {
					messageData = await this.compressor.fromGzip(compressedMessageData);
				} else if (compressionFormat === EQSocketProtocolContentEncoding.DEFLATE) {
					messageData = await this.compressor.fromDeflate(compressedMessageData);
				} else {
					throw new QSocketProtocolDecodeError('Unknown compression format');
				}
				if (messageData.length !== uncompressedLength) {
					throw new QSocketProtocolDecodeError('Uncompressed data length mismatch after decompression');
				}
			} else {
				if (messageData.length !== uncompressedLength) {
					throw new QSocketProtocolDecodeError('Uncompressed data length mismatch');
				}
			}

			let messageOffset = 0;
			const message: IQSocketProtocolMessage = [];

			// Decode each chunk in the message
			while (messageOffset < messageData.length) {
				if (messageData.length - messageOffset < 4) {
					throw new QSocketProtocolDecodeError('Insufficient data for chunk length');
				}
				const chunkLength = this.readUInt32(messageData, messageOffset);
				messageOffset += 4;

				if (messageData.length - messageOffset < chunkLength) {
					throw new QSocketProtocolDecodeError('Insufficient data for chunk');
				}

				const chunkBuffer = messageData.subarray(messageOffset, messageOffset + chunkLength);
				messageOffset += chunkLength;

				const chunk = await this.decodeChunk(chunkBuffer);
				message.push(chunk);
			}

			if (messageOffset !== messageData.length) {
				throw new QSocketProtocolDecodeError('Extra data after message parsing');
			}

			return message;
		} catch (error) {
			return new QSocketProtocolDecodeError((error as Error).message);
		}
	}

	/**
	 * @description Encodes an individual message chunk, converting metadata and payload into `Buffer` or `Uint8Array` with optional compression.
	 *
	 * @param chunk - A protocol chunk with metadata and payload data.
	 * @returns A `Promise` resolving to the encoded chunk as `Buffer` or `Uint8Array`.
	 */
	private async encodeChunk(chunk: IQSocketProtocolChunk): Promise<Buffer | Uint8Array> {
		if (!chunk.meta || typeof chunk.meta !== 'object') {
			throw new Error('Invalid chunk meta');
		}
		// Encode metadata
		const metaString = JSON.stringify(chunk.meta);
		const metaBuffer = this.encodeString(metaString);
		const metaLengthBuffer = this.writeUInt32(metaBuffer.length);

		// Encode payload data
		const dataBuffer = await this.encodePayloadData(chunk.payload.data, chunk.payload['Content-Type']);

		// Apply content encoding if necessary
		let payloadBuffer: Buffer | Uint8Array = dataBuffer;
		if (chunk.payload['Content-Encoding'] === EQSocketProtocolContentEncoding.GZIP) {
			if (this.compressor) {
				payloadBuffer = await this.compressor.toGzip(dataBuffer);
			} else {
				throw new Error('Compressor not available for GZIP encoding');
			}
		} else if (chunk.payload['Content-Encoding'] === EQSocketProtocolContentEncoding.DEFLATE) {
			if (this.compressor) {
				payloadBuffer = await this.compressor.toDeflate(dataBuffer);
			} else {
				throw new Error('Compressor not available for DEFLATE encoding');
			}
		} else if (chunk.payload['Content-Encoding'] !== EQSocketProtocolContentEncoding.RAW) {
			throw new Error('Unknown Content-Encoding');
		}

		const payloadLengthBuffer = this.writeUInt32(payloadBuffer.length);

		const contentTypeByte = this.writeUInt8(chunk.payload['Content-Type']);
		const contentEncodingByte = this.writeUInt8(chunk.payload['Content-Encoding']);

		const buffers = [metaLengthBuffer, metaBuffer, payloadLengthBuffer, contentTypeByte, contentEncodingByte, payloadBuffer];
		const chunkBuffer = this.concatBuffers(buffers);

		return chunkBuffer;
	}

	/**
	 * @description Decodes a chunk from `Buffer` or `Uint8Array` format back into a protocol chunk, decompressing if necessary.
	 *
	 * @param chunkBuffer - Encoded chunk data.
	 * @returns A `Promise` resolving to a structured protocol chunk.
	 */
	private async decodeChunk(chunkBuffer: Buffer | Uint8Array): Promise<IQSocketProtocolChunk> {
		let offset = 0;

		if (chunkBuffer.length < 4) {
			throw new Error('Chunk buffer too small for meta length');
		}

		const metaLength = this.readUInt32(chunkBuffer, offset);
		offset += 4;

		if (chunkBuffer.length < offset + metaLength) {
			throw new Error('Chunk buffer too small for metadata');
		}

		const metaBuffer = chunkBuffer.subarray(offset, offset + metaLength);
		offset += metaLength;
		const metaString = this.decodeString(metaBuffer);
		const meta = JSON.parse(metaString);

		if (chunkBuffer.length < offset + 4) {
			throw new Error('Chunk buffer too small for payload length');
		}

		const payloadLength = this.readUInt32(chunkBuffer, offset);
		offset += 4;

		if (chunkBuffer.length < offset + 2) {
			throw new Error('Chunk buffer too small for content type and encoding');
		}

		const contentType = this.readUInt8(chunkBuffer, offset);
		offset += 1;

		const contentEncoding = this.readUInt8(chunkBuffer, offset);
		offset += 1;

		if (chunkBuffer.length < offset + payloadLength) {
			throw new Error('Chunk buffer too small for payload data');
		}

		const payloadBuffer = chunkBuffer.subarray(offset, offset + payloadLength);
		offset += payloadLength;

		// Apply content decoding if necessary
		let dataBuffer = payloadBuffer;
		if (contentEncoding === EQSocketProtocolContentEncoding.GZIP) {
			if (!this.compressor) {
				throw new Error('Compressor not available for decompression');
			}
			dataBuffer = await this.compressor.fromGzip(payloadBuffer);
		} else if (contentEncoding === EQSocketProtocolContentEncoding.DEFLATE) {
			if (!this.compressor) {
				throw new Error('Compressor not available for decompression');
			}
			dataBuffer = await this.compressor.fromDeflate(payloadBuffer);
		} else if (contentEncoding !== EQSocketProtocolContentEncoding.RAW) {
			throw new Error('Unknown Content-Encoding');
		}

		// Decode payload data
		const data = this.decodePayloadData(dataBuffer, contentType);

		const chunk: IQSocketProtocolChunk = {
			meta: meta,
			payload: {
				data: data,
				'Content-Type': contentType,
				'Content-Encoding': contentEncoding,
			},
		};

		return chunk;
	}

	/**
	 * @description Encodes payload data according to its specified content type, converting it into a `Buffer` or `Uint8Array`.
	 *
	 * @param data - The payload data to encode.
	 * @param contentType - Content type indicating the format of `data`.
	 * @returns A `Promise` resolving to the encoded data as `Buffer` or `Uint8Array`.
	 */
	private async encodePayloadData(data: TQSocketProtocolPayloadData, contentType: EQSocketProtocolContentType): Promise<Buffer | Uint8Array> {
		switch (contentType) {
			case EQSocketProtocolContentType.UNDEFINED:
				return new Uint8Array(0);
			case EQSocketProtocolContentType.NULL:
				return new Uint8Array(0);
			case EQSocketProtocolContentType.BOOLEAN:
				return this.writeUInt8(data ? 1 : 0);
			case EQSocketProtocolContentType.NUMBER:
				return this.writeDouble(data as number);
			case EQSocketProtocolContentType.STRING:
				return this.encodeString(data as string);
			case EQSocketProtocolContentType.JSON:
				return this.encodeString(JSON.stringify(data));
			case EQSocketProtocolContentType.BUFFER:
				return isBuffer(data) ? data : new Uint8Array(data as unknown as Uint8Array);
			default:
				throw new Error('Unknown content type');
		}
	}

	/**
	 * @description Decodes payload data from a `Buffer` or `Uint8Array` based on its specified content type.
	 *
	 * @param buffer - Encoded data buffer.
	 * @param contentType - Content type indicating the format of the buffer.
	 * @returns The decoded data in its original format.
	 */
	private decodePayloadData(buffer: Buffer | Uint8Array, contentType: EQSocketProtocolContentType): any {
		switch (contentType) {
			case EQSocketProtocolContentType.UNDEFINED:
				return undefined;
			case EQSocketProtocolContentType.NULL:
				return null;
			case EQSocketProtocolContentType.BOOLEAN:
				const value = this.readUInt8(buffer, 0);
				return value !== 0;
			case EQSocketProtocolContentType.NUMBER:
				return this.readDouble(buffer, 0);
			case EQSocketProtocolContentType.STRING:
				return this.decodeString(buffer);
			case EQSocketProtocolContentType.JSON:
				return JSON.parse(this.decodeString(buffer));
			case EQSocketProtocolContentType.BUFFER:
				return buffer;
			default:
				throw new Error('Unknown content type');
		}
	}

	/**
	 * @description Encodes a string into a UTF-8 `Buffer` or `Uint8Array`, depending on environment support.
	 *
	 * @param str - The string to encode.
	 * @returns Encoded UTF-8 representation as `Buffer` or `Uint8Array`.
	 */
	private encodeString(str: string): Buffer | Uint8Array {
		if (typeof TextEncoder !== 'undefined') {
			const encoder = new TextEncoder();
			return encoder.encode(str);
		} else if (hasBuffer) {
			return Buffer.from(str, 'utf8');
		} else {
			// Fallback for environments without TextEncoder or Buffer
			const utf8 = unescape(encodeURIComponent(str));
			const result = new Uint8Array(utf8.length);
			for (let i = 0; i < utf8.length; i++) {
				result[i] = utf8.charCodeAt(i);
			}
			return result;
		}
	}

	/**
	 * @description Decodes a UTF-8 encoded `Buffer` or `Uint8Array` back into a string.
	 *
	 * @param buffer - UTF-8 encoded buffer.
	 * @returns The decoded string.
	 */
	private decodeString(buffer: Buffer | Uint8Array): string {
		if (typeof TextDecoder !== 'undefined') {
			const decoder = new TextDecoder('utf8');
			return decoder.decode(buffer);
		} else if (hasBuffer && isBuffer(buffer)) {
			return buffer.toString('utf8');
		} else {
			// Fallback for environments without TextDecoder or Buffer
			let result = '';
			for (let i = 0; i < buffer.length; i++) {
				result += String.fromCharCode(buffer[i]);
			}
			return decodeURIComponent(escape(result));
		}
	}

	/**
	 * @description Encodes a 32-bit unsigned integer into a `Buffer` or `Uint8Array` in big-endian format.
	 *
	 * @param value - The integer to encode.
	 * @returns The encoded integer as `Buffer` or `Uint8Array`.
	 */
	private writeUInt32(value: number): Buffer | Uint8Array {
		if (hasBuffer) {
			const buffer = Buffer.alloc(4);
			buffer.writeUInt32BE(value, 0);
			return buffer;
		} else {
			const buffer = new Uint8Array(4);
			const view = new DataView(buffer.buffer);
			view.setUint32(0, value, false);
			return buffer;
		}
	}

	/**
	 * @description Reads a 32-bit unsigned integer from a `Buffer` or `Uint8Array` in big-endian format.
	 *
	 * @param buffer - The buffer containing the integer.
	 * @param offset - The offset position within the buffer to start reading.
	 * @returns The decoded integer.
	 */
	private readUInt32(buffer: Buffer | Uint8Array, offset: number): number {
		if (hasBuffer && isBuffer(buffer)) {
			return buffer.readUInt32BE(offset);
		} else {
			const view = new DataView(buffer.buffer, buffer.byteOffset + offset, 4);
			return view.getUint32(0, false);
		}
	}

	/**
	 * @description Writes an 8-bit unsigned integer into a `Buffer` or `Uint8Array`.
	 *
	 * @param value - The integer to write.
	 * @returns The encoded integer as `Buffer` or `Uint8Array`.
	 */
	private writeUInt8(value: number): Buffer | Uint8Array {
		const buffer = new Uint8Array(1);
		buffer[0] = value & 0xff;
		return buffer;
	}

	/**
	 * @description Reads an 8-bit unsigned integer from a `Buffer` or `Uint8Array`.
	 *
	 * @param buffer - The buffer containing the integer.
	 * @param offset - The offset position within the buffer to start reading.
	 * @returns The decoded integer.
	 */
	private readUInt8(buffer: Buffer | Uint8Array, offset: number): number {
		return buffer[offset];
	}

	/**
	 * @description Encodes a double-precision floating-point number into a `Buffer` or `Uint8Array`.
	 *
	 * @param value - The floating-point number to encode.
	 * @returns The encoded value as `Buffer` or `Uint8Array`.
	 */
	private writeDouble(value: number): Buffer | Uint8Array {
		if (hasBuffer) {
			const buffer = Buffer.alloc(8);
			buffer.writeDoubleBE(value, 0);
			return buffer;
		} else {
			const buffer = new Uint8Array(8);
			const view = new DataView(buffer.buffer);
			view.setFloat64(0, value, false);
			return buffer;
		}
	}

	/**
	 * @description Reads a double-precision floating-point number from a `Buffer` or `Uint8Array`.
	 *
	 * @param buffer - The buffer containing the double value.
	 * @param offset - The offset position within the buffer to start reading.
	 * @returns The decoded floating-point number.
	 */
	private readDouble(buffer: Buffer | Uint8Array, offset: number): number {
		if (hasBuffer && isBuffer(buffer)) {
			return buffer.readDoubleBE(offset);
		} else {
			const view = new DataView(buffer.buffer, buffer.byteOffset + offset, 8);
			return view.getFloat64(0, false);
		}
	}

	/**
	 * @description Concatenates multiple `Buffer` or `Uint8Array` instances into a single `Buffer` or `Uint8Array`.
	 *
	 * @param buffers - An array of buffers to concatenate.
	 * @returns A single concatenated `Buffer` or `Uint8Array`.
	 */
	private concatBuffers(buffers: (Buffer | Uint8Array)[]): Buffer | Uint8Array {
		if (hasBuffer) {
			return Buffer.concat(buffers.map((buf) => (isBuffer(buf) ? buf : Buffer.from(buf))));
		} else {
			let totalLength = buffers.reduce((sum, buf) => sum + buf.length, 0);
			const result = new Uint8Array(totalLength);
			let offset = 0;
			for (const buf of buffers) {
				result.set(buf, offset);
				offset += buf.length;
			}
			return result;
		}
	}
}
