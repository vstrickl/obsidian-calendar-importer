module.exports = {
    preset: 'ts-jest',
    testEnvironment: 'node',
    moduleNameMapper: {
        '^obsidian$': '<rootDir>/src/__mocks__/obsidian.ts',
    },
    transform: {
        '^.+\\.ts$': ['ts-jest', {
            tsconfig: 'tsconfig.test.json',
            diagnostics: false,
        }],
    },
    testMatch: ['**/__tests__/**/*.test.ts'],
};
