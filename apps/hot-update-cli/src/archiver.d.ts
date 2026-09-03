declare module 'archiver' {
	import { EventEmitter } from 'node:events'
	import { Writable } from 'node:stream'
	interface Archive extends EventEmitter {
		pipe(destination: Writable): Writable
		directory(path: string, destination: string | false): Archive
		finalize(): Promise<void>
	}
	export default function archiver(
		format: 'zip',
		options?: { zlib?: { level: number } },
	): Archive
}
