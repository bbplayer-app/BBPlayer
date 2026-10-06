import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { createRequire } from 'node:module'
import { dirname, resolve } from 'node:path'
import { DatabaseSync } from 'node:sqlite'
import test from 'node:test'
import { fileURLToPath } from 'node:url'
import vm from 'node:vm'

const root = resolve(dirname(fileURLToPath(import.meta.url)), '../../..')
const require = createRequire(resolve(root, 'apps/mobile/package.json'))
const ts = require('typescript')
const logger = {
	extend: () => logger,
	warning() {},
	error() {},
	info() {},
	debug() {},
}
const ok = (value) => ({ value, isErr: () => false, isOk: () => true })
function deferred() {
	let resolvePromise
	const promise = new Promise((resolveValue) => {
		resolvePromise = resolveValue
	})
	return { promise, resolve: resolvePromise }
}
function load(path, mocks) {
	const context = vm.createContext({
		exports: {},
		Date,
		console,
		require: (name) => {
			assert.ok(name in mocks, `unmocked ${name}`)
			return mocks[name]
		},
	})
	const result = ts.transpileModule(readFileSync(resolve(root, path), 'utf8'), {
		compilerOptions: {
			target: ts.ScriptTarget.ES2022,
			module: ts.ModuleKind.CommonJS,
			jsx: ts.JsxEmit.ReactJSX,
		},
	})
	vm.runInContext(result.outputText, context)
	return context.exports
}
function draftStore() {
	return load('apps/mobile/src/hooks/stores/useAbLoopDraftStore.ts', {
		zustand: require('zustand'),
	}).useAbLoopDraftStore
}
const ranges = load('apps/mobile/src/lib/player/abLoopDraft.ts', {})
function coordinator({ service } = {}) {
	let currentId = 'first',
		active = null,
		persisted = null,
		delayedTrack,
		saveError = false,
		mutationGate,
		nativeGate,
		cacheError = false,
		nativeDuration = Infinity
	const pending = new Map(),
		nativeFaults = [],
		previewFaults = [],
		calls = [],
		cache = [],
		dbSaved = new Map()
	const drafts = draftStore()
	const mod = load('apps/mobile/src/lib/player/abLoop.ts', {
		'@bbplayer/orpheus': {
			Orpheus: {
				getCurrentTrack: async () => {
					if (delayedTrack) {
						const d = delayedTrack
						delayedTrack = undefined
						return d.promise
					}
					return { id: currentId }
				},
				getAbLoop: async () => active,
				setAbLoop: async (trackId, start, end) => {
					calls.push(['set', trackId])
					if (nativeGate) await nativeGate.promise
					if (trackId !== currentId || end > nativeDuration) return false
					const fault = nativeFaults.shift()
					if (fault === 'reject') return false
					persisted = active = { trackId, start, end }
					if (fault === 'throw') throw new Error('native failed after applying')
					return true
				},
				clearAbLoop: async (trackId) => {
					calls.push(['clear', trackId])
					if (nativeGate) await nativeGate.promise
					if (trackId !== currentId) return false
					const fault = nativeFaults.shift()
					if (fault === 'reject') return false
					persisted = active = null
					if (fault === 'throw') throw new Error('native failed after applying')
					return true
				},
				setAbLoopPreview: async (trackId, range) => {
					calls.push(['preview', trackId, range])
					if (trackId !== currentId) return false
					const fault = previewFaults.shift()
					if (fault === 'reject') return false
					active = range
						? { trackId, start: range.start, end: range.end }
						: null
					if (fault === 'throw') throw new Error('preview recovery failed')
					return true
				},
				clearAbLoopPreview: async (trackId) => {
					calls.push(['restore', trackId])
					if (trackId !== currentId) return false
					active = persisted
					return true
				},
			},
		},
		'@/hooks/queries/orpheus': {
			orpheusQueryKeys: { abLoop: () => ['abLoop'] },
		},
		'@/hooks/stores/useAbLoopDraftStore': { useAbLoopDraftStore: drafts },
		'@/lib/player/seek': {
			seekWithinTrack: async (id, seconds) => {
				if (id !== currentId) return null
				calls.push(['seek', id, seconds])
				return seconds
			},
		},
		'@/lib/config/queryClient': {
			queryClient: {
				cancelQueries: async () => {
					calls.push(['cancel'])
					if (cacheError) throw new Error('cache failed')
				},
				invalidateQueries: async () => calls.push(['invalidate']),
				setQueryData: (_, value) => cache.push(value),
			},
		},
		'@/lib/services/trackService': {
			trackService: service ?? {
				getAbLoopByUniqueKey: (id) => {
					calls.push(['db-read', id])
					const d = pending.get(id)
					if (d) {
						pending.delete(id)
						return d.promise
					}
					return Promise.resolve(ok(dbSaved.get(id) ?? null))
				},
				setAbLoopByUniqueKey: async (id, start, end) => {
					if (mutationGate) await mutationGate.promise
					if (saveError) throw new Error('storage unavailable')
					calls.push(['db-save', id, start, end])
					dbSaved.set(id, { startPoint: start, endPoint: end })
					return ok(true)
				},
				clearAbLoopByUniqueKey: async (id) => {
					if (mutationGate) await mutationGate.promise
					if (saveError) throw new Error('storage unavailable')
					calls.push(['db-clear', id])
					dbSaved.delete(id)
					return ok(true)
				},
			},
		},
		'@/utils/log': logger,
	})
	return {
		mod,
		pending,
		calls,
		cache,
		drafts,
		dbSaved,
		setCurrent: (id) => {
			currentId = id
			active = null
			drafts.getState().resetForTrack(id)
		},
		delayNextTrack: (d) => {
			delayedTrack = d
		},
		getActive: () => active,
		getPersisted: () => persisted,
		autoReads() {},
		delayRead: (id, d) => pending.set(id, d),
		delayMutation: (d) => {
			mutationGate = d
		},
		delayNative: (d) => {
			nativeGate = d
		},
		faultNative: (...faults) => nativeFaults.push(...faults),
		faultPreview: (...faults) => previewFaults.push(...faults),
		failCache: () => {
			cacheError = true
		},
		setNativeDuration: (duration) => {
			nativeDuration = duration
		},
		failSave: () => {
			saveError = true
		},
	}
}

const tick = () => new Promise((resolveValue) => setImmediate(resolveValue))

