/**
 * Represents an error that occurred during the encoding process in the QSocketProtocol.
 * Extends the base `Error` class to provide more context specific to encoding issues.
 */
export class QSocketProtocolEncodeError extends Error {
	/**
	 * Creates an instance of QSocketProtocolEncodeError.
	 *
	 * @param message - A descriptive error message.
	 * @param originalError - (Optional) The original error that caused this encoding error, if any.
	 */
	constructor(
		message: string,
		public originalError?: Error
	) {
		super(message);
		this.name = 'QSocketProtocolEncodeError';
		if (originalError) {
			this.stack += `\nCaused by: ${originalError.stack}`;
		}
	}
}

/**
 * Represents an error that occurred during the decoding process in the QSocketProtocol.
 * Extends the base `Error` class to provide more context specific to decoding issues.
 */
export class QSocketProtocolDecodeError extends Error {
	/**
	 * Creates an instance of QSocketProtocolDecodeError.
	 *
	 * @param message - A descriptive error message.
	 * @param originalError - (Optional) The original error that caused this decoding error, if any.
	 */
	constructor(
		message: string,
		public originalError?: Error
	) {
		super(message);
		this.name = 'QSocketProtocolDecodeError';
		if (originalError) {
			this.stack += `\nCaused by: ${originalError.stack}`;
		}
	}
}
