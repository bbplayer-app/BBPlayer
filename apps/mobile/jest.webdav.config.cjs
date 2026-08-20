module.exports = {
	rootDir: '../..',
	testEnvironment: 'node',
	testMatch: ['<rootDir>/apps/mobile/src/lib/backup/webdav-client.test.ts'],
	extensionsToTreatAsEsm: ['.ts'],
	moduleNameMapper: {
		'^(\\.{1,2}/.*)\\.js$': '$1',
	},
	transform: {
		'^.+\\.ts$': [
			'ts-jest',
			{
				tsconfig: {
					target: 'ES2022',
					module: 'ESNext',
					moduleResolution: 'Bundler',
					strict: true,
					esModuleInterop: true,
					isolatedModules: true,
					skipLibCheck: true,
					types: ['jest', 'node'],
					lib: ['ES2022', 'DOM'],
				},
				useESM: true,
			},
		],
	},
}
