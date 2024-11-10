# @qsocket/transport

![npm version](https://img.shields.io/npm/v/@qsocket/transport)
![npm downloads](https://img.shields.io/npm/dm/@qsocket/transport)
![GitHub license](https://img.shields.io/github/license/qsocket/qsocket)

**@qsocket/transport** is a unified package that bundles multiple transport modules for the [qsocket](https://www.npmjs.com/package/@qsocket) library, providing compatibility with different versions of `engine.io` and `engine.io-client`. This package allows you to easily access all supported qsocket transports in one place, enabling seamless integration and compatibility across various environments.

## Included Transports

The `@qsocket/transport` package includes the following transport modules:

- **[@qsocket/transport-engine.io-latest](https://www.npmjs.com/package/@qsocket/transport-engine.io-latest)**: The latest version of the `engine.io` transport for server-side connections.
- **[@qsocket/transport-engine.io-v3](https://www.npmjs.com/package/@qsocket/transport-engine.io-v3)**: Version 3 of the `engine.io` transport for compatibility with legacy environments.
- **[@qsocket/transport-engine.io-client-latest](https://www.npmjs.com/package/@qsocket/transport-engine.io-client-latest)**: The latest version of `engine.io-client` for client-side connections.
- **[@qsocket/transport-engine.io-client-v3](https://www.npmjs.com/package/@qsocket/transport-engine.io-client-v3)**: Version 3 of `engine.io-client`, ensuring backward compatibility.

## Installation

To install the `@qsocket/transport` package, run:

```bash
npm install @qsocket/transport
```

> **Note**: It is recommended to use this library in conjunction with `@qsocket/core` for full functionality, or in cases where your project requires multiple versions of the same transport library.

## Usage

Here’s how you can import and use the various transports provided by `@qsocket/transport`:

```typescript
import {
	QSocketTransportEIOLatestServer,
	QSocketTransportEIOV3Server,
	QSocketTransportEIOClientLatestSocket,
	QSocketTransportEIOClientV3Socket,
} from '@qsocket/transport';

// Example usage with qsocket core
import { QSocketServer, QSocketClient } from '@qsocket/core';

// Set up a server with the latest version of engine.io transport
const modernServer = new QSocketServer({
	transport: new QSocketTransportEIOLatestServer(/** Configurations */),
	// Here, you can pass specific configurations for engine.io-latest
});

// Set up a server with version 3 of engine.io transport for legacy support
const legacyServer = new QSocketServer({
	transport: new QSocketTransportEIOV3Server(/** Configurations */),
	// This configuration supports legacy environments requiring engine.io v3
});

// Set up a client using the latest version of engine.io-client transport
const modernClient = new QSocketClient({
	transport: new QSocketTransportEIOClientLatestSocket(/** Configurations */),
	// This configuration utilizes the latest engine.io-client features
});

// Set up a client with engine.io-client v3 transport for compatibility with older versions
const legacyClient = new QSocketClient({
	transport: new QSocketTransportEIOClientV3Socket(/** Configurations */),
	// This setup enables legacy client support with engine.io-client v3
});
```

Each transport module can be passed to `QSocket`'s `transport` option, allowing you to customize your connection based on the environment and version requirements.

## Documentation

For more detailed information on each individual transport, please refer to the respective package documentation:

- **[@qsocket/framework](https://www.npmjs.com/package/@qsocket/framework)**
- **[@qsocket/core](https://www.npmjs.com/package/@qsocket/core)**
- **[@qsocket/transport-engine.io-latest](https://www.npmjs.com/package/@qsocket/transport-engine.io-latest)**
- **[@qsocket/transport-engine.io-v3](https://www.npmjs.com/package/@qsocket/transport-engine.io-v3)**
- **[@qsocket/transport-engine.io-client-latest](https://www.npmjs.com/package/@qsocket/transport-engine.io-client-latest)**
- **[@qsocket/transport-engine.io-client-v3](https://www.npmjs.com/package/@qsocket/transport-engine.io-client-v3)**

## License

This project is licensed under the MIT License.
