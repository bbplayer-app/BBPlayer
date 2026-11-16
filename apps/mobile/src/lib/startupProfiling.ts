import { startProfiling } from 'react-native-release-profiler'

import { storage } from '@/utils/mmkv-instance'

/**
 * 「自动记录启动性能」开启时，在本模块求值时立即启动 Hermes 采样 profiler。
 *
 * 必须是 index.js 的第一个 import：ES import 会被提升，所有 import 的模块都在入口文件自身的代码之前
 * 按顺序求值，所以在 index.js 代码里调用的话，profile 会漏掉全部 import 链（Sentry、expo-router 等）。
 * 本模块只依赖 profiler 和 mmkv 实例，不要在这里引入其他模块，否则它们的求值也会落在 profile 之外。
 *
 * profile 仍然覆盖不到 Metro 在入口之前执行的 polyfill 和 InitializeCore。
 */
export const STARTUP_PROFILING_KEY = 'enable_startup_profiling'

function start(): boolean {
	if (!(storage.getBoolean(STARTUP_PROFILING_KEY) ?? false)) return false

	try {
		return startProfiling()
	} catch {
		// profiling is unavailable in this build
		return false
	}
}

export const startupProfilingStarted = start()
