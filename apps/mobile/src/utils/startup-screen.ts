import { storage } from './mmkv-instance'

export type StartupScreen = 'home' | 'library'

function isStartupScreen(value: unknown): value is StartupScreen {
	return value === 'home' || value === 'library'
}

// AppStore 水合也调用此函数，保证旧字段删除前已迁移；已有独立设置始终优先。
export function migrateStartupScreen(legacyValue: unknown): StartupScreen {
	const current = storage.getString('startup_screen')
	if (isStartupScreen(current)) return current
	const screen = isStartupScreen(legacyValue) ? legacyValue : 'home'
	storage.set('startup_screen', screen)
	return screen
}

export function getStartupScreen(): StartupScreen {
	const current = storage.getString('startup_screen')
	if (isStartupScreen(current)) return current

	// 仅升级后的首次读取需要解析旧 JSON，之后（包括默认主页）只读取独立 key。
	const raw = storage.getString('app-storage')
	let legacy: { state?: { settings?: { startupScreen?: unknown } } } | null =
		null
	try {
		legacy = raw ? JSON.parse(raw) : null
	} catch {
		// 损坏的旧设置回退到主页，不影响启动，也不修改其他旧数据。
	}
	return migrateStartupScreen(legacy?.state?.settings?.startupScreen)
}

export function setStartupScreen(screen: StartupScreen) {
	storage.set('startup_screen', screen)
}

export function subscribeStartupScreen(onChange: () => void) {
	const listener = storage.addOnValueChangedListener((key) => {
		if (key === 'startup_screen') onChange()
	})
	return () => listener.remove()
}
