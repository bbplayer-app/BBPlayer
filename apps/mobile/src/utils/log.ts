import type { transportFunctionType } from '@roitium/react-native-logs'
import {
	fileAsyncTransport,
	logger,
	mapConsoleTransport,
} from '@roitium/react-native-logs'
import * as Sentry from '@sentry/react-native'
import * as EXPOFS from 'expo-file-system'
import { err, ok, type Result } from 'neverthrow'

import { CustomError } from '@/lib/errors'
import type { ProjectScope } from '@/types/core/scope'

const isDev = __DEV__

const sentryBreadcrumbTransport: transportFunctionType<object> = (props) => {
	Sentry.addBreadcrumb({
		category: 'log',
		level: props.level.text as Sentry.SeverityLevel,
		message: props.msg,
	})
}

// 创建 Logger 实例
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
			log.debug('日志目录不存在，无需清理')
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
					log.warning('删除旧日志文件失败', {
						file: file.uri,
						error: String(e),
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

export function reportErrorToSentry(
	error: unknown,
	message?: string,
	scope?: ProjectScope | string,
) {
	const _error =
		error instanceof Error
			? error
			: new Error(`非 Error 类型错误：${String(error)}`, { cause: error })

	const isCustom = _error instanceof CustomError

	const tags: Record<string, string | number | boolean | undefined> = {
		appScope: scope,
	}
	if (isCustom && typeof _error.type === 'string') {
		tags.errorType = _error.type
	}

	const extra: Record<string, unknown> = { message }
	if (isCustom && _error.data !== undefined) {
		extra.errorData = _error.data
	}

	const id = Sentry.captureException(_error, { tags, extra })
	log.error(`已上报错误到 sentry，id: ${id}`)
}

try {
	new EXPOFS.Directory(EXPOFS.Paths.document, 'logs').create({
		intermediates: true,
		idempotent: true,
	})
	console.log('成功创建日志目录')
} catch (e) {
	console.log('创建日志目录失败', e)
}
const log = logger.createLogger(config)

export default log
