import type { transportFunctionType } from '../index'

const MAX_PENDING_LOGS = 256
const MAX_PENDING_CHARACTERS = 512 * 1024
const pendingWrites = new Set<Promise<boolean>>()
const drainWaiters = new Set<() => void>()

// Drop new entries on overflow; retain the already queued diagnostics in order.
function hasQueueCapacity(queue: Array<{ msg: string }>, msg: string): boolean {
	return (
		queue.length < MAX_PENDING_LOGS &&
		queue.reduce((total, item) => total + item.msg.length, msg.length) <=
			MAX_PENDING_CHARACTERS
	)
}

function notifyDrained() {
	if (EXPOqueue.length || EXPONEXTFSqueue.length) return
	for (const resolve of drainWaiters) resolve()
	drainWaiters.clear()
}

/** Wait for transport calls and queued file appends already submitted to finish. */
export async function flushFileAsyncTransport(): Promise<void> {
	while (pendingWrites.size || EXPOqueue.length || EXPONEXTFSqueue.length) {
		if (pendingWrites.size) {
			await Promise.all([...pendingWrites])
		} else {
			await new Promise<void>((resolve) => drainWaiters.add(resolve))
		}
	}
}

type RNFS = {
	DocumentDirectoryPath: string
	documentDirectory: never
	writeAsStringAsync: undefined
	appendFile: (
		filepath: string,
		contents: string,
		encoding?: string,
	) => Promise<void>
}
type EXPOFS = {
	documentDirectory: string | null
	DocumentDirectoryPath: never
	writeAsStringAsync: (
		fileUri: string,
		contents: string,
		options?: object,
	) => Promise<void>
	readAsStringAsync?: (fileUri: string, options?: object) => Promise<string>
	getInfoAsync?: (
		fileUri: string,
		options?: object,
	) => Promise<{ exists: boolean }>
	appendFile: undefined
}
type EXPONEXTFS = {
	File: new (...args: string[]) => {
		uri: string
		name: string
		exists: boolean
		create: (options?: { intermediates?: boolean; overwrite?: boolean }) => void
		open: () => {
			writeBytes: (data: Uint8Array) => void | Promise<void>
			close: () => void
			size: number | null
			offset: number | null
		}
	}
	Paths: any
}

interface EXPOqueueitem {
	FS: Required<EXPOFS>
	file: string
	msg: string
}

let EXPOqueue: Array<EXPOqueueitem> = []
let EXPOelaborate = false

interface EXPONEXTFSqueueitem {
	FS: Required<EXPONEXTFS>
	file: string
	msg: string
}

const EXPOFSreadwrite = async () => {
	if (EXPOqueue.length === 0) return

	EXPOelaborate = true
	const item = EXPOqueue[0]

	try {
		const prevFile =
			(await item.FS.readAsStringAsync(item.file).catch(() => '')) || ''
		const newMsg = prevFile + item.msg
		await item.FS.writeAsStringAsync(item.file, newMsg)
	} catch (error) {
		console.error('Failed to write log to file (expo legacy):', error)
	} finally {
		EXPOelaborate = false
		EXPOqueue.shift()
		if (EXPOqueue.length > 0) {
			EXPOFSreadwrite().then()
		}
		notifyDrained()
	}
}

const EXPOcheckqueue = async (
	FS: Required<EXPOFS>,
	file: string,
	msg: string,
) => {
	if (!hasQueueCapacity(EXPOqueue, msg)) return false
	EXPOqueue.push({ FS, file, msg })
	if (!EXPOelaborate) {
		await EXPOFSreadwrite()
	}
	return true
}

const EXPOFSappend = async (
	FS: Required<EXPOFS>,
	file: string,
	msg: string,
) => {
	try {
		const fileInfo = await FS.getInfoAsync(file)
		if (!fileInfo.exists) {
			await FS.writeAsStringAsync(file, msg)
			return true
		} else {
			return await EXPOcheckqueue(FS, file, msg)
		}
	} catch (error) {
		console.error(error)
		return false
	}
}

const RNFSappend = async (FS: any, file: string, msg: string) => {
	try {
		await FS.appendFile(file, msg, 'utf8')
		return true
	} catch (error) {
		console.error(error)
		return false
	}
}

let EXPONEXTFSqueue: Array<EXPONEXTFSqueueitem> = []
let EXPONEXTFSelaborate = false

