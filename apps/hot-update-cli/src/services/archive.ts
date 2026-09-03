import { createWriteStream } from 'node:fs'

import archiver from 'archiver'

export async function createZipArchive(
	sourceDirectory: string,
	archivePath: string,
): Promise<void> {
	await new Promise<void>((resolve, reject) => {
		const outputStream = createWriteStream(archivePath)
		const archive = archiver('zip', { zlib: { level: 9 } })
		outputStream.once('close', resolve)
		outputStream.once('error', reject)
		archive.once('error', reject)
		archive.pipe(outputStream)
		archive.directory(sourceDirectory, false)
		void archive.finalize()
	})
}
