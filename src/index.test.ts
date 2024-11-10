import { QSocketProtocol } from '.';
import { EQSocketProtocolContentEncoding, EQSocketProtocolContentType, EQSocketProtocolMessageType } from '.';
import { IQSocketProtocolChunk, IQSocketProtocolMessage, TQSocketProtocolCompressor, TQSocketProtocolPayloadData } from '.';
import { QSocketProtocolEncodeError, QSocketProtocolDecodeError } from '.';
import { gzipSync, gunzipSync, deflateSync, inflateSync } from 'zlib';

const compressor: TQSocketProtocolCompressor = {
	toGzip: async (data) => gzipSync(data),
	fromGzip: async (data) => gunzipSync(data),
	toDeflate: async (data) => deflateSync(data),
	fromDeflate: async (data) => inflateSync(data),
};

const NUM_TESTS = 10;

function generateRandomPayloadData(contentType: EQSocketProtocolContentType): TQSocketProtocolPayloadData {
	switch (contentType) {
		case EQSocketProtocolContentType.UNDEFINED:
			return undefined;
		case EQSocketProtocolContentType.NULL:
			return null;
		case EQSocketProtocolContentType.BOOLEAN:
			return Math.random() < 0.5;
		case EQSocketProtocolContentType.NUMBER:
			return Math.random() * 1000;
		case EQSocketProtocolContentType.STRING:
			return Math.random().toString(36).substring(2);
		case EQSocketProtocolContentType.JSON:
			return {
				key: Math.random().toString(36).substring(2),
				value: Math.random(),
				nested: {
					array: [1, 2, 3],
					object: { a: 1, b: 2 },
				},
			};
		case EQSocketProtocolContentType.BUFFER:
			const length = Math.floor(Math.random() * 1024);
			const buffer = Buffer.alloc(length);
			for (let i = 0; i < length; i++) {
				buffer[i] = Math.floor(Math.random() * 256);
			}
			return buffer;
		default:
			throw new Error('Unsupported content type');
	}
}

function generateValidChunk(): IQSocketProtocolChunk {
	const contentTypes = [
		EQSocketProtocolContentType.UNDEFINED,
		EQSocketProtocolContentType.NULL,
		EQSocketProtocolContentType.BOOLEAN,
		EQSocketProtocolContentType.NUMBER,
		EQSocketProtocolContentType.STRING,
		EQSocketProtocolContentType.JSON,
		EQSocketProtocolContentType.BUFFER,
	];
	const contentType = contentTypes[Math.floor(Math.random() * contentTypes.length)] as EQSocketProtocolContentType;
	const data = generateRandomPayloadData(contentType);

	const contentEncodings = [EQSocketProtocolContentEncoding.RAW, EQSocketProtocolContentEncoding.GZIP, EQSocketProtocolContentEncoding.DEFLATE];
	const contentEncoding = contentEncodings[Math.floor(Math.random() * contentEncodings.length)] as EQSocketProtocolContentEncoding;

	return {
		meta: {
			type: EQSocketProtocolMessageType.DATA,
			uuid: generateUUID(),
			namespace: 'namespace_' + Math.random().toString(36).substring(2),
			event: 'event_' + Math.random().toString(36).substring(2),
		},
		payload: {
			data,
			'Content-Type': contentType,
			'Content-Encoding': contentEncoding,
		},
	};
}

function generateValidMessage(): IQSocketProtocolMessage {
	const numChunks = Math.floor(Math.random() * 5) + 1;
	const message: IQSocketProtocolMessage = [];
	for (let i = 0; i < numChunks; i++) {
		message.push(generateValidChunk());
	}
	return message;
}

function generateInvalidMessage(): IQSocketProtocolMessage {
	const chunk: any = {
		meta: {
			type: EQSocketProtocolMessageType.DATA,
			uuid: generateUUID(),
			namespace: 5,
			event: 5,
		},
		payload: {
			data: 'invalid data',
			'Content-Type': 999, // Invalid content type
			'Content-Encoding': EQSocketProtocolContentEncoding.RAW,
		},
	};
	return [chunk];
}

