/**
 * Message type options.
 * Defines the primary message type: data transfer or control.
 */
export enum EQSocketProtocolMessageType {
	/**
	 * Data transfer protocol. Message carries a payload with data.
	 * Binary value: 00
	 */
	DATA = 0b00,

	/**
	 * Control protocol. Message is intended for connection management.
	 * Binary value: 01
	 */
	CONTROL = 0b01,

	/**
	 * Acknowledgment protocol.
	 * Confirms delivery of a message.
	 * Binary value: 10
	 */
	ACK = 0b10,
}

/**
 * Payload content format.
 * Used to specify the type of content in the QSOCKET protocol.
 */
export enum EQSocketProtocolContentType {
	/**
	 * No data. Used when payload is not required.
	 * Binary value: 000
	 */
	UNDEFINED = 0b000,

	/**
	 * Null data. Explicitly indicates no value in payload.
	 * Binary value: 001
	 */
	NULL = 0b001,

	/**
	 * Boolean value. Payload is interpreted as a boolean.
	 * Binary value: 010
	 */
	BOOLEAN = 0b010,

	/**
	 * Numeric value. Payload is interpreted as a number.
	 * Binary value: 011
	 */
	NUMBER = 0b011,

	/**
	 * String. Payload is interpreted as a UTF-8 encoded string.
	 * Binary value: 100
	 */
	STRING = 0b100,

	/**
	 * Object. Payload represents a serialized JSON object.
	 * Binary value: 101
	 */
	JSON = 0b101,

	/**
	 * Buffer. Payload is transmitted as binary data (Buffer).
	 * Binary value: 110
	 */
	BUFFER = 0b110,
}
