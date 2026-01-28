import { CustomError } from '@/lib/errors'

import log, { flatErrorMessage } from './log'
import toast from './toast'

/**
 * 将错误消息和错误堆栈信息显示在 toast 上，并将错误信息记录到日志中（用于最顶端的调用者消费错误）
 * @param error 原始错误对象
 * @param message 需要显示的信息
 * @param scope 日志作用域
 */
export function toastAndLogError(
	message: string,
	error: unknown,
	scope: string,
) {
	if (error instanceof CustomError) {
		toast.error(`${message} -- ${error.type}`, {
			description: flatErrorMessage(error),
			duration: Number.POSITIVE_INFINITY,
		})
		log
			.extend(scope)
			.error(`${message} -- ${error.type}: ${flatErrorMessage(error)}`)
	} else if (error instanceof Error) {
		toast.error(message, {
			description: flatErrorMessage(error),
			duration: Number.POSITIVE_INFINITY,
		})
		log.extend(scope).error(`${message}: ${flatErrorMessage(error)}`)
	} else if (error === undefined) {
		toast.error(message, {
			duration: Number.POSITIVE_INFINITY,
		})
	} else {
		toast.error(message, {
			description: String(error as unknown),
			duration: Number.POSITIVE_INFINITY,
		})
		log.extend(scope).error(`${message}`, error)
	}
}