// 可控异步边界执行真实协调层；数据库、原生、试听与草稿分别断言。
async function editedCoordinator() {
	const c = coordinator()
	c.dbSaved.set('first', { startPoint: 10, endPoint: 20 })
	const editor = await c.mod.beginAbLoopEdit('first')
	c.drafts.getState().setDraft('first', { start: 30, end: 40 })
	await c.mod.previewAbLoop(editor.token, { start: 30, end: 40 })
	return { ...c, token: editor.token }
}
for (const operation of ['save', 'clear']) {
	const submit = (c) =>
		operation === 'save'
			? c.mod.saveAbLoop('first', 30, 40, c.token)
			: c.mod.clearAbLoop('first', c.token)
	const assertCommitted = (c) => {
		if (operation === 'save')
			assert.equal(c.dbSaved.get('first').startPoint, 30)
		else assert.equal(c.dbSaved.has('first'), false)
	}
	for (const fault of ['reject', 'throw', 'storage']) {
		test(`${operation}: ${fault} preserves saved settings, preview and draft`, async () => {
			const c = await editedCoordinator()
			if (fault === 'storage') c.failSave()
			else c.faultNative(fault)
			await assert.rejects(submit(c), /拒绝|native failed|storage unavailable/)
			assert.equal(c.dbSaved.get('first').startPoint, 10)
			assert.equal(c.getPersisted().start, 10)
			assert.equal(c.getActive().start, 30)
			assert.equal(c.cache.at(-1).start, 30)
			assert.equal(c.drafts.getState().draft.start, 30)
			assert.equal(c.mod.isAbLoopEditCurrent(c.token), true)
			if (fault === 'reject')
				assert.equal(
					c.calls.some(([kind]) => kind === 'db-save' || kind === 'db-clear'),
					false,
				)
		})
	}
	for (const fault of ['throw', 'storage']) {
		test(`${operation}: ${fault} with failed compensation reports both errors`, async () => {
			const c = await editedCoordinator()
			if (fault === 'storage') {
				c.failSave()
				c.faultNative(undefined, 'reject')
			} else c.faultNative('throw', 'reject')
			await assert.rejects(submit(c), (error) => {
				assert.equal(error.name, 'AbLoopRecoveryError')
				assert.equal(error.message, '未保存，播放状态恢复失败')
				assert.match(error.cause.message, /native failed|storage unavailable/)
				assert.match(error.recoveryError.message, /恢复原生/)
				return true
			})
			assert.equal(c.dbSaved.get('first').startPoint, 10)
			assert.equal(c.drafts.getState().draft.start, 30)
		})
	}
	test(`${operation}: closing during SQLite write completes and restores latest committed settings`, async () => {
		const c = await editedCoordinator(),
			gate = deferred()
		c.delayMutation(gate)
		const committing = submit(c)
		await tick()
		const closing = c.mod.endAbLoopEdit(c.token)
		await tick()
		gate.resolve()
		const result = await committing
		await closing
		assert.equal(result.status, 'committed')
		assert.equal(result.playback, 'applied')
		assertCommitted(c)
		assert.equal(c.getActive()?.start ?? null, operation === 'save' ? 30 : null)
		assert.equal(
			c.getPersisted()?.start ?? null,
			operation === 'save' ? 30 : null,
		)
		assert.equal(c.drafts.getState().draft, null)
	})
	test(`${operation}: preview compensation failure is explicit even when formal restoration succeeded`, async () => {
		const c = await editedCoordinator()
		c.failSave()
		c.faultPreview('reject')
		await assert.rejects(
			submit(c),
			(error) =>
				error.name === 'AbLoopRecoveryError' &&
				/试听/.test(error.recoveryError.message),
		)
		assert.equal(c.dbSaved.get('first').startPoint, 10)
		assert.equal(c.getPersisted().start, 10)
		assert.equal(c.drafts.getState().draft.start, 30)
	})
	test(`${operation}: closing during failed SQLite write restores formal settings and keeps draft`, async () => {
		const c = await editedCoordinator(),
			gate = deferred()
		c.delayMutation(gate)
		c.failSave()
		const committing = submit(c)
		const rejected = assert.rejects(committing, /storage unavailable/)
		await tick()
		const closing = c.mod.endAbLoopEdit(c.token)
		gate.resolve()
		await Promise.all([rejected, closing])
		assert.equal(c.dbSaved.get('first').startPoint, 10)
		assert.equal(c.getActive().start, 10)
		assert.equal(c.getPersisted().start, 10)
		assert.equal(c.drafts.getState().draft.start, 30)
	})
	for (const boundary of ['native', 'storage']) {
		test(`${operation}: track change during ${boundary} defers original-track commit`, async () => {
			const c = await editedCoordinator(),
				gate = deferred()
			if (boundary === 'native') c.delayNative(gate)
			else c.delayMutation(gate)
			const committing = submit(c)
			await tick()
			c.setCurrent('second')
			c.dbSaved.set('second', { startPoint: 50, endPoint: 60 })
			const restore = c.mod.applyAbLoopForTrack('second')
			gate.resolve()
			const result = await committing
			await restore
			assert.equal(result.playback, 'deferred')
			assertCommitted(c)
			assert.equal(c.getActive().trackId, 'second')
			assert.equal(c.getActive().start, 50)
			assert.equal(c.cache.at(-1).trackId, 'second')
		})
	}
	test(`${operation}: new edit retains its draft and reads the newly committed setting`, async () => {
		const c = await editedCoordinator(),
			gate = deferred()
		c.delayMutation(gate)
		const committing = submit(c)
		await tick()
		const closing = c.mod.endAbLoopEdit(c.token)
		const opening = c.mod.beginAbLoopEdit('first')
		await tick()
		c.drafts.getState().setDraft('first', { start: 70, end: 80 })
		gate.resolve()
		await Promise.all([committing, closing])
		const editor = await opening
		assert.equal(
			editor.savedLoop?.start ?? null,
			operation === 'save' ? 30 : null,
		)
		assert.equal(c.mod.isAbLoopEditCurrent(editor.token), true)
		assert.equal(c.drafts.getState().draft.start, 70)
		assert.equal(c.getActive(), null)
	})
	test(`${operation}: queued restore reads SQLite after commit`, async () => {
		const c = coordinator(),
			gate = deferred()
		c.dbSaved.set('first', { startPoint: 10, endPoint: 20 })
		c.delayMutation(gate)
		const committing =
			operation === 'save'
				? c.mod.saveAbLoop('first', 30, 40)
				: c.mod.clearAbLoop('first')
		await tick()
		const restoring = c.mod.applyAbLoopForTrack('first')
		await tick()
		assert.equal(c.calls.filter(([kind]) => kind === 'db-read').length, 1)
		gate.resolve()
		await Promise.all([committing, restoring])
		assertCommitted(c)
		assert.equal(c.getActive()?.start ?? null, operation === 'save' ? 30 : null)
	})
	test(`${operation}: track change during failed write never compensates onto the new track`, async () => {
		const c = await editedCoordinator(),
			gate = deferred()
		c.delayMutation(gate)
		c.failSave()
		const rejected = assert.rejects(submit(c), /storage unavailable/)
		await tick()
		c.setCurrent('second')
		c.drafts.getState().setDraft('second', { start: 70, end: 80 })
		const nativeCalls = c.calls.filter(
			([kind]) => kind === 'set' || kind === 'clear',
		).length
		gate.resolve()
		await rejected
		assert.equal(
			c.calls.filter(([kind]) => kind === 'set' || kind === 'clear').length,
			nativeCalls,
		)
		assert.equal(c.dbSaved.get('first').startPoint, 10)
		assert.equal(c.getActive(), null)
		assert.equal(c.drafts.getState().draft.trackId, 'second')
	})
	test(`${operation}: completion only clears the original track draft`, async () => {
		const c = await editedCoordinator(),
			gate = deferred()
		c.delayMutation(gate)
		const committing = submit(c)
		await tick()
		c.setCurrent('second')
		c.drafts.getState().setDraft('second', { start: 70, end: 80 })
		gate.resolve()
		assert.equal((await committing).playback, 'deferred')
		assert.equal(c.drafts.getState().draft.trackId, 'second')
	})
	test(`${operation}: cache failure invalidates without failing durable commit`, async () => {
		const c = await editedCoordinator()
		c.failCache()
		assert.equal((await submit(c)).status, 'committed')
		assertCommitted(c)
		assert.equal(c.calls.at(-1)[0], 'invalidate')
		assert.equal(c.drafts.getState().draft, null)
	})
}
test('real SQLite accepts decimal metadata tail, native rejection and SQLite rejection preserve it', async () => {
	const { sqlite, service } = databaseService()
	try {
		sqlite.exec(
			"INSERT INTO tracks (id, unique_key, title, duration, source) VALUES (1, 'first', 'test', 180, 'local')",
		)
		const c = coordinator({ service })
		c.setNativeDuration(180.4)
		assert.equal(
			(await c.mod.saveAbLoop('first', 60, 180.4)).playback,
			'applied',
		)
		await assert.rejects(c.mod.saveAbLoop('first', 60, 181), /拒绝/)
		assert.equal(
			sqlite.prepare('SELECT end_point FROM ab_loops').get().end_point,
			180.4,
		)
		assert.equal(c.getActive().end, 180.4)
		// 更长的真实音频仍不能绕过元数据上限；ResultAsync 的 Err 同样需要补偿。
		c.setNativeDuration(200)
		await assert.rejects(c.mod.saveAbLoop('first', 60, 181.001))
		assert.equal(
			sqlite.prepare('SELECT end_point FROM ab_loops').get().end_point,
			180.4,
		)
		assert.equal(c.getPersisted().end, 180.4)
		assert.equal(c.getActive().end, 180.4)
	} finally {
		sqlite.close()
	}
})
test('session closed before acceptance ignores a delayed save', async () => {
	const c = await editedCoordinator(),
		gate = deferred()
	c.delayNextTrack(gate)
	const committing = c.mod.saveAbLoop('first', 30, 40, c.token)
	await c.mod.endAbLoopEdit(c.token)
	gate.resolve({ id: 'first' })
	assert.equal((await committing).status, 'ignored')
	assert.equal(c.dbSaved.get('first').startPoint, 10)
})
test('late old-track read cannot clear a new loop or its cache', async () => {
	const c = coordinator(),
		oldRead = deferred()
	c.delayRead('first', oldRead)
	const old = c.mod.applyAbLoopForTrack('first')
	await tick()
	c.setCurrent('second')
	c.dbSaved.set('second', { startPoint: 10, endPoint: 20 })
	const current = c.mod.applyAbLoopForTrack('second')
	oldRead.resolve(ok(null))
	await Promise.all([old, current])
	assert.equal(c.getActive().trackId, 'second')
	assert.equal(c.cache.at(-1).trackId, 'second')
	assert.equal(c.calls.filter(([kind]) => kind === 'clear').length, 0)
})
test('a pending restore cannot overwrite a manual edit', async () => {
	const c = coordinator(),
		read = deferred()
	c.delayRead('first', read)
	const restore = c.mod.applyAbLoopForTrack('first')
	await tick()
	const saving = c.mod.saveAbLoop('first', 30, 40)
	read.resolve(ok({ startPoint: 1, endPoint: 2 }))
	await restore
	assert.equal((await saving).status, 'committed')
	assert.equal(c.getActive().start, 30)
})
test('a delayed current-track response cannot supersede a newer save', async () => {
	const c = coordinator(),
		track = deferred()
	c.delayNextTrack(track)
	const restore = c.mod.applyAbLoopForTrack('first')
	await c.mod.saveAbLoop('first', 30, 40)
	track.resolve({ id: 'first' })
	await restore
	assert.equal(c.getActive().start, 30)
})
test('an old-track clear cannot invalidate a pending current-track restore', async () => {
	const c = coordinator(),
		read = deferred()
	c.setCurrent('second')
	c.delayRead('second', read)
	const restore = c.mod.applyAbLoopForTrack('second')
	await tick()
	assert.equal((await c.mod.clearAbLoop('first')).status, 'ignored')
	read.resolve(ok({ startPoint: 10, endPoint: 20 }))
	await restore
	assert.equal(c.getActive().trackId, 'second')
})
test('clear for an old track does not clear the current track', async () => {
	const c = coordinator()
	c.setCurrent('second')
	await c.mod.saveAbLoop('second', 10, 20)
	assert.equal((await c.mod.clearAbLoop('first')).status, 'ignored')
	assert.equal(c.getActive().trackId, 'second')
})

