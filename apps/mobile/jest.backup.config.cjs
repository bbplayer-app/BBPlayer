module.exports = {
	rootDir: '../..',
	testEnvironment: 'node',
	testMatch: ['<rootDir>/apps/mobile/src/lib/backup/webdav.test.ts'],
	moduleNameMapper: {
		'^@/(.*)$': '<rootDir>/apps/mobile/src/$1',
	},
	transform: {
		'^.+\\.ts$': [
			'ts-jest',
			{
				tsconfig: {
					target: 'ES2022',
					module: 'Node16',
					moduleResolution: 'Node16',
					esModuleInterop: true,
					isolatedModules: true,
					skipLibCheck: true,
				},
			},
		],
	},
}
