# @qsocket/protocol

![npm version](https://img.shields.io/npm/v/@qsocket/protocol) ![npm downloads](https://img.shields.io/npm/dm/@qsocket/protocol) ![GitHub license](https://img.shields.io/github/license/qsocket-js/protocol)

**@qsocket/protocol** is a robust protocol for data transmission within the [QSocket](https://www.npmjs.com/package/@qsocket) library, enabling efficient interprocess communication with support for various data types and encoding/decoding formats. This package is specifically tailored for QSocket and provides essential classes and types for handling any message content in buffer format.

## Key Features

- **Message Types**: Supports various message types for data transmission, connection management, and delivery acknowledgment.
- **Content Types**: Supports multiple content formats, including JSON, Buffer, strings, and other data types.
- **Performance Optimized**: The protocol is designed for low latency and efficient data transfer in buffer format.

## Installation

To install the `@qsocket/protocol` package, run the command:

```bash
npm install @qsocket/protocol
```

> Note: For full functionality, it is recommended to use this package within the `@qsocket/core` framework.

## Usage Example

An example of how to use `@qsocket/protocol` to define message types and content types in a Node.js application based on QSocket:

```typescript
import { QSocketProtocol, EQSocketProtocolMessageType, EQSocketProtocolContentType, IQSocketProtocolChunk } from '@qsocket/protocol';

// Initialize QSocketProtocol
const protocol = new QSocketProtocol();

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
	},
};

function processMessage() {
	// Encode the message
	const encodedMessage = protocol.to([messageChunk]);
	if (encodedMessage instanceof Error) throw encodedMessage;

	// Decode the message
	const decodedMessage = protocol.from(encodedMessage);
	if (decodedMessage instanceof Error) throw decodedMessage;

	console.log('Original message:', messageChunk);
	console.log('Decoded message:', decodedMessage);
}

// Call the function
processMessage().catch(console.error);
```

## License

This project is licensed under the MIT License.
