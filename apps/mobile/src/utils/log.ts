import type { transportFunctionType } from '@bbplayer/logs'
import {
	fileAsyncTransport,
	flushFileAsyncTransport,
	logger,
	mapConsoleTransport,
} from '@bbplayer/logs'
import * as Sentry from '@sentry/react-native'
import * as EXPOFS from 'expo-file-system'
import { err, ok, type Result } from 'neverthrow'

import { CustomError } from '@/lib/errors'
import type { ProjectScope } from '@/types/core/scope'

const isDev = __DEV__

/** Drain scheduled logger callbacks before waiting for their file writes. */
export async function flushLogs(): Promise<void> {
	await new Promise<void>((resolve) => setImmediate(resolve))
	await flushFileAsyncTransport()
}

// oxlint-disable-next-line anti-slop/no-unknown-parameters -- 日志边界接收 catch 的任意异常，并在这里规范化。
const stringifyError = (e: unknown): string => {
	if (e === null) return 'null'

	// oxlint-disable-next-line @typescript-eslint/no-base-to-string
	if (typeof e !== 'object') return String(e)

	try {
		return JSON.stringify(e)
	} catch {
		// Circular reference or other stringify error
		return Object.prototype.toString.call(e)
	}
}

/** 事件名使用稳定的 domain.action；变量只放在属性里。 */
export type LogEvent = `${Lowercase<string>}.${Lowercase<string>}`

export type LogValue =
	| string
	| number
	| boolean
	| readonly (string | number | boolean)[]

export type LogAttributes = Readonly<
	Partial<Record<`${string}.${string}`, LogValue | null>>
>

// oxlint-disable-next-line anti-slop/no-unknown-parameters -- catch 的异常由统一入口规范化为 error.type/error.message。
type LogMethod = (
	event: LogEvent,
	attributes?: LogAttributes,
	error?: unknown,
) => void

export interface StructuredLogger {
	debug: LogMethod
	info: LogMethod
	warning: LogMethod
	error: LogMethod
	setSeverity: (level: 'debug' | 'info') => void
	extend: (scope: string) => StructuredLogger
}

/** 所有输出共用同一份事件和字段，本地文件也不再拼接动态消息。 */
// oxlint-disable-next-line anti-slop/no-unknown-parameters -- transport 的未知参数只由下方受类型约束的 sink 写入。
function toStructuredLog(rawMsg: unknown, extension?: string | null) {
	// SAFETY: transportLogger 是模块私有的，所有写入均由 createStructuredLogger 传入 event 和扁平 fields。
	const [message, fields] = rawMsg as [LogEvent, LogAttributes]
	const attributes = { ...fields }

	if (extension) attributes['log.scope'] = extension

	return {
		message,
		attributes,
	}
}

const sentryBreadcrumbTransport: transportFunctionType<object> = (props) => {
	const { message, attributes } = toStructuredLog(props.rawMsg, props.extension)

	Sentry.addBreadcrumb({
		category: props.extension ? `log.${props.extension}` : 'log',
		level:
			props.level.text === 'debug'
				? 'debug'
				: props.level.text === 'info'
					? 'info'
					: props.level.text === 'warning'
						? 'warning'
						: 'error',
		message,
		data: attributes,
	})
}

const sentryLogTransport: transportFunctionType<object> = (props) => {
	const { message, attributes } = toStructuredLog(props.rawMsg, props.extension)

	switch (props.level.text) {
		case 'debug':
			Sentry.logger.debug(message, attributes)
			break
		case 'info':
			Sentry.logger.info(message, attributes)
			break
		case 'warning':
			Sentry.logger.warn(message, attributes)
			break
		default:
			Sentry.logger.error(message, attributes)
	}
}

