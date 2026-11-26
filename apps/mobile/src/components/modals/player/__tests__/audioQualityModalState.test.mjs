import assert from 'node:assert/strict'
import test from 'node:test'

import {
	createDelayedVisibilityController,
	createPendingSwitchTimer,
	resolveAudioQualityCardState,
	SWITCH_INDICATOR_DELAY_MS,
} from '../audioQualityModalState.ts'

function createManualScheduler() {
	const pending = new Map()
	let nextHandle = 1
	let now = 0

	return {
		scheduler: {
			setTimeout: (callback, delayMs) => {
				const handle = nextHandle

				nextHandle += 1
				pending.set(handle, { callback, dueAt: now + delayMs })

				return handle
			},
			clearTimeout: (handle) => {
				pending.delete(handle)
			},
		},
		pendingCount: () => pending.size,
		advance: (ms) => {
			now += ms

			for (const [handle, entry] of pending) {
				if (entry.dueAt > now) {
					continue
				}

				pending.delete(handle)
				entry.callback()
			}
		},
	}
}

test('SWITCH_INDICATOR_DELAY_MS 为 180 毫秒', () => {
	assert.equal(SWITCH_INDICATOR_DELAY_MS, 180)
})

test('快速切换（< 180ms）收尾后全程不触发可见性回调', () => {
	const events = []
	const { scheduler, advance, pendingCount } = createManualScheduler()

	const controller = createDelayedVisibilityController(
		SWITCH_INDICATOR_DELAY_MS,
		(visible) => events.push(visible),
		scheduler,
	)

	controller.finish()
	assert.deepEqual(events, [])

	controller.start()
	advance(SWITCH_INDICATOR_DELAY_MS - 1)
	controller.finish()
	advance(SWITCH_INDICATOR_DELAY_MS * 3)

	assert.deepEqual(events, [])
	assert.equal(pendingCount(), 0)
})

test('慢切流（>= 180ms）先展示指示器，收尾后隐藏', () => {
	const events = []
	const { scheduler, advance, pendingCount } = createManualScheduler()

	const controller = createDelayedVisibilityController(
		SWITCH_INDICATOR_DELAY_MS,
		(visible) => events.push(visible),
		scheduler,
	)

	controller.start()
	advance(SWITCH_INDICATOR_DELAY_MS)
	assert.deepEqual(events, [true])
	assert.equal(pendingCount(), 0)

	controller.finish()
	assert.deepEqual(events, [true, false])
})

test('dispose 清理计时器且之后不再回调', () => {
	const events = []
	const { scheduler, advance, pendingCount } = createManualScheduler()

	const controller = createDelayedVisibilityController(
		SWITCH_INDICATOR_DELAY_MS,
		(visible) => events.push(visible),
		scheduler,
	)

	controller.start()
	advance(60)
	assert.equal(pendingCount(), 1)

	controller.dispose()
	assert.equal(pendingCount(), 0)

	advance(1000)
	assert.deepEqual(events, [])

	controller.start()
	controller.finish()
	advance(1000)
	assert.deepEqual(events, [])
})

test('连续多次 start/finish 状态正确重置', () => {
	const events = []
	const { scheduler, advance, pendingCount } = createManualScheduler()

	const controller = createDelayedVisibilityController(
		SWITCH_INDICATOR_DELAY_MS,
		(visible) => events.push(visible),
		scheduler,
	)

	controller.start()
	advance(SWITCH_INDICATOR_DELAY_MS)
	controller.finish()
	assert.deepEqual(events, [true, false])
	assert.equal(pendingCount(), 0)

	controller.start()
	advance(SWITCH_INDICATOR_DELAY_MS)
	controller.finish()
	assert.deepEqual(events, [true, false, true, false])
	assert.equal(pendingCount(), 0)

	controller.start()
	advance(SWITCH_INDICATOR_DELAY_MS - 1)
	controller.finish()
	advance(SWITCH_INDICATOR_DELAY_MS * 3)
	assert.deepEqual(events, [true, false, true, false])
	assert.equal(pendingCount(), 0)
})