function history() {
	const records = [],
		reports = []
	const exports = load('apps/mobile/src/utils/player.ts', {
		neverthrow: { ok, err: (error) => ({ error, isErr: () => true }) },
		'@/hooks/queries/db/track': { trackKeys: { history: () => [] } },
		'@/hooks/stores/useAppStore': {
			getState: () => ({
				settings: { sendPlayHistory: true },
				hasBilibiliCookie: () => true,
			}),
		},
		'@/lib/api/bilibili/api': {
			bilibiliApi: {
				reportPlaybackHistory: async (data) => {
					reports.push(data)
					return ok(true)
				},
			},
		},
		'@/lib/config/queryClient': {
			queryClient: { invalidateQueries: async () => {} },
		},
		'@/lib/errors/player': {},
		'@/lib/player/playbackSession': {},
		'@/lib/services/trackService': {
			trackService: {
				addPlayRecordFromUniqueKey: async (_, record) => {
					records.push(record)
					return ok(true)
				},
				getTrackByUniqueKey: async () =>
					ok({
						source: 'bilibili',
						bilibiliMetadata: { bvid: 'BVtest', cid: 1, isMultiPage: true },
					}),
			},
		},
		'./error-handling': {},
		'./log': { ...logger, flatErrorMessage: String },
	})
	return { ...exports, records, reports }
}
test('native summary is recorded once and Bilibili receives the absolute position', async () => {
	const h = history()
	await h.finalizeAndRecordCurrentTrack('track', 180, 85, {
		startedAt: 1234,
		playedSeconds: 91.8,
		completed: true,
	})
	assert.equal(h.records.length, 1)
	assert.equal(h.records[0].durationPlayed, 91)
	assert.equal(h.records[0].startTime, 1234)
	assert.equal(h.records[0].completed, true)
	assert.equal(h.reports[0].progress, 85)
})
test('an incomplete segment stays incomplete despite a large absolute position', async () => {
	const h = history()
	await h.finalizeAndRecordCurrentTrack('track', 180, 61, {
		startedAt: 1234,
		playedSeconds: 1,
		completed: false,
	})
	assert.equal(h.records[0].durationPlayed, 1)
	assert.equal(h.records[0].completed, false)
})
test('events without summary retain ordinary completion behavior', async () => {
	const h = history()
	await h.finalizeAndRecordCurrentTrack('track', 180, 179)
	assert.equal(h.records[0].completed, true)
	assert.equal(h.records[0].durationPlayed, 179)
})

