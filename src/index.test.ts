import { QSocketProtocol } from '.'; // Путь к вашему классу протокола
import { EQSocketProtocolContentEncoding, EQSocketProtocolContentType, EQSocketProtocolMessageType } from '.';
import { IQSocketProtocolChunk, IQSocketProtocolMessage, TQSocketProtocolCompressor, TQSocketProtocolPayloadData } from '.';

// Простой компрессор для тестирования
const compressor: TQSocketProtocolCompressor = {
	toGzip: async (data: Buffer | Uint8Array) => {
		const zlib = require('zlib');
		return zlib.gzipSync(data);
	},
	fromGzip: async (data: Buffer | Uint8Array) => {
		const zlib = require('zlib');
		return zlib.gunzipSync(data);
	},
	toDeflate: async (data: Buffer | Uint8Array) => {
		const zlib = require('zlib');
		return zlib.deflateSync(data);
	},
	fromDeflate: async (data: Buffer | Uint8Array) => {
		const zlib = require('zlib');
		return zlib.inflateSync(data);
	},
};

// Константа с числом тестов
const NUM_TESTS = 100000;

// Функция генерации случайных данных
function generateRandomData(): TQSocketProtocolPayloadData {
	const types = [
		EQSocketProtocolContentType.UNDEFINED,
		EQSocketProtocolContentType.NULL,
		EQSocketProtocolContentType.BOOLEAN,
		EQSocketProtocolContentType.NUMBER,
		EQSocketProtocolContentType.CHAR,
		EQSocketProtocolContentType.STRING,
		EQSocketProtocolContentType.JSON,
		EQSocketProtocolContentType.BUFFER,
	];
	const randomType = types[Math.floor(Math.random() * types.length)];

	switch (randomType) {
		case EQSocketProtocolContentType.UNDEFINED:
			return undefined;
		case EQSocketProtocolContentType.NULL:
			return null;
		case EQSocketProtocolContentType.BOOLEAN:
			return Math.random() >= 0.5;
		case EQSocketProtocolContentType.NUMBER:
			return Math.random() * 10000 - 5000;
		case EQSocketProtocolContentType.CHAR:
			return String.fromCharCode(Math.floor(Math.random() * 26) + 97);
		case EQSocketProtocolContentType.STRING:
			return Math.random().toString(36).substring(2);
		case EQSocketProtocolContentType.JSON:
			return {
				key: Math.random().toString(36).substring(2),
				value: Math.random() * 1000,
				flag: Math.random() >= 0.5,
				nested: { a: 1, b: [1, 2, 3] },
			};
		case EQSocketProtocolContentType.BUFFER:
			const length = Math.floor(Math.random() * 1024);
			const buffer = Buffer.alloc(length);
			for (let i = 0; i < length; i++) {
				buffer[i] = Math.floor(Math.random() * 256);
			}
			return buffer;
		default:
			return null;
	}
}

// Функция генерации случайного чанка
function generateRandomChunk(): IQSocketProtocolChunk {
	const data = generateRandomData();
	let contentType: EQSocketProtocolContentType;

	if (data === undefined) {
		contentType = EQSocketProtocolContentType.UNDEFINED;
	} else if (data === null) {
		contentType = EQSocketProtocolContentType.NULL;
	} else if (typeof data === 'boolean') {
		contentType = EQSocketProtocolContentType.BOOLEAN;
	} else if (typeof data === 'number') {
		contentType = EQSocketProtocolContentType.NUMBER;
	} else if (typeof data === 'string') {
		contentType = EQSocketProtocolContentType.STRING;
	} else if (typeof data === 'object' && Buffer.isBuffer(data)) {
		contentType = EQSocketProtocolContentType.BUFFER;
	} else if (typeof data === 'object') {
		contentType = EQSocketProtocolContentType.JSON;
	} else {
		contentType = EQSocketProtocolContentType.STRING;
	}

	const contentEncoding = Math.random() >= 0.5 ? EQSocketProtocolContentEncoding.RAW : EQSocketProtocolContentEncoding.GZIP;

	const messageType = [EQSocketProtocolMessageType.DATA, EQSocketProtocolMessageType.CONTROL, EQSocketProtocolMessageType.ACK][Math.floor(Math.random() * 3)];

	const chunk: IQSocketProtocolChunk = {
		meta: {
			type: messageType,
			uuid: Math.random().toString(36).substring(2),
			...(messageType === EQSocketProtocolMessageType.DATA && {
				namespace: 'namespace_' + Math.random().toString(36).substring(2),
				event: 'event_' + Math.random().toString(36).substring(2),
			}),
			...(messageType === EQSocketProtocolMessageType.CONTROL && {
				namespace: 'namespace_' + Math.random().toString(36).substring(2),
			}),
		},
		payload: {
			data,
			'Content-Type': contentType,
			'Content-Encoding': contentEncoding,
		},
	};

	return chunk;
}
// Функция для рекурсивного глубокого сравнения двух объектов с логированием различий
function deepCompare(expected: any, actual: any, path: string = '') {
	if (expected === actual) return;

	if (typeof expected !== 'object' || expected === null || typeof actual !== 'object' || actual === null) {
		console.error(`Difference at ${path || 'root'}: Expected "${expected}", but got "${actual}"`);
		throw new Error(`Values at path "${path}" do not match.`);
	}

	if (Array.isArray(expected) && Array.isArray(actual)) {
		if (expected.length !== actual.length) {
			console.error(`Array length mismatch at ${path}: Expected length ${expected.length}, but got ${actual.length}`);
			throw new Error(`Array length mismatch at path "${path}"`);
		}
		expected.forEach((item, index) => deepCompare(item, actual[index], `${path}[${index}]`));
	} else {
		const keys = new Set([...Object.keys(expected), ...Object.keys(actual)]);
		keys.forEach((key) => {
			if (!(key in expected)) {
				console.error(`Extra key "${key}" found in actual at ${path}`);
				throw new Error(`Extra key "${key}" found in actual object at path "${path}"`);
			}
			if (!(key in actual)) {
				console.error(`Missing key "${key}" in actual at ${path}`);
				throw new Error(`Missing key "${key}" in actual object at path "${path}"`);
			}
			deepCompare(expected[key], actual[key], `${path}.${key}`);
		});
	}
}

describe('QSocketProtocol', () => {
	const protocol = new QSocketProtocol(compressor, 1024); // Максимальный размер без сжатия 1KB

	it('should encode and decode messages correctly', async () => {
		for (let i = 0; i < NUM_TESTS; i++) {
			const numChunks = Math.floor(Math.random() * 5) + 1;
			const message: IQSocketProtocolMessage = [];
			for (let j = 0; j < numChunks; j++) {
				const chunk = generateRandomChunk();
				message.push(chunk);
			}
			const encoded = await protocol.to(message);
			if (encoded instanceof Error) {
				throw encoded;
			}
			const decoded = await protocol.from(encoded);
			if (decoded instanceof Error) {
				throw decoded;
			}
			deepCompare(message, decoded);
		}
	});
});
