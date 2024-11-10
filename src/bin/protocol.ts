import { EQSocketProtocolContentEncoding, EQSocketProtocolContentType } from './protocol.enums';

import { IQSocketProtocolChunk, IQSocketProtocolMessage, TQSocketProtocolCompressor, TQSocketProtocolPayloadData } from './protocol.types';

class QSocketProtocolEncodeError extends Error {}
class QSocketProtocolDecodeError extends Error {}

// Check if Buffer is available (Node.js environment)
const hasBuffer = typeof Buffer !== 'undefined' && typeof Buffer.isBuffer === 'function';

// Helper function to determine if an object is a Buffer
function isBuffer(obj: any): obj is Buffer {
	return hasBuffer && Buffer.isBuffer(obj);
}

export default class QSocketProtocol {
	private compressor?: TQSocketProtocolCompressor;
	private maxUncompressedSize: number;

	constructor(
		compressor?: TQSocketProtocolCompressor,
		maxUncompressedSize: number = 10 * 1024 // Default 10 KB
	) {
		this.compressor = compressor;
		this.maxUncompressedSize = maxUncompressedSize;
	}

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

			// Verify lengths
			if (uncompressedLength !== messageData.length) {
				throw new Error('Uncompressed data length mismatch');
			}
			if (compressedLength !== compressedMessageData.length) {
				throw new Error('Compressed data length mismatch');
			}

			return finalMessageBuffer;
		} catch (error) {
			return new QSocketProtocolEncodeError((error as Error).message);
		}
	}

	public async from(buffer: Buffer | Uint8Array): Promise<IQSocketProtocolMessage | QSocketProtocolDecodeError> {
		try {
			let offset = 0;

			if (buffer.length < 10) {
				throw new Error('Buffer too small to contain header');
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
				throw new Error('Buffer too small for compressed data');
			}

			const compressedMessageData = buffer.subarray(offset, offset + compressedLength);
			offset += compressedLength;

			if (compressedMessageData.length !== compressedLength) {
				throw new Error('Compressed data length mismatch');
			}

			let messageData: Buffer | Uint8Array = compressedMessageData;

			// Decompress if necessary
			if (compressionFlag === 1) {
				if (!this.compressor) {
					throw new Error('Compressor not available for decompression');
				}
				if (compressionFormat === EQSocketProtocolContentEncoding.GZIP) {
					messageData = await this.compressor.fromGzip(compressedMessageData);
				} else if (compressionFormat === EQSocketProtocolContentEncoding.DEFLATE) {
					messageData = await this.compressor.fromDeflate(compressedMessageData);
				} else {
					throw new Error('Unknown compression format');
				}
				if (messageData.length !== uncompressedLength) {
					throw new Error('Uncompressed data length mismatch after decompression');
				}
			} else {
				if (messageData.length !== uncompressedLength) {
					throw new Error('Uncompressed data length mismatch');
				}
			}

			let messageOffset = 0;
			const message: IQSocketProtocolMessage = [];

			// Decode each chunk in the message
			while (messageOffset < messageData.length) {
				if (messageData.length - messageOffset < 4) {
					throw new Error('Insufficient data for chunk length');
				}
				const chunkLength = this.readUInt32(messageData, messageOffset);
				messageOffset += 4;

				if (messageData.length - messageOffset < chunkLength) {
					throw new Error('Insufficient data for chunk');
				}

				const chunkBuffer = messageData.subarray(messageOffset, messageOffset + chunkLength);
				messageOffset += chunkLength;

				const chunk = await this.decodeChunk(chunkBuffer);
				message.push(chunk);
			}

			if (messageOffset !== messageData.length) {
				throw new Error('Extra data after message parsing');
			}

			return message;
		} catch (error) {
			return new QSocketProtocolDecodeError((error as Error).message);
		}
	}

	private async encodeChunk(chunk: IQSocketProtocolChunk): Promise<Buffer | Uint8Array> {
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
		}

		const payloadLengthBuffer = this.writeUInt32(payloadBuffer.length);

		const contentTypeByte = this.writeUInt8(chunk.payload['Content-Type']);
		const contentEncodingByte = this.writeUInt8(chunk.payload['Content-Encoding']);

		const buffers = [metaLengthBuffer, metaBuffer, payloadLengthBuffer, contentTypeByte, contentEncodingByte, payloadBuffer];
		const chunkBuffer = this.concatBuffers(buffers);

		return chunkBuffer;
	}

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
			case EQSocketProtocolContentType.CHAR:
				return this.encodeString((data as string).charAt(0));
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
			case EQSocketProtocolContentType.CHAR:
				return this.decodeString(buffer.subarray(0, 1));
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

	private readUInt32(buffer: Buffer | Uint8Array, offset: number): number {
		if (hasBuffer && isBuffer(buffer)) {
			return buffer.readUInt32BE(offset);
		} else {
			const view = new DataView(buffer.buffer, buffer.byteOffset + offset, 4);
			return view.getUint32(0, false);
		}
	}

	private writeUInt8(value: number): Buffer | Uint8Array {
		const buffer = new Uint8Array(1);
		buffer[0] = value & 0xff;
		return buffer;
	}

	private readUInt8(buffer: Buffer | Uint8Array, offset: number): number {
		return buffer[offset];
	}

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

	private readDouble(buffer: Buffer | Uint8Array, offset: number): number {
		if (hasBuffer && isBuffer(buffer)) {
			return buffer.readDoubleBE(offset);
		} else {
			const view = new DataView(buffer.buffer, buffer.byteOffset + offset, 8);
			return view.getFloat64(0, false);
		}
	}

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