const jsx = (type, props, key) => ({ type, props, key })
function nodes(node, result = []) {
	if (Array.isArray(node)) {
		node.forEach((child) => nodes(child, result))
		return result
	}
	if (!node || typeof node !== 'object') return result
	result.push(node)
	nodes(node.props?.children, result)
	return result
}

// 实际 TSX 与协调层共同执行；这里只模拟 React 调度，布局与手势另在设备验证。
function modal({ saved = null, duration: initialDuration = 180 } = {}) {
	let trackId = 'first',
		position = 10,
		duration = initialDuration,
		playing = false,
		editorKey
	let state = [],
		refs = [],
		effects = [],
		scheduled = [],
		stateIndex = 0,
		refIndex = 0,
		effectIndex = 0
	const c = coordinator()
	c.autoReads()
	if (saved)
		c.dbSaved.set(trackId, { startPoint: saved.start, endPoint: saved.end })
	const closes = [],
		toasts = [],
		appListeners = new Set(),
		progressListeners = new Set()
	const appState = {
		currentState: 'active',
		addEventListener: (_, listener) => {
			appListeners.add(listener)
			return { remove: () => appListeners.delete(listener) }
		},
	}
	const exports = load(
		'apps/mobile/src/components/modals/player/AbLoopModal.tsx',
		{
			react: {
				useState: (initial) => {
					const i = stateIndex++,
						currentState = state
					if (!(i in currentState))
						currentState[i] =
							typeof initial === 'function' ? initial() : initial
					return [
						currentState[i],
						(value) => {
							currentState[i] =
								typeof value === 'function' ? value(currentState[i]) : value
						},
					]
				},
				useRef: (initial) => {
					const i = refIndex++
					return (refs[i] ??= { current: initial })
				},
				useEffect: (callback, deps) => {
					const i = effectIndex++
					if (
						!effects[i] ||
						deps.some((dep, index) => !Object.is(dep, effects[i].deps[index]))
					)
						scheduled.push({ i, callback, deps })
				},
			},
			'react/jsx-runtime': { jsx, jsxs: jsx, Fragment: 'Fragment' },
			'@bbplayer/orpheus': {
				useIsPlaying: () => playing,
				Orpheus: {
					getPosition: async () => position,
					getDuration: async () => duration,
					getCurrentTrack: async () => ({ id: trackId }),
					play: async () => {
						playing = true
					},
					pause: async () => {
						playing = false
					},
				},
			},
			'react-native': {
				StyleSheet: { create: (value) => value },
				View: 'View',
				Keyboard: { dismiss() {} },
				AppState: appState,
			},
			'react-native-gesture-handler': {
				ScrollView: 'ScrollView',
				Touchable: 'Touchable',
			},
			'react-native-paper': {
				Dialog: { Title: 'Title', Actions: 'Actions' },
				Divider: 'Divider',
				Switch: 'Switch',
				Text: 'Text',
				TextInput: 'TextInput',
				useTheme: () => ({
					colors: { onSurfaceVariant: 'gray', error: 'red' },
				}),
			},
			'@/components/common/Button': 'Button',
			'@/components/common/IconButton': 'IconButton',
			'@/hooks/player/useCurrentTrack': () => ({ uniqueKey: trackId }),
			'@/hooks/stores/useAbLoopDraftStore': {
				useAbLoopDraftStore: Object.assign(
					(selector) => selector(c.drafts.getState()),
					{ getState: c.drafts.getState },
				),
			},
			'@/hooks/stores/useModalStore': {
				useModalStore: (selector) =>
					selector({ close: (name) => closes.push(name) }),
			},
			'@/lib/player/abLoop': c.mod,
			'@/lib/player/abLoopDraft': ranges,
			'@/lib/player/progressListener': {
				subscribe: (_, fn) => {
					progressListeners.add(fn)
					return () => progressListeners.delete(fn)
				},
			},
			'@/utils/error-handling': {
				toastAndLogError: (message) => toasts.push(message),
			},
			'@/utils/time': { formatDurationToHHMMSS: String },
			'@/utils/toast': {
				success: (message) => toasts.push(message),
				error: (message) => toasts.push(message),
			},
			'./AbLoopTimeline': 'Timeline',
		},
	)
	function unmount() {
		effects.forEach((effect) => effect?.cleanup?.())
		editorKey = undefined
		state = []
		refs = []
		effects = []
		scheduled = []
	}
	function render() {
		const editor = exports.default()
		if (editorKey !== editor.key) {
			unmount()
			editorKey = editor.key
		}
		stateIndex = 0
		refIndex = 0
		effectIndex = 0
		scheduled = []
		const result = editor.type(editor.props)
		for (const { i, callback, deps } of scheduled) {
			effects[i]?.cleanup?.()
			effects[i] = { deps, cleanup: callback() }
		}
		return nodes(result)
	}
	return {
		c,
		closes,
		toasts,
		render,
		unmount,
		async flush() {
			for (let i = 0; i < 5; i++) {
				render()
				await tick()
			}
			return render()
		},
		find: (id) => render().find((node) => node.props?.testID === id),
		timeline: (index) =>
			render().filter((node) => node.type === 'Timeline')[index],
		switchTrack: (id) => {
			trackId = id
			c.setCurrent(id)
		},
		setPosition: (value) => {
			position = value
		},
		setPlaying: (value) => {
			playing = value
		},
		isPlaying: () => playing,
		background: () => {
			appState.currentState = 'background'
			appListeners.forEach((fn) => fn('background'))
		},
		foreground: () => {
			appState.currentState = 'active'
			appListeners.forEach((fn) => fn('active'))
		},
		progress: (pos, dur) => {
			position = pos
			duration = dur
			progressListeners.forEach((fn) => fn({ position: pos, duration: dur }))
		},
	}
}

