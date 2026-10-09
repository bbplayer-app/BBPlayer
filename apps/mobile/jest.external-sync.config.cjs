module.exports = {
	rootDir: '../..',
	testEnvironment: 'node',
	testMatch: [
		'<rootDir>/apps/mobile/src/lib/services/externalPlaylistService.test.ts',
	],
	moduleNameMapper: {
		'^@/(.*)$': '<rootDir>/apps/mobile/src/$1',
	},
	transform: {
		'^.+\\.tsx?$': [
			'ts-jest',
			{
				tsconfig: {
					target: 'ES2022',
					module: 'Node16',
					moduleResolution: 'Node16',
					jsx: 'react-jsx',
					esModuleInterop: true,
					isolatedModules: true,
					skipLibCheck: true,
				},
			},
		],
	},
}
