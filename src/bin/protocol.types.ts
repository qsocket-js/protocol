import { EQSocketProtocolContentType, EQSocketProtocolMessageType } from './protocol.enums';

//#region PAYLOAD

/**
 * @description Data types that can be transmitted through the Q-SOCKET protocol.
 * Includes primitives, a universal JSON type, and Buffer.
 *
 * - `undefined/void`: Absence of value.
 * - `null`: Explicit indication of no value.
 * - `boolean`: Logical `true` or `false`.
 * - `number`: Numeric value.
 * - `string`: Text value.
 * - `IJSON`: Universal JSON type, including primitives, arrays, and objects.
 * - `Buffer`: Binary data.
 */
export type TQSocketProtocolPayloadData =
	| undefined
	| void
	| null
	| boolean
	| number
	| string
	| object
	| Array<undefined | null | boolean | number | string | object>
	| Buffer;

/**
 * @description Payload Interface
 * Contains data as well as information for further processing
 */
export interface IQSocketProtocolPayload<T extends TQSocketProtocolPayloadData = TQSocketProtocolPayloadData> {
	/**
	 * Data to be transmitted.
	 */
	data: T;

	/**
	 * Specifies the data format of the payload.
	 * Defines the type of data in the `payload` field, such as `STRING`, `JSON`, or `BUFFER`.
	 */
	'Content-Type': EQSocketProtocolContentType;
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
}

export type IQSocketProtocolMessageMeta = IQSocketProtocolMessageMetaData | IQSocketProtocolMessageMetaAck | IQSocketProtocolMessageMetaControl;

/**
 * @description General interface for all QSOCKET protocol variants.
 *
 * Represents the essential properties that all messages in the QSOCKET protocol must have.
 */
export interface IQSocketProtocolChunk<
	M extends IQSocketProtocolMessageMeta = IQSocketProtocolMessageMeta,
	P extends IQSocketProtocolPayload = IQSocketProtocolPayload,
> {
	/**
	 * Contains metadata for the message.
	 * Provides necessary information like namespace, event name, timestamps, etc.
	 */
	meta: M;
	/**
	 * Payload data of the message.
	 */
	payload: P;
}

/**
 * @description A complete Q-SOCKET protocol message, represented as an array of chunks.
 */
export type IQSocketProtocolMessage<
	T extends IQSocketProtocolMessageMeta = IQSocketProtocolMessageMeta,
	P extends IQSocketProtocolPayload = IQSocketProtocolPayload,
> = IQSocketProtocolChunk<T, P>[];

/** Внутренний формат хранения промежуточных данных */
export type TChunkBinary = {
	encoding: number;
	meta: Uint8Array;
	data: Uint8Array;
};