test('closing and reopening retains edited A/B without saving B automatically', async () => {
	const m = modal()
	await m.flush()
	m.timeline(0).props.onCommit('start', 12)
	m.timeline(0).props.onCommit('end', 30)
	assert.equal(m.c.drafts.getState().draft.start, 12)
	assert.equal(m.c.drafts.getState().draft.end, 30)
	assert.equal(m.c.dbSaved.size, 0)
	m.unmount()
	await m.flush()
	assert.equal(m.c.drafts.getState().draft.start, 12)
	assert.equal(m.c.drafts.getState().draft.end, 30)
	assert.equal(m.c.getActive(), null)
	m.unmount()
})
test('switching tracks discards the previous draft, even when returning', async () => {
	const m = modal()
	await m.flush()
	m.timeline(0).props.onCommit('start', 12)
	m.switchTrack('second')
	await m.flush()
	m.switchTrack('first')
	await m.flush()
	assert.equal(m.c.drafts.getState().draft.start, 10)
	m.unmount()
})
test('preview is temporary and closing restores the saved range', async () => {
	const m = modal({ saved: { start: 60, end: 90 } })
	await m.flush()
	assert.equal(m.c.getActive(), null)
	m.timeline(0).props.onCommit('start', 65)
	await m.find('ab-loop-preview').props.onValueChange(true)
	await m.flush()
	assert.equal(m.c.getActive().start, 65)
	assert.equal(m.c.getPersisted().start, 60)
	assert.equal(m.c.dbSaved.get('first').startPoint, 60)
	assert.equal(m.isPlaying(), false)
	m.unmount()
	await tick()
	assert.equal(m.c.getActive().start, 60)
})
test('scrubbing playback exits preview without changing endpoints', async () => {
	const m = modal()
	await m.flush()
	await m.find('ab-loop-preview').props.onValueChange(true)
	await m.flush()
	await m.timeline(1).props.onCommit('start', 100)
	await m.flush()
	assert.equal(m.c.getActive(), null)
	assert.equal(m.c.drafts.getState().draft.start, 10)
	assert.equal(m.c.drafts.getState().draft.end, 25)
	assert.equal(m.find('ab-loop-preview').props.value, false)
	m.unmount()
})
test('background restores the saved loop; foreground starts in free playback', async () => {
	const m = modal({ saved: { start: 60, end: 90 } })
	await m.flush()
	await m.find('ab-loop-preview').props.onValueChange(true)
	m.background()
	await m.flush()
	assert.equal(m.c.getActive().start, 60)
	assert.equal(m.find('ab-loop-save').props.disabled, true)
	m.foreground()
	await m.flush()
	assert.equal(m.c.getActive(), null)
	assert.equal(m.find('ab-loop-preview').props.value, false)
	m.unmount()
})
test('failed save keeps the window and draft; repeated save submits once', async () => {
	const m = modal()
	await m.flush()
	m.c.failSave()
	await m.find('ab-loop-save').props.onPress()
	await m.flush()
	assert.equal(m.closes.length, 0)
	assert.equal(m.c.drafts.getState().draft.start, 10)
	assert.equal(m.c.dbSaved.size, 0)
	assert.ok(m.find('ab-loop-error'))
	m.unmount()
	const successful = modal()
	await successful.flush()
	successful.setPosition(100)
	const save = successful.find('ab-loop-save')
	await Promise.all([save.props.onPress(), save.props.onPress()])
	await successful.flush()
	assert.equal(
		successful.c.calls.filter(([kind]) => kind === 'db-save').length,
		1,
	)
	assert.equal(successful.closes.length, 1)
	assert.equal(successful.c.getActive().start, 10)
	assert.equal(successful.isPlaying(), false)
	assert.equal(successful.c.drafts.getState().draft, null)
	successful.unmount()
})
for (const operation of ['save', 'clear']) {
	for (const interruption of ['background', 'unmount', 'new-track']) {
		test(`modal ${operation} continues after ${interruption} without closing a newer editor`, async () => {
			const m = modal({ saved: { start: 60, end: 90 } }),
				gate = deferred()
			await m.flush()
			m.c.delayMutation(gate)
			m.find(`ab-loop-${operation}`).props.onPress()
			await tick()
			if (interruption === 'background') m.background()
			else if (interruption === 'unmount') m.unmount()
			else m.switchTrack('second')
			await m.flush()
			gate.resolve()
			await m.flush()
			assert.equal(
				m.c.calls.filter(([kind]) => kind === `db-${operation}`).length,
				1,
			)
			assert.equal(m.c.dbSaved.has('first'), operation === 'save')
			assert.equal(m.closes.length, 0)
			assert.equal(m.toasts.length, 0)
			if (interruption === 'new-track')
				assert.equal(m.c.drafts.getState().draft.trackId, 'second')
			m.unmount()
		})
	}
}
test('modal displays recovery failure and retains the draft', async () => {
	const m = modal({ saved: { start: 60, end: 90 } })
	await m.flush()
	m.c.faultNative('throw', 'reject')
	m.find('ab-loop-save').props.onPress()
	await m.flush()
	assert.equal(
		m.find('ab-loop-error').props.children,
		'未保存，播放状态恢复失败',
	)
	assert.equal(m.closes.length, 0)
	assert.ok(m.c.drafts.getState().draft)
	m.unmount()
})
test('unknown duration disables controls and a late duration initializes the draft', async () => {
	const m = modal({ duration: 0 })
	await m.flush()
	assert.equal(m.find('ab-loop-save').props.disabled, true)
	assert.equal(m.find('ab-loop-play').props.disabled, true)
	m.progress(20, 180)
	await m.flush()
	assert.equal(m.c.drafts.getState().draft.start, 20)
	assert.equal(m.find('ab-loop-save').props.disabled, false)
	m.unmount()
})
test('a shorter reported duration clamps the draft back into editable bounds', async () => {
	const m = modal()
	await m.flush()
	m.progress(5, 12)
	await m.flush()
	assert.equal(m.c.drafts.getState().draft.end, 12)
	assert.equal(m.find('ab-loop-save').props.disabled, false)
	m.unmount()
})

