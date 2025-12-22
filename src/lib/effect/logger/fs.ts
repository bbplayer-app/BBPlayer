import { Effect, Layer, Logger, pipe, Queue } from 'effect'
import * as FileSystem from 'expo-file-system'

const getTodayFilename = () => {
	const today = new Date()
	const d = today.getDate()
	const m = today.getMonth() + 1
	const y = today.getFullYear()
	return `${y}-${m}-${d}.log`
}

const makeFileWorker = (queue: Queue.Queue<string>) => {
	const fileName = getTodayFilename()

	const processLog = (msg: string) =>
		Effect.gen(function* () {
			const file = new FileSystem.File(
				FileSystem.Paths.document,
				'logs',
				fileName,
			)

			yield* Effect.sync(() => {
				try {
					if (!file.exists) {
						file.create({ intermediates: true })
					}
				} catch (_e) {
					// 忽略
				}
			})

			yield* Effect.acquireUseRelease(
				Effect.try({
					try: () => file.open(),
					catch: (e) => new Error(`无法打开日志文件`, { cause: e }),
				}),

				(fileHandler) =>
					Effect.try({
						try: () => {
							const size =
								typeof fileHandler.size === 'number' ? fileHandler.size : 0
							fileHandler.offset = size

							const encoder = new TextEncoder()
							const bytes = encoder.encode(msg)
							console.log('写入日志:', msg.trim())

							fileHandler.writeBytes(bytes)
						},
						catch: (e) => new Error(`写入日志失败`, { cause: e }),
					}),

				(fileHandler) =>
					Effect.sync(() => {
						try {
							fileHandler.close()
						} catch (e) {
							console.warn('关闭文件句柄失败', e)
						}
					}),
			)
		}).pipe(
			Effect.catchAll((error) =>
				Effect.sync(() => console.error('Logger Worker Error:', error)),
			),
		)

	return Queue.take(queue).pipe(Effect.flatMap(processLog), Effect.forever)
}

export const makeExpoFileLogger = () => {
	return Layer.unwrapScoped(
		Effect.gen(function* () {
			const queue = yield* Queue.unbounded<string>()

			yield* pipe(makeFileWorker(queue), Effect.forkScoped)

			yield* Effect.sync(() => {
				console.log('日志文件已创建')
			})

			const fileLogger = Logger.make(({ message, date, logLevel }) => {
				const timestamp = date.toISOString()
				const content = Array.isArray(message)
					? message.join(' ')
					: String(message)
				const logLine = `[${timestamp}] [${logLevel.label}] ${content}\n`
				Queue.unsafeOffer(queue, logLine)
			})

			return Logger.add(fileLogger)
		}),
	)
}
