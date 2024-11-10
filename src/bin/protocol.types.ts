import { EQSocketProtocolContentEncoding, EQSocketProtocolContentType, EQSocketProtocolMessageType } from './protocol.enums';

//#region ПОЛЕЗНАЯ НАГРУЗКА
/**
 * @description Универсальный тип для описания всех допустимых JSON-значений,
 * включая примитивы, массивы и объекты JSON.
 */
export type IJSON = string | number | boolean | null | IJSONArray | IJSONObject;

/**
 * @description Тип, представляющий массив JSON-значений.
 * Массив может содержать элементы любых типов, допустимых в JSON.
 */
export interface IJSONArray extends Array<IJSON> {}

/**
 * @description Тип, представляющий JSON-объект.
 * Ключи должны быть строками, а значения могут быть любого JSON-совместимого типа.
 */
export interface IJSONObject {
	[key: string]: IJSON;
}

/**
 * @description Типы данных, которые могут быть переданы через протокол Q-SOCKET.
 * Включает примитивы, универсальный JSON-тип, Buffer и symbol.
 *
 * - `undefined`: Отсутствие значения.
 * - `null`: Явное указание отсутствия значения.
 * - `boolean`: Логическое значение `true` или `false`.
 * - `number`: Числовое значение.
 * - `symbol`: Символ, уникальный идентификатор.
 * - `string`: Текстовое значение.
 * - `IJSON`: Универсальный JSON-тип, включающий примитивы, массивы и объекты.
 * - `Buffer`: Бинарные данные.
 */
export type TQSocketProtocolPayloadData = undefined | null | boolean | number | symbol | string | IJSON | Buffer;

/**
 * @description Интерфейс полезной нагрузки
 * Содержит данные, а также информацию по их дальнейшей обработке
 */
interface IQSocketProtocolPayload {
	/**
	 * Данные
	 */
	data: TQSocketProtocolPayloadData;

	/**
	 * Формат данных полезной нагрузки
	 * Указывает тип данных в поле `payload`, например `STRING`, `JSON` или `BUFFER`.
	 */
	'Content-Type': EQSocketProtocolContentType;

	/**
	 * Декодирование полезной нагрузки
	 * Указывает тип сжатия данных в `payload`, например `GZIP` или `DEFLATE`.
	 */
	'Content-Encoding': EQSocketProtocolContentEncoding;
}
//#endregion

interface IQSocketProtocolMessageMeta {
	/** Тип сообщения */
	type: EQSocketProtocolMessageType;
	/**
	 * Уникальный идентификатор сообщения
	 * Используется для отслеживания сообщений и связи ответов с запросами.
	 */
	uuid: string;
}

export interface IQSocketProtocolMessageMetaData extends IQSocketProtocolMessageMeta {
	/** Тип сообщения */
	type: EQSocketProtocolMessageType.DATA;
	/**
	 * Пространство имён
	 * Логическое пространство, к которому относится событие (например, разделение чата по комнатам).
	 */
	namespace: string;

	/**
	 * Событие
	 * Идентификатор события в рамках пространства имен.
	 */
	event: string;
}

export interface IQSocketProtocolMessageMetaAck extends IQSocketProtocolMessageMeta {
	/** Тип сообщения */
	type: EQSocketProtocolMessageType.ACK;
}

export interface IQSocketProtocolMessageMetaControl extends IQSocketProtocolMessageMeta {
	/** Тип сообщения */
	type: EQSocketProtocolMessageType.CONTROL;
	/**
	 * Пространство имён
	 * Логическое пространство, к которому относится событие (например, разделение чата по комнатам).
	 */
	namespace: string;
}

/**
 * @description Общий интерфейс для всех вариантов протокола QSOCKET
 *
 * Представляет базовые свойства, которые есть у всех сообщений в протоколе QSOCKET.
 */
export interface IQSocketProtocolChunk {
	/**
	 * Дополнительные метаданные
	 * Содержат служебную информацию, такую как название пространства имён, название события, временные метки, и прочее.
	 */
	meta: IQSocketProtocolMessageMeta;

	/**
	 * @description Полезная нагрузка
	 */
	payload: IQSocketProtocolPayload;
}

export type IQSocketProtocolMessage = IQSocketProtocolChunk[];

export interface TQSocketProtocolCompressor {
	/**
	 * Сжимает данные с использованием GZIP
	 * @param data Данные для сжатия
	 * @returns Сжатые данные
	 */
	toGzip(data: Buffer | Uint8Array): Promise<Buffer | Uint8Array>;

	/**
	 * Распаковывает данные, сжатые с использованием GZIP
	 * @param data Сжатые данные
	 * @returns Распакованные данные
	 */
	fromGzip(data: Buffer | Uint8Array): Promise<Buffer | Uint8Array>;
	/**
	 * Сжимает данные с использованием DEFLATE
	 * @param data Данные для сжатия
	 * @returns Сжатые данные
	 */
	toDeflate(data: Buffer | Uint8Array): Promise<Buffer | Uint8Array>;

	/**
	 * Распаковывает данные, сжатые с использованием DEFLATE
	 * @param data Сжатые данные
	 * @returns Распакованные данные
	 */
	fromDeflate(data: Buffer | Uint8Array): Promise<Buffer | Uint8Array>;
}