test('point adjustment pushes neighbors and clamps track boundaries', () => {
	for (const duration of [0.005, 0.5, 180]) {
		const initial = ranges.initialAbLoopRange(duration, duration)
		assert.ok(ranges.isAbLoopRangeValid(initial, duration))
		const crossedA = ranges.moveAbLoopPoint(
			initial,
			'start',
			duration + 100,
			duration,
		)
		assert.ok(ranges.isAbLoopRangeValid(crossedA, duration))
		const crossedB = ranges.moveAbLoopPoint(initial, 'end', -100, duration)
		assert.ok(ranges.isAbLoopRangeValid(crossedB, duration))
	}
	assert.equal(ranges.isAbLoopRangeValid({ start: 0, end: NaN }, 180), false)
	assert.equal(ranges.isAbLoopRangeValid({ start: 0, end: 1 }, 0), false)
})
test('an old editor cleanup or preview cannot overwrite a new session', async () => {
	const c = coordinator()
	c.autoReads()
	const old = await c.mod.beginAbLoopEdit('first')
	const current = await c.mod.beginAbLoopEdit('first')
	await c.mod.previewAbLoop(current.token, { start: 30, end: 40 })
	await c.mod.endAbLoopEdit(old.token)
	assert.equal(
		await c.mod.previewAbLoop(old.token, { start: 1, end: 2 }),
		false,
	)
	assert.equal(c.getActive().start, 30)
	await c.mod.saveAbLoop('first', 30, 40, current.token)
	await c.mod.endAbLoopEdit(current.token)
	assert.equal(c.getActive().start, 30)
})
test('same-track start events do not interrupt an active editor', async () => {
	const c = coordinator()
	c.autoReads()
	const edit = await c.mod.beginAbLoopEdit('first')
	const preview = c.mod.previewAbLoop(edit.token, { start: 30, end: 40 })
	await c.mod.applyAbLoopForTrack('first')
	assert.equal(await preview, true)
	assert.equal(c.getActive().start, 30)
})
test('track changes reject stale preview, seek, save and cleanup', async () => {
	const c = coordinator()
	c.autoReads()
	const old = await c.mod.beginAbLoopEdit('first')
	c.setCurrent('second')
	await c.mod.applyAbLoopForTrack('second')
	await c.mod.saveAbLoop('second', 30, 40)
	assert.equal(
		await c.mod.previewAbLoop(old.token, { start: 1, end: 2 }),
		false,
	)
	assert.equal(await c.mod.seekAbLoopEdit(old.token, 10), null)
	assert.equal(
		(await c.mod.saveAbLoop('first', 1, 2, old.token)).status,
		'ignored',
	)
	await c.mod.endAbLoopEdit(old.token)
	assert.equal(c.getActive().trackId, 'second')
})

test('a closed session cannot dispatch a delayed seek or publish stale progress', async () => {
	const duration = deferred(),
		calls = [],
		progress = []
	let current = true
	const seek = load('apps/mobile/src/lib/player/seek.ts', {
		'@bbplayer/orpheus': {
			Orpheus: {
				getCurrentTrack: async () => ({ id: 'first' }),
				getDuration: () => duration.promise,
				getPosition: async () => 10,
				getBuffered: async () => 20,
				seekToForTrack: async (...args) => {
					calls.push(args)
					return true
				},
			},
		},
		'@/lib/player/progressListener': {
			emitSticky: (_, data) => progress.push(data),
		},
	})
	const pending = seek.seekWithinTrack('first', 50, false, () => current)
	current = false
	duration.resolve(180)
	assert.equal(await pending, null)
	assert.equal(calls.length, 0)
	assert.equal(progress.length, 0)
})

test('native track mismatch rejects a seek without optimistic progress', async () => {
	const progress = []
	const seek = load('apps/mobile/src/lib/player/seek.ts', {
		'@bbplayer/orpheus': {
			Orpheus: {
				getCurrentTrack: async () => ({ id: 'first' }),
				getDuration: async () => 180,
				getPosition: async () => 10,
				getBuffered: async () => 20,
				seekToForTrack: async () => false,
			},
		},
		'@/lib/player/progressListener': {
			emitSticky: (_, data) => progress.push(data),
		},
	})
	assert.equal(await seek.seekWithinTrack('first', 50), null)
	assert.equal(progress.length, 0)
})

function databaseService() {
	const sqlite = new DatabaseSync(':memory:', {
		enableDoubleQuotedStringLiterals: true,
	})
	const journal = JSON.parse(
		readFileSync(
			resolve(root, 'apps/mobile/drizzle/meta/_journal.json'),
			'utf8',
		),
	)
	const imports = { './meta/_journal.json': journal }
	assert.equal(journal.entries.length, 24)
	for (const entry of journal.entries) {
		const name = `./${entry.tag}.sql`
		const source = readFileSync(
			resolve(root, 'apps/mobile/drizzle', name),
			'utf8',
		)
		imports[name] = source
		sqlite.exec(source)
	}
	// 检查实际应用注册的迁移，没有漏掉新文件。
	const registered = load('apps/mobile/drizzle/migrations.js', imports).default
	assert.equal(Object.keys(registered.migrations).length, 24)
	assert.equal(registered.migrations.m0023, imports['./0023_ab_loop.sql'])
	sqlite.exec('PRAGMA foreign_keys = ON')
	const schema = load('apps/mobile/src/lib/db/schema.ts', {
		'drizzle-orm': require('drizzle-orm'),
		'drizzle-orm/sqlite-core': require('drizzle-orm/sqlite-core'),
	})
	const db = require('drizzle-orm/sqlite-proxy').drizzle(
		async (sql, params, method) => {
			const statement = sqlite.prepare(sql)
			if (method === 'run') {
				statement.run(...params)
				return { rows: [] }
			}
			statement.setReturnArrays(true)
			return {
				rows:
					method === 'get'
						? statement.get(...params)
						: statement.all(...params),
			}
		},
		{ schema },
	)
	const { TrackService } = load(
		'apps/mobile/src/lib/services/trackService.ts',
		{
			'@sentry/react-native': { startSpan: (_, callback) => callback() },
			'drizzle-orm': require('drizzle-orm'),
			neverthrow: require('neverthrow'),
			'@/lib/db/db': db,
			'@/lib/db/schema': schema,
			'@/lib/errors': { ServiceError: Error },
			'@/lib/errors/service': {
				DatabaseError: Error,
				createValidationError: (msg) => new Error(msg),
			},
			'@/utils/log': logger,
			'./genKey': {},
		},
	)
	return { sqlite, service: new TrackService(db) }
}
test('all 24 migrations execute and register in order', () => {
	const { sqlite } = databaseService()
	assert.equal(sqlite.prepare('PRAGMA foreign_key_check').all().length, 0)
	assert.ok(
		sqlite
			.prepare("SELECT name FROM sqlite_master WHERE name = 'ab_loops'")
			.get(),
	)
	sqlite.close()
})
test('total duration sums actual sessions, including multiple AB rounds', async () => {
	const { sqlite, service } = databaseService()
	sqlite.exec(
		"INSERT INTO tracks (id, unique_key, title, duration, source) VALUES (1, 'track', 'test', 180, 'local')",
	)
	sqlite.exec(`INSERT INTO play_history (track_id, start_time, duration_played, completed) VALUES
        (1, 1000, 91, 1), (1, 2000, 85, 1), (1, 3000, 1, 0)`)
	assert.equal((await service.getTotalPlaybackDuration()).value, 176)
	assert.equal(
		(await service.getTotalPlaybackDuration({ onlyCompleted: false })).value,
		177,
	)
	sqlite.exec('DELETE FROM play_history')
	assert.equal((await service.getTotalPlaybackDuration()).value, 0)
	sqlite.close()
})
test('integer metadata permits one second of tolerance and rejects invalid ranges', async () => {
	const { sqlite, service } = databaseService()
	sqlite.exec(
		"INSERT INTO tracks (id, unique_key, title, duration, source) VALUES (1, 'track', 'test', 180, 'local')",
	)
	for (const [start, end] of [
		[-1, 20],
		[10, NaN],
		[Infinity, 20],
		[10, Infinity],
		[60, 181.001],
		[90, 60],
		[60, 60],
	]) {
		assert.equal(
			(await service.setAbLoopByUniqueKey('track', start, end)).isErr(),
			true,
		)
	}
	assert.equal(
		(await service.setAbLoopByUniqueKey('track', 60.5, 90.5)).isOk(),
		true,
	)
	assert.equal(
		sqlite.prepare('SELECT start_point FROM ab_loops').get().start_point,
		60.5,
	)
	for (const end of [180, 180.4, 181]) {
		assert.equal(
			(await service.setAbLoopByUniqueKey('track', 60, end)).isOk(),
			true,
		)
		assert.equal(
			sqlite.prepare('SELECT end_point FROM ab_loops').get().end_point,
			end,
		)
	}
	sqlite.close()
})

