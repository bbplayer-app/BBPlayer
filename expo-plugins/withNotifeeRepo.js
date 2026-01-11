const { withProjectBuildGradle } = require('expo/config-plugins')

const withNotifeeRepo = (config) => {
	return withProjectBuildGradle(config, (config) => {
		if (config.modResults.language === 'groovy') {
			const buildGradle = config.modResults.contents

			// Add the notifee local maven repository to allprojects
			const notifeeRepoCode = `
    allprojects {
        repositories {
            def notifeeDir = new File(['node', '--print', "require.resolve('@notifee/react-native/package.json')"].execute(null, rootDir).text.trim()).getParentFile()
            maven {
                url "\${notifeeDir}/android/libs"
            }
        }
    }
`
			// Insert after the first allprojects block
			if (!buildGradle.includes('@notifee/react-native')) {
				// Find the position after "apply plugin: \"expo-root-project\""
				const insertPosition = buildGradle.indexOf(
					'apply plugin: "expo-root-project"',
				)
				if (insertPosition !== -1) {
					const endOfLine = buildGradle.indexOf('\n', insertPosition)
					config.modResults.contents =
						buildGradle.slice(0, endOfLine + 1) +
						notifeeRepoCode +
						buildGradle.slice(endOfLine + 1)
				}
			}
		}

		return config
	})
}

module.exports = withNotifeeRepo