test('resolveAudioQualityCardState pending 优先于一切，包括检查中与旧档位', () => {
	assert.equal(
		resolveAudioQualityCardState(true, false, false, true, false, false),
		'pending',
	)
	assert.equal(
		resolveAudioQualityCardState(true, true, true, true, true, true),
		'pending',
	)
})

test('resolveAudioQualityCardState 检查中优先于未确认与旧档位', () => {
	assert.equal(
		resolveAudioQualityCardState(false, true, true, true, true, true),
		'checking',
	)
	assert.equal(
		resolveAudioQualityCardState(false, true, false, false, false, false),
		'checking',
	)
})

test('resolveAudioQualityCardState 未确认态优先于任何旧档位', () => {
	assert.equal(
		resolveAudioQualityCardState(false, false, true, true, false, false),
		'unconfirmed',
	)
	assert.equal(
		resolveAudioQualityCardState(false, false, true, true, true, true),
		'unconfirmed',
	)
})

test('resolveAudioQualityCardState 其余优先级：实际 > 加载中 > 失败 > 空', () => {
	assert.equal(
		resolveAudioQualityCardState(false, false, false, true, true, true),
		'actual',
	)
	assert.equal(
		resolveAudioQualityCardState(false, false, false, false, true, true),
		'loading',
	)
	assert.equal(
		resolveAudioQualityCardState(false, false, false, false, false, true),
		'load_failed',
	)
	assert.equal(
		resolveAudioQualityCardState(false, false, false, false, false, false),
		'idle',
	)
})

test('resolveAudioQualityCardState 真实事件覆盖超时后回到实际档位', () => {
	assert.equal(
		resolveAudioQualityCardState(false, false, false, true, false, false),
		'actual',
	)
})

test('resolveAudioQualityCardState unknown 不算 actual，必须走未确认分支', () => {
	const hasActual = false

	assert.equal(
		resolveAudioQualityCardState(false, false, true, hasActual, false, false),
		'unconfirmed',
	)
})

test('createPendingSwitchTimer 点击即开始计时，超时只触发一次', () => {
	const { scheduler, advance, pendingCount } = createManualScheduler()
	let fired = 0

	const timer = createPendingSwitchTimer(
		3000,
		() => {
			fired += 1
		},
		scheduler,
	)

	assert.equal(pendingCount(), 0)

	timer.start()
	assert.equal(pendingCount(), 1)

	advance(2999)
	assert.equal(fired, 0)

	advance(1)
	assert.equal(fired, 1)
	assert.equal(pendingCount(), 0)

	advance(10000)
	assert.equal(fired, 1)
})

test('createPendingSwitchTimer 重复 start 不重置计时（reload 返回不影响起点）', () => {
	const { scheduler, advance } = createManualScheduler()
	let fired = 0

	const timer = createPendingSwitchTimer(
		3000,
		() => {
			fired += 1
		},
		scheduler,
	)

	timer.start()
	advance(2000)
	timer.start()
	advance(1000)

	assert.equal(fired, 1)
})

test('createPendingSwitchTimer settle 后不再触发，且可重新 start', () => {
	const { scheduler, advance } = createManualScheduler()
	let fired = 0

	const timer = createPendingSwitchTimer(
		3000,
		() => {
			fired += 1
		},
		scheduler,
	)

	timer.start()
	advance(1000)
	timer.settle()
	advance(5000)
	assert.equal(fired, 0)

	timer.start()
	advance(3000)
	assert.equal(fired, 1)
})

test('createPendingSwitchTimer dispose 后永久失效', () => {
	const { scheduler, advance } = createManualScheduler()
	let fired = 0

	const timer = createPendingSwitchTimer(
		3000,
		() => {
			fired += 1
		},
		scheduler,
	)

	timer.start()
	timer.dispose()
	advance(5000)
	assert.equal(fired, 0)

	timer.start()
	advance(5000)
	assert.equal(fired, 0)
})