function iosHeadless() {
	const listeners = new Map(),
		events = [],
		current = deferred()
	const { registerOrpheusHeadlessTask } = load(
		'packages/orpheus/src/headless.ts',
		{
			'react-native': { Platform: { OS: 'ios' }, AppRegistry: {} },
			'./ExpoOrpheusModule': {
				TransitionReason: { PLAYLIST_CHANGED: 3 },
				Orpheus: {
					addListener: (name, callback) => listeners.set(name, callback),
					getCurrentTrack: () => current.promise,
				},
			},
		},
	)
	registerOrpheusHeadlessTask(async (event) => {
		events.push(event)
	})
	return { listeners, events, current }
}
test('iOS cold restore enters the same headless handler after subscription', async () => {
	const h = iosHeadless()
	h.current.resolve({ id: 'restored' })
	await tick()
	assert.equal(h.events.length, 1)
	assert.equal(h.events[0].trackId, 'restored')
	assert.equal(h.events[0].eventName, 'onTrackStarted')
})
test('a live start event suppresses the stale cold-start snapshot', async () => {
	const h = iosHeadless()
	h.listeners.get('onTrackStarted')({ trackId: 'new', reason: 2 })
	h.current.resolve({ id: 'old' })
	await tick()
	assert.equal(h.events.length, 1)
	assert.equal(h.events[0].trackId, 'new')
})

// 执行真实 Timeline/Thumb 回调；模拟线程队列，不把这些断言当作帧率测量。
function timelineHarness(initialProps = {}) {
	const scopes = new Map(),
		queue = [],
		reactions = [],
		pendingEffects = []
	let scope,
		index,
		tree,
		props = {
			duration: 100,
			range: { start: 10, end: 30 },
			disabled: false,
			onCommit() {},
			...initialProps,
		}
	function hook(initial) {
		const slot = index++
		if (!(slot in scope)) scope[slot] = initial()
		return scope[slot]
	}
	const mod = load(
		'apps/mobile/src/components/modals/player/AbLoopTimeline.tsx',
		{
			react: {
				useRef: (value) => hook(() => ({ current: value })),
				useEffect: (callback, deps) => {
					const state = hook(() => ({}))
					if (
						!state.deps ||
						deps.some((dep, i) => !Object.is(dep, state.deps[i]))
					) {
						pendingEffects.push(() => {
							state.cleanup?.()
							state.deps = deps
							state.cleanup = callback()
						})
					}
				},
			},
			'react/jsx-runtime': { jsx, jsxs: jsx, Fragment: 'Fragment' },
			'react-native': {
				View: 'View',
				StyleSheet: { create: (styles) => styles },
			},
			'react-native-paper': {
				Text: 'Text',
				useTheme: () => ({
					colors: {},
					fonts: { bodyMedium: {}, titleMedium: {} },
				}),
			},
			'react-native-animateable-text': 'AnimatedText',
			'react-native-gesture-handler': {
				GestureDetector: 'GestureDetector',
				usePanGesture: (options) => options,
			},
			'react-native-reanimated': {
				default: { View: 'AnimatedView' },
				useSharedValue: (value) =>
					hook(() => ({
						value,
						get() {
							return this.value
						},
						set(next) {
							this.value = next
						},
					})),
				useAnimatedStyle: (read) => ({ read }),
				useAnimatedProps: (read) => ({ read }),
				useAnimatedReaction: (prepare, react) =>
					reactions.push(() => react(prepare())),
			},
			'react-native-worklets': {
				scheduleOnRN: (fn, ...args) => queue.push(() => fn(...args)),
				scheduleOnUI: (fn) => fn(),
			},
			'@/lib/player/abLoopDraft': ranges,
			'@/utils/time': { formatDurationToHHMMSS: (seconds) => String(seconds) },
		},
	)
	function expand(node) {
		if (Array.isArray(node)) return node.map(expand)
		if (!node || typeof node !== 'object') return node
		if (typeof node.type === 'function') {
			const key = node.type.name + (node.props.point ?? '')
			scope = scopes.get(key) ?? []
			scopes.set(key, scope)
			index = 0
			return expand(node.type(node.props))
		}
		return {
			...node,
			props: { ...node.props, children: expand(node.props.children) },
		}
	}
	function sync() {
		reactions.forEach((reaction) => reaction())
	}
	function render(nextProps = {}) {
		props = { ...props, ...nextProps }
		reactions.length = 0
		tree = expand(jsx(mod.default, props))
		pendingEffects.splice(0).forEach((effect) => effect())
		sync()
		const rail = nodes(tree).find((node) => node.props.onLayout)
		rail.props.onLayout({ nativeEvent: { layout: { width: 148 } } })
	}
	render()
	return {
		render,
		sync,
		queue,
		gesture: (i = 0) =>
			nodes(tree).filter((node) => node.type === 'GestureDetector')[i].props
				.gesture,
		x: (i = 0) =>
			nodes(tree)
				.filter((node) => node.props.testID?.startsWith('ab-loop-thumb-'))
				.at(i)
				.props.style.at(-1)
				.read().transform[0].translateX,
		label: () =>
			nodes(tree)
				.find((node) => node.props.testID === 'ab-loop-range')
				.props.animatedProps.read().text,
		async flush() {
			for (const fn of queue.splice(0)) await fn()
			sync()
		},
		unmount() {
			scopes.forEach((slots) => slots.forEach((slot) => slot?.cleanup?.()))
		},
	}
}