// 创建 Logger 实例
const config = {
	severity: isDev ? 'debug' : 'info',
	transport: isDev
		? [mapConsoleTransport, fileAsyncTransport]
		: [sentryBreadcrumbTransport, sentryLogTransport, fileAsyncTransport],
	levels: {
		debug: 0,
		info: 1,
		warning: 2,
		error: 3,
	},
	transportOptions: {
		FS: EXPOFS,
		fileName: '{date-today}.log',
		// 日期命名格式 YYYY-M-D（**无零填充**）
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

/**
 * 清理 {keepDays} 天之前的日志文件
 * @param keepDays 保留最近几天的日志，默认为 7 天
 */
export function cleanOldLogFiles(keepDays = 7): Result<number, Error> {
	try {
		const logDir = new EXPOFS.Directory(EXPOFS.Paths.document, 'logs')

		if (!logDir.exists) {
			log.debug('logs.directory.absent')

			return ok(0)
		}

		const list = logDir
			.list()
			.filter((f) => f instanceof EXPOFS.File)
			.map((f) => f.name)

		const cutoffDate = new Date()
		cutoffDate.setHours(0, 0, 0, 0)
		cutoffDate.setDate(cutoffDate.getDate() - keepDays + 1)

		const re = /^(\d{4}-\d{1,2}-\d{1,2})\.log$/

		let deleted = 0

		for (const name of list) {
			const m = re.exec(name)

			if (!m) continue

			const fileDate = new Date(m[1])

			if (Number.isNaN(fileDate.getTime())) continue

			if (fileDate < cutoffDate) {
				const file = new EXPOFS.File(logDir, name)

				try {
					file.delete()
					deleted += 1
				} catch (e) {
					log.warning('logs.file.delete_failed', {
						'logs.file': file.uri,
						'error.message': String(e),
					})
				}
			}
		}

		return ok(deleted)
	} catch (e) {
		return err(e instanceof Error ? e : new Error(String(e)))
	}
}

/**
 * 将 Error 对象的 message、cause 递归展开为字符串，类似于 golang 的错误链
 * @param error 任何 Error 的子类
 * @param separator 分隔符
 * @param maxDepth 最大递归深度
 * @returns 一个用 separator 拼接的字符串
 */

export function flatErrorMessage(
	error: Error,
	separator = ':: ',
	_temp: string[] = [],
	_depth = 0,
	maxDepth = 10,
) {
	_temp.push(error.message)

	if (_depth >= maxDepth) {
		_temp.push('[error depth exceeded]')

		return _temp.join(separator)
	}

	if (error.cause) {
		if (error.cause instanceof Error) {
			flatErrorMessage(error.cause, separator, _temp, _depth + 1)
		}
	}

	return _temp.join(separator)
}

/**
 * 将 Error 上报到 Sentry
 * @param error
 * @param scope 项目不同分区
 * @param message 附加信息
 */
// oxlint-disable-next-line anti-slop/no-unknown-parameters -- 接收调用方捕获的未知异常，下面先转换为 Error。
export function reportErrorToSentry(
	error: unknown,
	message?: string,
	scope?: ProjectScope | string,
) {
	const normalizedError =
		error instanceof Error
			? error
			: new Error(`非 Error 类型错误：${stringifyError(error)}`, {
					cause: error,
				})

	const isCustom = normalizedError instanceof CustomError

	const tags: Record<string, string | number | boolean | undefined> = {
		appScope: scope,
	}

	if (isCustom && typeof normalizedError.type === 'string') {
		tags.errorType = normalizedError.type
	}

	const extra: Record<string, unknown> = { message }

	if (isCustom && normalizedError.data !== undefined) {
		extra.errorData = normalizedError.data
	}

	const id = Sentry.captureException(normalizedError, { tags, extra })
	log.debug('sentry.exception.captured', { 'sentry.event_id': id })
}

try {
	new EXPOFS.Directory(EXPOFS.Paths.document, 'logs').create({
		intermediates: true,
		idempotent: true,
	})
} catch {}

const transportLogger = logger.createLogger(config)

function createStructuredLogger(scope?: string): StructuredLogger {
	const sink = scope ? transportLogger.extend(scope) : transportLogger

	const write =
		(level: 'debug' | 'info' | 'warning' | 'error'): LogMethod =>
		(event, attributes = {}, error) => {
			const fields: Record<string, LogValue> = {}

			for (const [key, value] of Object.entries(attributes)) {
				if (value != null) fields[key] = value
			}

			if (error != null) {
				fields['error.type'] =
					error instanceof CustomError
						? (error.type ?? error.name)
						: error instanceof Error
							? error.name
							: 'UnknownError'
				fields['error.message'] =
					error instanceof Error
						? flatErrorMessage(error)
						: stringifyError(error)
			}

			sink[level](event, fields)
		}

	return {
		setSeverity: (level) => {
			transportLogger.setSeverity(level)
		},
		debug: write('debug'),
		info: write('info'),
		warning: write('warning'),
		error: write('error'),
		extend: (child) =>
			createStructuredLogger(scope ? `${scope}.${child}` : child),
	}
}

const log = createStructuredLogger()

export default log
