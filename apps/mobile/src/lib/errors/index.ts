export class CustomError extends Error {
	readonly type?: string | undefined
	readonly data?: unknown
	constructor(
		message: string,
		opts?: { type?: string | undefined; data?: unknown; cause?: unknown },
	) {
		super(message, { cause: opts?.cause })
		this.name = this.constructor.name
		this.type = opts?.type
		this.data = opts?.data
	}
}

export class ServiceError extends CustomError {}

export class FacadeError extends CustomError {}

export class UIError extends CustomError {}

export class ThirdPartyError extends CustomError {
	readonly vendor?: string | undefined
	readonly type?: string | undefined
	readonly data?: unknown
	constructor(
		message: string,
		opts?: {
			vendor?: string | undefined
			type?: string | undefined
			data?: unknown
			cause?: unknown
		},
	) {
		super(message, { type: opts?.type, data: opts?.data, cause: opts?.cause })
		this.vendor = opts?.vendor
		this.type = opts?.type
		this.data = opts?.data
	}
}

export class DatabaseError extends CustomError {}
export class DataParsingError extends CustomError {}
export class FileSystemError extends CustomError {}
export class LrcParseError extends CustomError {
	constructor(message: string) {
		super(message, { type: 'LrcParseError' })
	}
}

export class LyricNotFoundError extends CustomError {
	constructor(message: string, opts?: { cause?: unknown }) {
		super(message, { type: 'LyricNotFound', cause: opts?.cause })
	}
}
