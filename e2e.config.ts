import { mobile } from '@e2e-dev/mobile'
import type { E2EConfig } from 'e2e'

export default {
	projectId: 'bbplayer-mobile',
	tests: ['tests/mobile/**/*.e2e.ts'],
	targets: [
		{
			name: 'android',
			engine: mobile({
				platform: 'android',
				settle: 500,
				transition: 2_000,
				device: process.env.E2E_ANDROID_DEVICE,
			}),
			app: {
				bundleId: process.env.E2E_ANDROID_APP_ID ?? 'com.roitium.bbplayer',
			},
		},
		{
			name: 'ios',
			engine: mobile({
				platform: 'ios',
				settle: 500,
				transition: 2_000,
				device: process.env.E2E_IOS_DEVICE,
			}),
			app: {
				bundleId: process.env.E2E_IOS_APP_ID ?? 'com.roitium.bbplayer',
			},
		},
	],
	workers: 1,
	timeout: 120_000,
	assertionTimeout: 15_000,
} satisfies E2EConfig