test('100 drag updates stay on UI; release commits pushed endpoints together once', async () => {
	const commits = []
	const h = timelineHarness({
		onCommit: (...args) => {
			commits.push(args)
			return args[2]
		},
	})
	const g = h.gesture()
	g.onActivate()
	for (let i = 1; i <= 100; i++) {
		g.onUpdate({ translationX: i * 0.4 })
		h.sync()
	}
	assert.equal(h.queue.length, 0)
	assert.equal(commits.length, 0)
	assert.equal(h.x(), 50)
	assert.ok(Math.abs(h.x(1) - 50.001) < 1e-9)
	assert.equal(h.label(), '50.0 — 50.0')
	// 回拖只调整 A，已经被推开的 B 保持原位。
	g.onUpdate({ translationX: 10 })
	assert.equal(h.x(), 20)
	g.onDeactivate({ canceled: false })
	assert.equal(h.queue.length, 1)
	await h.flush()
	assert.equal(commits.length, 1)
	assert.equal(commits[0][2].start, 20)
	// 父组件的 React effect 尚未执行，也必须保持提交后的坐标。
	assert.equal(h.x(), 20)
	assert.ok(Math.abs(h.x(1) - 50.001) < 1e-9)
	assert.ok(Math.abs(commits[0][2].end - 50.001) < 1e-9)
})

test('canceling a pushed range restores both endpoints and submits nothing', async () => {
	const h = timelineHarness()
	const g = h.gesture()
	g.onActivate()
	g.onUpdate({ translationX: 50 })
	g.onDeactivate({ canceled: true })
	h.sync()
	assert.equal(h.x(), 10)
	assert.equal(h.x(1), 30)
	assert.equal(h.queue.length, 0)
	// B 的向左推移也保持 A/B 标签，触底后保留一毫秒间隔。
	const b = h.gesture(1)
	b.onActivate()
	b.onUpdate({ translationX: -100 })
	assert.equal(h.x(), 0)
	assert.equal(h.x(1), 0.001)
	b.onDeactivate({ canceled: true })
})

test('another thumb cannot take over an active range gesture', () => {
	const h = timelineHarness(),
		a = h.gesture(),
		b = h.gesture(1)
	a.onActivate()
	a.onUpdate({ translationX: 5 })
	b.onActivate()
	b.onUpdate({ translationX: -25 })
	b.onDeactivate({ canceled: false })
	assert.equal(h.x(), 15)
	assert.equal(h.x(1), 30)
	assert.equal(h.queue.length, 0)
	a.onDeactivate({ canceled: true })
})

test('playback ticks cannot overwrite dragging or an outstanding seek', async () => {
	const seek = deferred()
	const h = timelineHarness({
		range: undefined,
		position: 10,
		onCommit: () => seek.promise,
	})
	let g = h.gesture()
	g.onActivate()
	g.onUpdate({ translationX: 50 })
	h.render({ position: 11 })
	assert.equal(h.x(), 60)
	g = h.gesture()
	g.onDeactivate({ canceled: false })
	const flush = h.flush()
	h.render({ position: 12, disabled: true })
	assert.equal(h.x(), 60)
	h.render({ position: 60, disabled: false })
	seek.resolve({ start: 60, end: 100 })
	await flush
	assert.equal(h.x(), 60)
})

test('queued release is ignored after disable or unmount', async () => {
	for (const unmount of [false, true]) {
		const commits = [],
			h = timelineHarness({
				onCommit: (...args) => {
					commits.push(args)
					return args[2]
				},
			}),
			g = h.gesture()
		g.onActivate()
		g.onUpdate({ translationX: 5 })
		g.onDeactivate({ canceled: false })
		if (unmount) h.unmount()
		else h.render({ disabled: true })
		await h.flush()
		assert.equal(commits.length, 0)
	}
})

test('release saves the complete pushed draft and preview applies once', async () => {
	const m = modal()
	await m.flush()
	await m.find('ab-loop-preview').props.onValueChange(true)
	await m.flush()
	const before = m.c.calls.filter(([kind]) => kind === 'preview').length
	await m.timeline(0).props.onCommit('start', 20, { start: 20, end: 40 })
	await m.flush()
	assert.equal(m.c.drafts.getState().draft.end, 40)
	assert.equal(m.c.getActive().end, 40)
	assert.equal(
		m.c.calls.filter(([kind]) => kind === 'preview').length,
		before + 1,
	)
	assert.equal(m.c.dbSaved.size, 0)
	m.unmount()
})

test('typed endpoint updates the draft and active preview without saving', async () => {
	const m = modal()
	await m.flush()
	await m.find('ab-loop-preview').props.onValueChange(true)
	await m.flush()
	assert.equal(m.timeline(0).props.onEditPoint, undefined)
	m.find('ab-loop-edit-end').props.onPress()
	m.find('ab-loop-point-input').props.onChangeText('42.6')
	m.find('ab-loop-point-confirm').props.onPress()
	await m.flush()
	assert.equal(m.c.drafts.getState().draft.end, 42.6)
	assert.equal(m.c.getActive().end, 42.6)
	assert.equal(m.c.dbSaved.size, 0)
	assert.equal(m.find('ab-loop-point-input'), undefined)
	m.unmount()
})

test('invalid endpoint input and cancellation leave the draft unchanged', async () => {
	const m = modal()
	await m.flush()
	const before = m.c.drafts.getState().draft
	m.find('ab-loop-edit-start').props.onPress()
	for (const value of ['', 'abc', '-1', '181', 'Infinity']) {
		m.find('ab-loop-point-input').props.onChangeText(value)
		m.find('ab-loop-point-confirm').props.onPress()
		assert.equal(m.find('ab-loop-point-input').props.error, true)
		assert.equal(m.c.drafts.getState().draft, before)
	}
	m.find('ab-loop-point-input').props.onChangeText('12.5')
	m.find('ab-loop-point-cancel').props.onPress()
	assert.equal(m.find('ab-loop-point-input'), undefined)
	assert.equal(m.c.drafts.getState().draft, before)
	m.unmount()
})

test('one-decimal endpoint display rounds across a second without changing the range', () => {
	const range = { start: 59.96, end: 80.123 }
	const h = timelineHarness({ range })
	assert.equal(h.label(), '60.0 — 80.1')
	assert.equal(h.x(), 59.96)
	assert.equal(h.x(1), 80.123)
	h.unmount()
})
