import { EQSocketProtocolContentEncoding, EQSocketProtocolContentType, EQSocketProtocolMessageType } from './protocol.enums';

//#region PAYLOAD
/**
 * @description Universal type for describing all permissible JSON values,
 * including primitives, arrays, and JSON objects.
 */
export type IJSON = string | number | boolean | null | IJSONArray | IJSONObject;

/**
 * @description Type representing an array of JSON values.
 * The array can contain elements of any type allowed in JSON.
 */
export interface IJSONArray extends Array<IJSON> {}

/**
 * @description Type representing a JSON object.
 * Keys must be strings, and values can be of any JSON-compatible type.
 */
export interface IJSONObject {
	[key: string]: IJSON;
}

/**
 * @description Data types that can be transmitted through the Q-SOCKET protocol.
 * Includes primitives, a universal JSON type, Buffer, and symbol.
 *
 * - `undefined`: Absence of value.
 * - `null`: Explicit indication of no value.
 * - `boolean`: Logical `true` or `false`.
 * - `number`: Numeric value.
 * - `symbol`: Symbol, a unique identifier.
 * - `string`: Text value.
 * - `IJSON`: Universal JSON type, including primitives, arrays, and objects.
 * - `Buffer`: Binary data.
 */
export type TQSocketProtocolPayloadData = undefined | null | boolean | number | symbol | string | IJSON | Buffer;

/**
 * @description Payload Interface
 * Contains data as well as information for further processing
 */
interface IQSocketProtocolPayload {
	/**
	 * Data to be transmitted.
	 */
	data: TQSocketProtocolPayloadData;

	/**
	 * Specifies the data format of the payload.
	 * Defines the type of data in the `payload` field, such as `STRING`, `JSON`, or `BUFFER`.
	 */
	'Content-Type': EQSocketProtocolContentType;

	/**
	 * Specifies the encoding of the payload.
	 * Defines the type of compression used for `payload`, such as `GZIP` or `DEFLATE`.
	 */
	'Content-Encoding': EQSocketProtocolContentEncoding;
}
//#endregion

/**
 * @description Base metadata interface for messages in the Q-SOCKET protocol.
 */
interface IQSocketProtocolMessageMetaBase {
	/**
	 * Type of the message.
	 */
	type: EQSocketProtocolMessageType;

	/**
	 * Unique identifier for the message.
	 * Used for tracking messages and linking responses to requests.
	 */
	uuid: string;
}

/**
 * @description Metadata for data messages.
 * Extends the base metadata interface to include specific details for data messages.
 */
export interface IQSocketProtocolMessageMetaData extends IQSocketProtocolMessageMetaBase {
	/**
	 * Specifies that this is a data message type.
	 */
	type: EQSocketProtocolMessageType.DATA;

	/**
	 * Namespace associated with the event.
	 * Provides a logical separation of events, e.g., separating chat rooms.
	 */
	namespace: string;

	/**
	 * Event identifier within the namespace.
	 */
	event: string;
}

/**
 * @description Metadata for acknowledgment messages.
 * Used to confirm message receipt or processing.
 */
export interface IQSocketProtocolMessageMetaAck extends IQSocketProtocolMessageMetaBase {
	/**
	 * Specifies that this is an acknowledgment message type.
	 */
	type: EQSocketProtocolMessageType.ACK;
}

/**
 * @description Metadata for control messages.
 * Used for managing connections, session states, or other control operations.
 */
export interface IQSocketProtocolMessageMetaControl extends IQSocketProtocolMessageMetaBase {
	/**
	 * Specifies that this is a control message type.
	 */
	type: EQSocketProtocolMessageType.CONTROL;

	/**
	 * Namespace associated with the control event.
	 * Provides a logical separation of control events.
	 */
	namespace: string;
}

export type IQSocketProtocolMessageMeta = IQSocketProtocolMessageMetaData | IQSocketProtocolMessageMetaAck | IQSocketProtocolMessageMetaControl;

/**
 * @description General interface for all QSOCKET protocol variants.
 *
 * Represents the essential properties that all messages in the QSOCKET protocol must have.
 */
export interface IQSocketProtocolChunk {
	/**
	 * Contains metadata for the message.
	 * Provides necessary information like namespace, event name, timestamps, etc.
	 */
	meta: IQSocketProtocolMessageMeta;

	/**
	 * Payload data of the message.
	 */
	payload: IQSocketProtocolPayload;
}

/**
 * @description A complete Q-SOCKET protocol message, represented as an array of chunks.
 */
export type IQSocketProtocolMessage = IQSocketProtocolChunk[];

/**
 * @description Compressor interface for handling data compression and decompression.
 * Defines methods for compressing and decompressing data in both GZIP and DEFLATE formats.
 */
export interface TQSocketProtocolCompressor {
	/**
	 * Compresses data using the GZIP algorithm.
	 * @param data Data to be compressed.
	 * @returns A promise that resolves to the compressed data.
	 */
	toGzip(data: Buffer | Uint8Array): Promise<Buffer | Uint8Array>;

	/**
	 * Decompresses data that was compressed with the GZIP algorithm.
	 * @param data Compressed data.
	 * @returns A promise that resolves to the decompressed data.
	 */
	fromGzip(data: Buffer | Uint8Array): Promise<Buffer | Uint8Array>;

	/**
	 * Compresses data using the DEFLATE algorithm.
	 * @param data Data to be compressed.
	 * @returns A promise that resolves to the compressed data.
	 */
	toDeflate(data: Buffer | Uint8Array): Promise<Buffer | Uint8Array>;

	/**
	 * Decompresses data that was compressed with the DEFLATE algorithm.
	 * @param data Compressed data.
	 * @returns A promise that resolves to the decompressed data.
	 */
	fromDeflate(data: Buffer | Uint8Array): Promise<Buffer | Uint8Array>;
}
