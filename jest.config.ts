import type { Config } from 'jest';

const config: Config = {
	// Указываем корневую папку для тестов
	rootDir: './',

	// Шаблон для поиска тестовых файлов
	testMatch: ['**/__tests__/**/*.test.ts', '**/?(*.)+(spec|test).ts'],

	// Преобразуем TypeScript файлы с помощью ts-jest
	transform: {
		'^.+\\.ts$': 'ts-jest',
	},

	// Задаем окружение для тестов
	testEnvironment: 'node',
	collectCoverage: true,
	// Указываем путь к исходникам для покрытия кода
	collectCoverageFrom: ['src/**/*.ts', '!src/**/*.d.ts'],

	// Задаем папку для покрытия кода
	coverageDirectory: 'coverage',

	// Игнорируем папки node_modules и coverage при тестировании
	testPathIgnorePatterns: ['/node_modules/', '/coverage/'],

	// Указываем модули и расширения для резолвинга
	moduleFileExtensions: ['ts', 'js', 'json', 'node'],

	// Маппинг путей для правильного резолвинга (если используются алиасы в tsconfig)
	moduleNameMapper: {
		'^@src/(.*)$': '<rootDir>/src/$1',
	},

	// Очищаем моки между тестами
	resetMocks: true,
};

export default config;
