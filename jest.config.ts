import type { Config } from 'jest';

const config: Config = {
	rootDir: './',
	testMatch: ['**/__tests__/**/*.test.ts', '**/?(*.)+(spec|test).ts'],
	transform: {
		'^.+\\.ts$': 'ts-jest',
	},
	testEnvironment: 'node',
	collectCoverage: true,
	collectCoverageFrom: ['src/**/*.ts', '!src/**/*.d.ts'],
	coverageDirectory: 'coverage',
	coverageReporters: ['json', 'json-summary', 'text', 'clover'],
	testPathIgnorePatterns: ['/node_modules/', '/coverage/'],
	moduleFileExtensions: ['ts', 'js', 'json', 'node'],
	moduleNameMapper: {
		'^@src/(.*)$': '<rootDir>/src/$1',
	},
	resetMocks: true,
};

export default config;
