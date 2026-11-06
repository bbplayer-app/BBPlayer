'use strict'

const {
	fileAsyncTransport,
	flushFileAsyncTransport,
	logger,
} = require('../dist/index.js')

function delayedFileSystem() {
	const writes = []
	let release
	let closed = 0
	let active = 0
	let peak = 0
	const blocked = new Promise((resolve) => {
		release = resolve
	})
	class File {
		exists = true
		open() {
			return {
				size: 0,
				offset: 0,
				async writeBytes(bytes) {
					active += 1
					peak = Math.max(peak, active)
					await blocked
					writes.push(new TextDecoder().decode(bytes))
					active -= 1
				},
				close() {
					closed += 1
				},
			}
		}
	}
	return {
		FS: { File, Paths: { document: '/logs' } },
		writes,
		release: () => release(),
		get closed() {
			return closed
		},
		get peak() {
			return peak
		},
	}
}

function append(fixture, msg) {
	return fileAsyncTransport({
		msg,
		rawMsg: [msg],
		level: { text: 'info', severity: 1 },
		extension: null,
		options: { FS: fixture.FS },
	})
}

test('flush waits for queued appends and handle closure, preserving order', async () => {
	const fixture = delayedFileSystem()
	append(fixture, 'first')
	append(fixture, 'second')
	let finished = false
	const flushed = flushFileAsyncTransport().then(() => {
		finished = true
	})
	await new Promise(setImmediate)
	expect(finished).toBe(false)
	expect(fixture.closed).toBe(0)
	fixture.release()
	await flushed
	expect(fixture.writes).toEqual(['first\n', 'second\n'])
	expect(fixture.closed).toBe(2)
	expect(fixture.peak).toBe(1)
})

test('slow storage has a bounded queue and drops new entries in order', async () => {
	const fixture = delayedFileSystem()
	for (let i = 0; i < 600; i += 1) append(fixture, String(i))
	fixture.release()
	await flushFileAsyncTransport()
	expect(fixture.writes).toEqual(
		Array.from({ length: 256 }, (_, i) => `${i}\n`),
	)
	expect(fixture.peak).toBe(1)
})

test('oversized messages are dropped without blocking future appends', async () => {
	const fixture = delayedFileSystem()
	append(fixture, 'x'.repeat(512 * 1024 + 1))
	append(fixture, 'kept')
	fixture.release()
	await flushFileAsyncTransport()
	expect(fixture.writes).toEqual(['kept\n'])
})

test('the logger scheduling barrier includes async callbacks before flushing', async () => {
	const fixture = delayedFileSystem()
	const log = logger.createLogger({
		async: true,
		asyncFunc: setImmediate,
		transport: fileAsyncTransport,
		transportOptions: { FS: fixture.FS },
	})
	log.info('scheduled log')
	await new Promise(setImmediate)
	const flushed = flushFileAsyncTransport()
	fixture.release()
	await flushed
	expect(fixture.writes.join('')).toContain('scheduled log')
})