function generateUUID(): string {
	return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
		const r = (Math.random() * 16) | 0,
			v = c === 'x' ? r : (r & 0x3) | 0x8;
		return v.toString(16);
	});
}

function deepCompare(expected: any, actual: any): void {
	expect(actual).toEqual(expected);
}

describe('QSocketProtocol', () => {
	const protocol = new QSocketProtocol(compressor, 1024);

	describe('Encoding and Decoding Valid Messages', () => {
		it('should correctly encode and decode all content types', async () => {
			const message = generateValidMessage();
			const encoded = await protocol.to(message);
			expect(encoded).toBeInstanceOf(Buffer);

			const decoded = await protocol.from(encoded as Buffer);
			expect(decoded).not.toBeInstanceOf(Error);

			deepCompare(message, decoded);
		});

		it('should correctly encode and decode random valid messages', async () => {
			for (let i = 0; i < NUM_TESTS; i++) {
				const message = generateValidMessage();
				const encoded = await protocol.to(message);
				expect(encoded).toBeInstanceOf(Buffer);

				const decoded = await protocol.from(encoded as Buffer);
				expect(decoded).not.toBeInstanceOf(Error);

				deepCompare(message, decoded);
			}
		});
	});

	describe('Error Handling in "to" Method', () => {
		it('should return EncodeError when compressor is missing but required', async () => {
			const largeData = Buffer.alloc(2048, 0);
			const chunk: IQSocketProtocolChunk = {
				meta: {
					type: EQSocketProtocolMessageType.DATA,
					uuid: generateUUID(),
					namespace: 'namespace_large',
					event: 'event_large',
				},
				payload: {
					data: largeData,
					'Content-Type': EQSocketProtocolContentType.BUFFER,
					'Content-Encoding': EQSocketProtocolContentEncoding.GZIP,
				},
			};
			const message: IQSocketProtocolMessage = [chunk];
			const protocolWithoutCompressor = new QSocketProtocol(undefined, 1024);
			const result = await protocolWithoutCompressor.to(message);
			expect(result).toBeInstanceOf(QSocketProtocolEncodeError);
		});

		it('should return EncodeError for unknown content type', async () => {
			const message = generateInvalidMessage();
			const result = await protocol.to(message);
			expect(result).toBeInstanceOf(QSocketProtocolEncodeError);
		});
	});

	describe('Error Handling in "from" Method', () => {
		it('should return DecodeError when compressed data is invalid', async () => {
			// Create an invalid buffer
			const invalidBuffer = Buffer.alloc(10);
			invalidBuffer.fill(0xff);

			const result = await protocol.from(invalidBuffer);
			expect(result).toBeInstanceOf(QSocketProtocolDecodeError);
		});

		it('should return DecodeError for unknown content type during decoding', async () => {
			const message = generateValidMessage();
			const encoded = await protocol.to(message);
			expect(encoded).toBeInstanceOf(Buffer);

			// Modify content type to an invalid value
			const buffer = Buffer.from(encoded as Buffer);

			let offset = 0;
			offset += 1; // Compression flag
			offset += 1; // Compression format
			offset += 4; // Uncompressed length
			offset += 4; // Compressed length

			// Now at the start of message data
			// Skip chunk length
			offset += 4;

			// Read meta length
			const metaLength = buffer.readUInt32BE(offset);
			offset += 4 + metaLength;

			// Skip payload length
			offset += 4;

			// Modify content type to an invalid value
			buffer[offset] = 999;

			const result = await protocol.from(buffer);
			expect(result).toBeInstanceOf(QSocketProtocolDecodeError);
		});

		it('should return DecodeError for unknown compression format', async () => {
			const message = generateValidMessage();
			const encoded = await protocol.to(message);
			expect(encoded).toBeInstanceOf(Buffer);

			// Modify compression flag and format to invalid values
			const buffer = Buffer.from(encoded as Buffer);
			buffer[0] = 1; // Set compression flag to 1
			buffer[1] = 0xff; // Invalid compression format

			const result = await protocol.from(buffer);
			expect(result).toBeInstanceOf(QSocketProtocolDecodeError);
		});

		// New test cases for buffer too small to contain header and compressed data length mismatch
		it('should return DecodeError when buffer is too small to contain header', async () => {
			const smallBuffer = Buffer.alloc(9);
			const result = await protocol.from(smallBuffer);
			expect(result).toBeInstanceOf(QSocketProtocolDecodeError);
			expect((result as QSocketProtocolDecodeError).message).toContain('Buffer too small to contain header');
		});

		it('should return DecodeError when compressor is missing but required for decompression', async () => {
			const message = generateValidMessage();
			const protocolWithCompressor = new QSocketProtocol(compressor, 0); // Force compression
			const encoded = await protocolWithCompressor.to(message);
			expect(encoded).toBeInstanceOf(Buffer);

			const protocolWithoutCompressor = new QSocketProtocol(undefined, 0); // No compressor
			const result = await protocolWithoutCompressor.from(encoded as Buffer);
			expect(result).toBeInstanceOf(QSocketProtocolDecodeError);
			expect((result as QSocketProtocolDecodeError).message).toContain('Compressor not available for decompression');
		});
	});

	describe('Compression Edge Cases', () => {
		it('should not compress data when size is below threshold', async () => {
			const smallData = Buffer.alloc(512, 0);
			const chunk: IQSocketProtocolChunk = {
				meta: {
					type: EQSocketProtocolMessageType.DATA,
					uuid: generateUUID(),
					namespace: 'namespace_small',
					event: 'event_small',
				},
				payload: {
					data: smallData,
					'Content-Type': EQSocketProtocolContentType.BUFFER,
					'Content-Encoding': EQSocketProtocolContentEncoding.RAW,
				},
			};
			const message: IQSocketProtocolMessage = [chunk];
			const encoded = await protocol.to(message);
			expect(encoded).toBeInstanceOf(Buffer);

			// Check that compression flag is zero
			const compressionFlag = encoded[0];
			expect(compressionFlag).toBe(0);

			const decoded = await protocol.from(encoded as Buffer);
			expect(decoded).not.toBeInstanceOf(Error);

			deepCompare(message, decoded);
		});

		it('should compress data when size exceeds threshold', async () => {
			const largeData = Buffer.alloc(2048, 0);
			const chunk: IQSocketProtocolChunk = {
				meta: {
					type: EQSocketProtocolMessageType.DATA,
					uuid: generateUUID(),
					namespace: 'namespace_large',
					event: 'event_large',
				},
				payload: {
					data: largeData,
					'Content-Type': EQSocketProtocolContentType.BUFFER,
					'Content-Encoding': EQSocketProtocolContentEncoding.RAW,
				},
			};
			const message: IQSocketProtocolMessage = [chunk];
			const encoded = await protocol.to(message);
			expect(encoded).toBeInstanceOf(Buffer);

			// Check that compression flag is one
			const compressionFlag = encoded[0];
			expect(compressionFlag).toBe(1);

			const decoded = await protocol.from(encoded as Buffer);
			expect(decoded).not.toBeInstanceOf(Error);

			deepCompare(message, decoded);
		});

		it('should correctly encode and decode messages compressed with DEFLATE', async () => {
			// Создаем протокол с компрессором, который использует DEFLATE
			const protocolWithDeflate = new QSocketProtocol(
				{
					toGzip: compressor.toDeflate, // Используем toDeflate для сжатия
					fromGzip: compressor.fromDeflate, // Используем fromDeflate для распаковки
					toDeflate: compressor.toDeflate,
					fromDeflate: compressor.fromDeflate,
				},
				0
			); // Устанавливаем порог сжатия в 0, чтобы всегда сжимать

			const chunk: IQSocketProtocolChunk = {
				meta: {
					type: EQSocketProtocolMessageType.DATA,
					uuid: generateUUID(),
					namespace: 'namespace_deflate',
					event: 'event_deflate',
				},
				payload: {
					data: 'test data for DEFLATE compression',
					'Content-Type': EQSocketProtocolContentType.STRING,
					'Content-Encoding': EQSocketProtocolContentEncoding.RAW,
				},
			};
			const message: IQSocketProtocolMessage = [chunk];

			const encoded = await protocolWithDeflate.to(message);
			expect(encoded).toBeInstanceOf(Buffer);

			// Устанавливаем формат сжатия в DEFLATE в заголовке
			encoded[1] = EQSocketProtocolContentEncoding.DEFLATE;

			const decoded = await protocolWithDeflate.from(encoded as Buffer);
			expect(decoded).not.toBeInstanceOf(Error);

			deepCompare(message, decoded);
		});
	});

	describe('Private Method Error Handling', () => {
		it('should handle errors in encodePayloadData', async () => {
			const protocolInstance: any = protocol;
			await expect(
				protocolInstance.encodePayloadData('test', 999) // Invalid content type
			).rejects.toThrow('Unknown content type');
		});

		it('should handle errors in decodePayloadData', () => {
			const protocolInstance: any = protocol;
			expect(() => {
				protocolInstance.decodePayloadData(Buffer.from('test'), 999); // Invalid content type
			}).toThrow('Unknown content type');
		});

		it('should handle errors in encodeChunk', async () => {
			const protocolInstance: any = protocol;
			const invalidChunk = {
				meta: undefined, // meta is undefined
				payload: {
					data: 'test',
					'Content-Type': EQSocketProtocolContentType.STRING,
					'Content-Encoding': EQSocketProtocolContentEncoding.RAW,
				},
			};
			await expect(protocolInstance.encodeChunk(invalidChunk)).rejects.toThrow('Invalid chunk meta');
		});

		it('should handle errors in decodeChunk', async () => {
			const protocolInstance: any = protocol;
			const invalidBuffer = Buffer.from([0x00, 0x01]); // Not enough data
			await expect(protocolInstance.decodeChunk(invalidBuffer)).rejects.toThrow('Chunk buffer too small for meta length');
		});

		it('should handle missing compressor in encodeChunk for GZIP', async () => {
			const protocolInstance: any = new QSocketProtocol(undefined, 1024);
			const chunk: IQSocketProtocolChunk = {
				meta: {
					type: EQSocketProtocolMessageType.DATA,
					uuid: generateUUID(),
					namespace: 'namespace_test',
					event: 'event_test',
				},
				payload: {
					data: 'test data',
					'Content-Type': EQSocketProtocolContentType.STRING,
					'Content-Encoding': EQSocketProtocolContentEncoding.GZIP,
				},
			};
			await expect(protocolInstance.encodeChunk(chunk)).rejects.toThrow('Compressor not available for GZIP encoding');
		});

		it('should handle missing compressor in encodeChunk for DEFLATE', async () => {
			const protocolInstance: any = new QSocketProtocol(undefined, 1024);
			const chunk: IQSocketProtocolChunk = {
				meta: {
					type: EQSocketProtocolMessageType.DATA,
					uuid: generateUUID(),
					namespace: 'namespace_test',
					event: 'event_test',
				},
				payload: {
					data: 'test data',
					'Content-Type': EQSocketProtocolContentType.STRING,
					'Content-Encoding': EQSocketProtocolContentEncoding.DEFLATE,
				},
			};
			await expect(protocolInstance.encodeChunk(chunk)).rejects.toThrow('Compressor not available for DEFLATE encoding');
		});

		it('should handle unknown Content-Encoding in encodeChunk', async () => {
			const protocolInstance: any = protocol;
			const chunk: any = {
				meta: {
					type: EQSocketProtocolMessageType.DATA,
					uuid: generateUUID(),
					namespace: 'namespace_test',
					event: 'event_test',
				},
				payload: {
					data: 'test data',
					'Content-Type': EQSocketProtocolContentType.STRING,
					'Content-Encoding': 999, // Invalid Content-Encoding
				},
			};
			await expect(protocolInstance.encodeChunk(chunk)).rejects.toThrow('Unknown Content-Encoding');
		});

		it('should throw error in decodeChunk when compressor is missing but required', async () => {
			const protocolWithoutCompressor = new QSocketProtocol(undefined, 1024);

			const chunk: IQSocketProtocolChunk = {
				meta: {
					type: EQSocketProtocolMessageType.DATA,
					uuid: generateUUID(),
					namespace: 'namespace_test',
					event: 'event_test',
				},
				payload: {
					data: 'test data',
					'Content-Type': EQSocketProtocolContentType.STRING,
					'Content-Encoding': EQSocketProtocolContentEncoding.GZIP,
				},
			};

			const encodedChunk = await protocol.to([chunk]);
			expect(encodedChunk).toBeInstanceOf(Buffer);

			// Extract the chunk buffer
			const buffer = Buffer.from(encodedChunk as Buffer);
			let offset = 0;
			offset += 1 + 1 + 4 + 4; // Skip header

			// Read chunk length
			const chunkLength = buffer.readUInt32BE(offset);
			offset += 4;
			const chunkBuffer = buffer.slice(offset, offset + chunkLength);

			// Attempt to decode the chunk without a compressor
			const protocolInstance: any = protocolWithoutCompressor;
			await expect(protocolInstance.decodeChunk(chunkBuffer)).rejects.toThrow('Compressor not available for decompression');
		});

		it('should throw error in decodeChunk for unknown Content-Encoding', async () => {
			const message = generateValidMessage();
			const encoded = await protocol.to(message);
			expect(encoded).toBeInstanceOf(Buffer);

			const buffer = Buffer.from(encoded as Buffer);

			let offset = 0;
			offset += 1 + 1 + 4 + 4; // Skip header
			offset += 4; // Chunk length
			const metaLength = buffer.readUInt32BE(offset);
			offset += 4 + metaLength; // Skip meta

			offset += 4; // Payload length

			// Set invalid Content-Encoding
			buffer[offset + 1] = 0xff; // Invalid Content-Encoding
			const result = await protocol.from(buffer);
			expect(result).toBeInstanceOf(QSocketProtocolDecodeError);
			expect((result as QSocketProtocolDecodeError).message).toContain('Unknown Content-Encoding');
		});
	});
});