const EXPONEXTFSprocessQueue = async () => {
	if (EXPONEXTFSqueue.length === 0) return
	EXPONEXTFSelaborate = true
	const item = EXPONEXTFSqueue[0]

	try {
		const FS: EXPONEXTFS = item.FS
		const FileClass = FS.File
		if (!FileClass) throw new Error('EXPO NEXT FS does not expose File')

		const file = new FileClass(item.file)

		try {
			if (!file.exists) {
				file.create({ intermediates: true })
			}
		} catch (e) {
			// maybe concurrently created
		}

		const fileHandler = file.open()

		try {
			const size = typeof fileHandler.size === 'number' ? fileHandler.size : 0
			fileHandler.offset = size

			const encoder = new TextEncoder()
			const bytes = encoder.encode(item.msg)

			await fileHandler.writeBytes(bytes)
		} finally {
			try {
				fileHandler.close()
			} catch (e) {
				console.warn('EXPO FS NEXT error while closing FileHandle', e)
			}
		}
	} catch (error) {
		console.error('EXPO FS NEXT failed to write log to file:', error)
	} finally {
		EXPONEXTFSelaborate = false
		EXPONEXTFSqueue.shift()
		if (EXPONEXTFSqueue.length > 0) {
			EXPONEXTFSprocessQueue().then()
		}
		notifyDrained()
	}
}

const EXPONEXTFSappend = async (FS: EXPONEXTFS, file: string, msg: string) => {
	try {
		if (!hasQueueCapacity(EXPONEXTFSqueue, msg)) return false
		EXPONEXTFSqueue.push({ FS, file, msg })
		if (!EXPONEXTFSelaborate) {
			await EXPONEXTFSprocessQueue()
		}
		return true
	} catch (error) {
		console.error(error)
		return false
	}
}

const dateReplacer = (filename: string, type?: 'eu' | 'us' | 'iso') => {
	let today = new Date()
	let d = today.getDate()
	let m = today.getMonth() + 1
	let y = today.getFullYear()
	switch (type) {
		case 'eu':
			return filename.replace('{date-today}', `${d}-${m}-${y}`)
		case 'us':
			return filename.replace('{date-today}', `${m}-${d}-${y}`)
		case 'iso':
			return filename.replace('{date-today}', `${y}-${m}-${d}`)
		default:
			return filename.replace('{date-today}', `${d}-${m}-${y}`)
	}
}

export interface FileAsyncTransportOptions {
	fileNameDateType?: 'eu' | 'us' | 'iso'
	FS: any
	fileName?: string
	filePath?: string
}
const fileAsyncTransport: transportFunctionType<FileAsyncTransportOptions> = (
	props,
) => {
	if (!props) return false

	let WRITE: (FS: any, file: string, msg: string) => Promise<boolean>
	let fileName: string = 'log'
	let filePath: string

	if (!props?.options?.FS) {
		throw Error(
			`react-native-logs: fileAsyncTransport - No FileSystem instance provided`,
		)
	}

	const FSF = props.options.FS as RNFS | EXPOFS | EXPONEXTFS

	if ((FSF as RNFS).DocumentDirectoryPath && (FSF as RNFS).appendFile) {
		WRITE = RNFSappend
		filePath = (FSF as RNFS).DocumentDirectoryPath
	} else if (
		(FSF as EXPOFS).documentDirectory &&
		(FSF as EXPOFS).writeAsStringAsync &&
		(FSF as EXPOFS).readAsStringAsync &&
		(FSF as EXPOFS).getInfoAsync
	) {
		WRITE = EXPOFSappend
		filePath = (FSF as EXPOFS).documentDirectory!
	} else if ((FSF as EXPONEXTFS).File && (FSF as EXPONEXTFS).Paths) {
		WRITE = EXPONEXTFSappend
		filePath = (FSF as EXPONEXTFS).Paths.document
	} else {
		throw Error(
			`react-native-logs: fileAsyncTransport - FileSystem not supported`,
		)
	}

	if (props?.options?.fileName) {
		fileName = props.options.fileName
		fileName = dateReplacer(fileName, props.options?.fileNameDateType)
	}

	if (props?.options?.filePath) filePath = props.options.filePath

	const output = `${props?.msg}\n`
	const path = `${filePath}/${fileName}`

	if (pendingWrites.size >= MAX_PENDING_LOGS) return false
	const write = WRITE(FSF, path, output)
	pendingWrites.add(write)
	const forgetWrite = () => {
		pendingWrites.delete(write)
	}
	void write.then(forgetWrite, forgetWrite)
}

export { fileAsyncTransport }
