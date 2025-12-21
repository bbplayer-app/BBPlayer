import type { ProjectScope } from '@/types/core/scope'
import * as Sentry from '@sentry/react-native'
import { Cause, Effect, Option } from 'effect'
import * as EXPOFS from 'expo-file-system'
import type { transportFunctionType } from 'react-native-logs'
import {
	fileAsyncTransport,
	logger,
	mapConsoleTransport,
} from 'react-native-logs'

const isDev = __DEV__

const sentryBreadcrumbTransport: transportFunctionType<object> = (props) => {
	Sentry.addBreadcrumb({
		category: 'log',
		level: props.level.text as Sentry.SeverityLevel,
		message: props.msg,
	})
}

const config = {
	severity: isDev ? 'debug' : 'info',
	transport: isDev
		? [mapConsoleTransport, fileAsyncTransport]
		: [sentryBreadcrumbTransport, fileAsyncTransport],
	levels: {
		debug: 0,
		info: 1,
		warning: 2,
		error: 3,
	},
	transportOptions: {
		FS: EXPOFS,
		fileName: '{date-today}.log',
		fileNameDateType: 'iso' as const,
		filePath: `${EXPOFS.Paths.document.uri}logs`,
		mapLevels: {
			debug: 'log',
			info: 'info',
			warning: 'warn',
			error: 'error',
		},
	},
	asyncFunc: setImmediate,
	async: true,
}

const logInstance = logger.createLogger(config)

const isTaggedError = (u: unknown): u is { _tag: string } & Error => {
	return u instanceof Error && '_tag' in u
}

/**
 * 递归展平错误信息，专门适配 TaggedError
 * 格式示例: [UserNotFoundError] id=123 :: [DatabaseError] connection failed
 */
export function flatErrorMessage(
	error: unknown,
	separator = ' :: ',
	_temp: string[] = [],
	_depth = 0,
	maxDepth = 10,
): string {
	if (_depth >= maxDepth) {
		_temp.push('[error depth exceeded]')
		return _temp.join(separator)
	}

	if (error instanceof Error) {
		let msg = error.message

		if (isTaggedError(error)) {
			msg = `[${error._tag}] ${msg}`
		}

		_temp.push(msg)

		if (error.cause) {
			return flatErrorMessage(error.cause, separator, _temp, _depth + 1)
		}
	} else {
		_temp.push(String(error))
	}

	return _temp.join(separator)
}

/**
 * 提取 TaggedError 的有效载荷用于 Sentry Extra
 */
function extractErrorExtras(error: unknown): Record<string, unknown> {
	if (isTaggedError(error)) {
		// eslint-disable-next-line @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-explicit-any
		const { name, message, stack, cause, _tag, ...rest } = error as any
		// eslint-disable-next-line @typescript-eslint/no-unsafe-return
		return rest
	}
	return {}
}

/**
 * 将 Error 上报到 Sentry
 * 支持传入 Error, TaggedError
 */
export function reportErrorToSentry(
	errorOrCause: unknown,
	message?: string,
	scope?: ProjectScope | string,
) {
	if (Cause.isCause(errorOrCause)) {
		logInstance.error(`[Cause] ${message ?? ''}`, Cause.pretty(errorOrCause))

		const failureOption = Cause.failureOption(errorOrCause)
		if (Option.isSome(failureOption)) {
			reportErrorToSentry(failureOption.value, message, scope)
			return
		}
		const defectOption = Cause.dieOption(errorOrCause)
		if (Option.isSome(defectOption)) {
			reportErrorToSentry(defectOption.value, `[Defect] ${message}`, scope)
			return
		}
		return
	}

	const _error =
		errorOrCause instanceof Error
			? errorOrCause
			: new Error(`非 Error 类型错误：${String(errorOrCause)}`, {
					cause: errorOrCause,
				})

	const tags: Record<string, string | number | boolean | undefined> = {
		appScope: scope,
	}

	if (isTaggedError(_error)) {
		tags.errorType = _error._tag
	}

	const extra: Record<string, unknown> = {
		message,
		...extractErrorExtras(_error),
	}

	const id = Sentry.captureException(_error, { tags, extra })
	if (isDev) logInstance.debug(`[Sentry] Error reported, id: ${id}`)
}

/**
 * 清理 {keepDays} 天之前的日志文件
 */
export const cleanOldLogFiles = (keepDays = 7) =>
	Effect.gen(function* () {
		const logDir = new EXPOFS.Directory(EXPOFS.Paths.document, 'logs')

		const exists = yield* Effect.try(() => logDir.exists)

		if (!exists) {
			logInstance.debug('日志目录不存在，无需清理')
			return 0
		}

		const fileNames = yield* Effect.try(() =>
			logDir
				.list()
				.filter((f) => f instanceof EXPOFS.File)
				.map((f) => f.name),
		)

		const cutoffDate = new Date()
		cutoffDate.setHours(0, 0, 0, 0)
		cutoffDate.setDate(cutoffDate.getDate() - keepDays + 1)
		const re = /^(\d{4}-\d{1,2}-\d{1,2})\.log$/

		let deletedCount = 0

		for (const name of fileNames) {
			const m = re.exec(name)
			if (!m) continue

			const fileDate = new Date(m[1])
			if (Number.isNaN(fileDate.getTime())) continue

			if (fileDate < cutoffDate) {
				// 单个文件删除失败不应该阻断整个流程，所以我们在内部处理错误
				yield* Effect.try(() => {
					const file = new EXPOFS.File(logDir, name)
					file.delete()
					deletedCount++
				}).pipe(
					Effect.catchAll((e) =>
						Effect.sync(() => {
							logInstance.warning('删除旧日志文件失败', {
								file: name,
								error: String(e),
							})
						}),
					),
				)
			}
		}

		return deletedCount
	}).pipe(
		Effect.catchAll((e) =>
			Effect.sync(() => {
				logInstance.error('清理日志流程异常', { error: String(e) })
				return 0
			}),
		),
	)

try {
	const dir = new EXPOFS.Directory(EXPOFS.Paths.document, 'logs')
	if (!dir.exists) {
		dir.create()
		logInstance.debug('成功创建日志目录')
	}
} catch (e) {
	logInstance.error('创建日志目录失败', { error: String(e) })
}

export default logInstance