describe('QSocketProtocol Errors', () => {
	it('should create QSocketProtocolEncodeError with original error', () => {
		const originalError = new Error('Original error');
		const error = new QSocketProtocolEncodeError('Encode error occurred', originalError);
		expect(error).toBeInstanceOf(Error);
		expect(error.name).toBe('QSocketProtocolEncodeError');
		expect(error.message).toBe('Encode error occurred');
		expect(error.stack).toContain('Encode error occurred');
		expect(error.stack).toContain('Caused by:');
		expect(error.stack).toContain('Original error');
	});

	it('should create QSocketProtocolEncodeError without original error', () => {
		const error = new QSocketProtocolEncodeError('Encode error occurred');
		expect(error).toBeInstanceOf(Error);
		expect(error.name).toBe('QSocketProtocolEncodeError');
		expect(error.message).toBe('Encode error occurred');
		expect(error.stack).toContain('Encode error occurred');
		expect(error.stack).not.toContain('Caused by:');
	});

	it('should create QSocketProtocolDecodeError with original error', () => {
		const originalError = new Error('Original error');
		const error = new QSocketProtocolDecodeError('Decode error occurred', originalError);
		expect(error).toBeInstanceOf(Error);
		expect(error.name).toBe('QSocketProtocolDecodeError');
		expect(error.message).toBe('Decode error occurred');
		expect(error.stack).toContain('Decode error occurred');
		expect(error.stack).toContain('Caused by:');
		expect(error.stack).toContain('Original error');
	});

	it('should create QSocketProtocolDecodeError without original error', () => {
		const error = new QSocketProtocolDecodeError('Decode error occurred');
		expect(error).toBeInstanceOf(Error);
		expect(error.name).toBe('QSocketProtocolDecodeError');
		expect(error.message).toBe('Decode error occurred');
		expect(error.stack).toContain('Decode error occurred');
		expect(error.stack).not.toContain('Caused by:');
	});
});
