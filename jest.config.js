const { createDefaultPreset } = require('ts-jest');

const defaultPreset = createDefaultPreset();

/** @type {import('ts-jest').JestConfigWithTsJest} */
module.exports = {
    ...defaultPreset,
    coverageThreshold: {
        global: {
            statements: 100,
            branches: 100,
            functions: 100,
            lines: 100,
        },
    },
    testMatch: ['**/**.test.ts'],
    transform: {
        '.(js|ts)': 'ts-jest',
    },
    transformIgnorePatterns: [
        '[/\\\\]node_modules[/\\\\].+\\.(js|jsx|ts|tsx|json)$',
        'package.json',
    ],
    coverageReporters: ['cobertura', 'html', 'text'],
    coveragePathIgnorePatterns: ['<rootDir>/src/examples/'],
};
