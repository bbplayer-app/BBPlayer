import assert from 'node:assert/strict'
import test from 'node:test'

import {
	createDelayedVisibilityController,
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

test('resolveAudioQualityCardState pending 优先于一切，包括未确认与旧档位', () => {
	assert.equal(
		resolveAudioQualityCardState(true, false, true, false, false),
		'pending',
	)
	assert.equal(
		resolveAudioQualityCardState(true, true, true, true, true),
		'pending',
	)
})

test('resolveAudioQualityCardState 未确认态优先于任何旧档位', () => {
	assert.equal(
		resolveAudioQualityCardState(false, true, true, false, false),
		'unconfirmed',
	)
	assert.equal(
		resolveAudioQualityCardState(false, true, true, true, true),
		'unconfirmed',
	)
})

test('resolveAudioQualityCardState 其余优先级：实际 > 加载中 > 失败 > 空', () => {
	assert.equal(
		resolveAudioQualityCardState(false, false, true, true, true),
		'actual',
	)
	assert.equal(
		resolveAudioQualityCardState(false, false, false, true, true),
		'loading',
	)
	assert.equal(
		resolveAudioQualityCardState(false, false, false, false, true),
		'load_failed',
	)
	assert.equal(
		resolveAudioQualityCardState(false, false, false, false, false),
		'idle',
	)
})

test('resolveAudioQualityCardState 真实事件覆盖超时后回到实际档位', () => {
	assert.equal(
		resolveAudioQualityCardState(false, false, true, false, false),
		'actual',
	)
})
