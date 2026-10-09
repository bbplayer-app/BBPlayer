const path = require('path')
const {
	withAppBuildGradle,
	withProjectBuildGradle,
} = require('expo/config-plugins')

// Gradle strings use forward slashes even when prebuild runs on Windows.
const gradlePath = (value) => value.replaceAll('\\', '/').replaceAll("'", "\\'")

const withAndroidBuildCompatibility = (config) => {
	config = withAppBuildGradle(config, (config) => {
		if (config.modResults.language !== 'groovy') {
			throw new Error(
				'Android build compatibility requires Groovy build scripts',
			)
		}
		// Resolve during prebuild: Sentry's .execute() inherits an unreliable cwd
		// on Windows and can silently return an empty package path.
		const sentryPackage = require.resolve('@sentry/react-native/package.json', {
			paths: [config.modRequest.projectRoot],
		})
		const sentryScript = path.relative(
			config.modRequest.platformProjectRoot,
			path.join(path.dirname(sentryPackage), 'sentry.gradle.kts'),
		)
		const contents = config.modResults.contents
		const sentryApply = /^apply from:.*sentry\.gradle(?:\.kts)?.*$/m
		if (!sentryApply.test(contents)) {
			throw new Error(
				'Sentry Gradle script was not added before compatibility plugin',
			)
		}
		const resolvedContents = contents.replace(
			sentryApply,
			() => `apply from: rootProject.file('${gradlePath(sentryScript)}')`,
		)
		const normalizer = path.relative(
			config.modRequest.platformProjectRoot,
			path.join(__dirname, 'normalizeWindowsAutolinking.js'),
		)
		const junctionRoot = path.relative(
			config.modRequest.platformProjectRoot,
			path.resolve(config.modRequest.projectRoot, '../../.tmp/j'),
		)
		const cmakeBlock = `// @generated begin bbplayer-windows-autolinking
// RNRepo emits Windows separators into quoted CMake paths, including a trailing
// backslash that escapes the closing quote. Normalize after codegen completes.
if (System.getProperty('os.name').toLowerCase().contains('windows')) {
  def autolinkingCmake = layout.buildDirectory.file(
    'generated/autolinking/src/main/jni/Android-autolinking.cmake'
  )
  tasks.configureEach { nativeTask ->
    if (nativeTask.name.startsWith('configureCMake')) {
      nativeTask.doFirst {
        def cmakeFile = autolinkingCmake.get().asFile
        if (!cmakeFile.isFile()) {
          throw new GradleException('Missing generated Android autolinking CMake file')
        }
        providers.exec {
          commandLine 'node',
            rootProject.file('${gradlePath(normalizer)}').absolutePath,
            cmakeFile.absolutePath,
            rootProject.file('${gradlePath(junctionRoot)}').absolutePath
        }.result.get().assertNormalExitValue()
      }
    }
  }
}
// @generated end bbplayer-windows-autolinking`
		const withoutBlock = resolvedContents.replace(
			/\n?\/\/ @generated begin bbplayer-windows-autolinking[\s\S]*?\/\/ @generated end bbplayer-windows-autolinking\n?/g,
			'\n',
		)
		config.modResults.contents = `${withoutBlock.trimEnd()}\n\n${cmakeBlock}\n`
		return config
	})

	return withProjectBuildGradle(config, (config) => {
		if (config.modResults.language !== 'groovy') {
			throw new Error(
				'Android build compatibility requires Groovy build scripts',
			)
		}
		const stagingRoot = path.relative(
			config.modRequest.platformProjectRoot,
			path.resolve(config.modRequest.projectRoot, '../../.tmp'),
		)
		const block = `// @generated begin bbplayer-windows-cmake
// pnpm package paths can exceed Ninja's Windows object-path limit.
if (System.getProperty('os.name').toLowerCase().contains('windows')) {
  def stagingNames = [
    ':react-native-worklets': 'w',
    ':expo-modules-core': 'e',
    ':shopify_react-native-skia': 's',
    ':react-native-reanimated': 'r'
  ]
  subprojects { dependency ->
    def stagingName = stagingNames[dependency.path]
    dependency.plugins.withId('com.android.library') {
      // Other native dependencies have the same pnpm/Prefab path-length issue.
      def directoryName = stagingName ?: ('c/' + java.security.MessageDigest
        .getInstance('SHA-256').digest(dependency.path.getBytes('UTF-8'))
        .encodeHex().toString().take(12))
      dependency.android.externalNativeBuild.cmake.buildStagingDirectory =
        rootProject.file('${gradlePath(stagingRoot)}/' + directoryName)
    }
    dependency.plugins.withId('com.android.application') {
      dependency.android.externalNativeBuild.cmake.buildStagingDirectory =
        rootProject.file('${gradlePath(stagingRoot)}/a')
      // Ninja defaults to all CPU cores; simultaneous RN PCH compilations can
      // exhaust memory even when Gradle's worker count is limited.
      dependency.android.defaultConfig.externalNativeBuild.cmake.arguments.addAll([
        '-DCMAKE_JOB_POOLS=bbplayer_compile=2;bbplayer_link=1',
        '-DCMAKE_JOB_POOL_COMPILE=bbplayer_compile',
        '-DCMAKE_JOB_POOL_LINK=bbplayer_link'
      ])
    }
  }
}
// @generated end bbplayer-windows-cmake`
		const contents = config.modResults.contents.replace(
			/\n?\/\/ @generated begin bbplayer-windows-cmake[\s\S]*?\/\/ @generated end bbplayer-windows-cmake\n?/g,
			'\n',
		)
		// React Native's root plugin can evaluate :app eagerly and freeze its DSL.
		// Register the native-directory callbacks before either root plugin runs.
		const rootPlugin = /^apply plugin: ["']expo-root-project["']/m
		if (!rootPlugin.test(contents)) {
			throw new Error('Cannot locate Expo root plugin for Windows CMake setup')
		}
		config.modResults.contents = contents.replace(
			rootPlugin,
			(match) => `${block}\n\n${match}`,
		)
		return config
	})
}

module.exports = withAndroidBuildCompatibility
