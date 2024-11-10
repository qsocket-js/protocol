# @qsocket/protocol

![npm version](https://img.shields.io/npm/v/@qsocket/protocol) ![npm downloads](https://img.shields.io/npm/dm/@qsocket/protocol) ![GitHub license](https://img.shields.io/github/license/qsocket-js/protocol)

![Statements](https://github.com/qsocket-js/protocol/main/coverage/badge-statements.svg) ![Branches](./coverage/badge-branches.svg) ![Functions](./coverage/badge-functions.svg) ![Lines](./coverage/badge-lines.svg)

**@qsocket/protocol** — is a powerful protocol for data transmission in the [QSocket](https://www.npmjs.com/package/@qsocket) library, providing efficient interprocess communication with support for various data types and encoding/decoding formats. The package is specifically designed for QSocket and provides core classes and types for handling any message content in buffer format.

## Key Features

- **Message Types**: Supports various message types for data transmission, connection management, and delivery acknowledgment.
- **Content Types**: Supports multiple content formats, including JSON, Buffer, strings, and other data types.
- **Encoding Types**: Supports several content compression options, such as RAW, GZIP, and DEFLATE.
- **Performance Optimized**: The protocol is designed for low latency and efficient data transfer in buffer format.

## Installation

To install the `@qsocket/protocol` package, run the command:

```bash
npm install @qsocket/protocol
```

> Note: For full functionality, it is recommended to use this package within the `@qsocket/core` framework.

## Usage Example

An example of how to use @qsocket/protocol to define message types, content types, and encoding options in a NodeJS application based on QSocket:

```typescript
import {
	QSocketProtocol,
	EQSocketProtocolMessageType,
	EQSocketProtocolContentType,
	EQSocketProtocolContentEncoding,
	IQSocketProtocolChunk,
} from '@qsocket/protocol';
import { gzipSync, gunzipSync, deflateSync, inflateSync } from 'zlib';

// Simple compressor implementation for data compression
const compressor = {
	toGzip: async (data: Buffer | Uint8Array) => gzipSync(data),
	fromGzip: async (data: Buffer | Uint8Array) => gunzipSync(data),
	toDeflate: async (data: Buffer | Uint8Array) => deflateSync(data),
	fromDeflate: async (data: Buffer | Uint8Array) => inflateSync(data),
};

// Initialize QSocketProtocol with compressor
const protocol = new QSocketProtocol(compressor, 1024); // Maximum uncompressed size - 1KB

// Create a simple message
const messageChunk: IQSocketProtocolChunk = {
	meta: {
		type: EQSocketProtocolMessageType.DATA,
		uuid: 'example-uuid',
		namespace: 'example-namespace',
		event: 'example-event',
	},
	payload: {
		data: Buffer.from('Hello, QSocket!'),
		'Content-Type': EQSocketProtocolContentType.BUFFER,
		'Content-Encoding': EQSocketProtocolContentEncoding.RAW,
	},
};

async function processMessage() {
	// Encode the message
	const encodedMessage = await protocol.to([messageChunk]);
	if (encodedMessage instanceof Error) throw encodedMessage;

	// Decode the message
	const decodedMessage = await protocol.from(encodedMessage);
	if (decodedMessage instanceof Error) throw decodedMessage;

	console.log('Original message:', messageChunk);
	console.log('Decoded message:', decodedMessage);
}

// Call the function
processMessage().catch(console.error);
```

## License

This project is licensed under the MIT License.
