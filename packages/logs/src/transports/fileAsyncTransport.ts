import { transportFunctionType } from '../index'

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
			writeBytes: (data: Uint8Array) => void
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
	}
}

const EXPOcheckqueue = async (
	FS: Required<EXPOFS>,
	file: string,
	msg: string,
) => {
	EXPOqueue.push({ FS, file, msg })
	if (!EXPOelaborate) {
		await EXPOFSreadwrite()
	}
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
			await EXPOcheckqueue(FS, file, msg)
			return true
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

			fileHandler.writeBytes(bytes)
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
	}
}

const EXPONEXTFSappend = async (FS: EXPONEXTFS, file: string, msg: string) => {
	try {
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

	WRITE(FSF, path, output)
}

export { fileAsyncTransport }
