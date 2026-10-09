const crypto = require('node:crypto')
const fs = require('node:fs')
const path = require('node:path')

// Generated JNI sources can exceed Ninja's 260-character input-path limit.
// Junctions keep those sources in place and require no administrator rights.
const normalizeWindowsAutolinking = (cmakeFile, junctionRoot) => {
	if (process.platform !== 'win32') return
	const junctionDirectory = path.resolve(junctionRoot)
	const contents = fs.readFileSync(cmakeFile, 'utf8')
	const normalized = contents
		.replaceAll('\\', '/')
		.replace(/add_subdirectory\("([^"]+)"/g, (match, directory) => {
			const source = fs.realpathSync.native(directory)
			if (
				!source
					.replaceAll('\\', '/')
					.endsWith('/build/generated/source/codegen/jni')
			) {
				return match
			}
			const name = crypto
				.createHash('sha256')
				.update(source)
				.digest('hex')
				.slice(0, 12)
			const junction = path.join(junctionDirectory, name)
			fs.mkdirSync(junctionDirectory, { recursive: true })
			if (!fs.existsSync(junction)) {
				fs.symlinkSync(source, junction, 'junction')
			} else if (
				!fs.lstatSync(junction).isSymbolicLink() ||
				fs.realpathSync.native(junction) !== source
			) {
				throw new Error(`Unexpected CMake source junction: ${junction}`)
			}
			return `add_subdirectory("${junction.replaceAll('\\', '/')}"`
		})
	if (contents !== normalized) fs.writeFileSync(cmakeFile, normalized)
}

if (require.main === module) {
	const [, , cmakeFile, junctionRoot] = process.argv
	if (!cmakeFile || !junctionRoot) {
		throw new Error('Expected autolinking CMake file and junction directory')
	}
	normalizeWindowsAutolinking(cmakeFile, junctionRoot)
}

module.exports = normalizeWindowsAutolinking
