const { withAppBuildGradle } = require('expo/config-plugins')

const signingBlock = `
// BBPlayer: opt-in local production-signed debug build.
if (System.getenv('BBPLAYER_PRODUCTION_DEBUG') == '1') {
    def credentialsFile = new File(rootProject.projectDir.parentFile, 'credentials.json')
    if (!credentialsFile.isFile()) {
        throw new GradleException('Download production Android credentials using eas credentials into apps/mobile/credentials.json first.')
    }
    def credentials
    try {
        credentials = new groovy.json.JsonSlurper().parse(credentialsFile)?.android?.keystore
    } catch (Exception ignored) {
        throw new GradleException('Cannot parse local credentials.json.')
    }
    if (!credentials || ['keystorePath', 'keystorePassword', 'keyAlias', 'keyPassword'].any { !(credentials[it] instanceof String) || credentials[it].isEmpty() }) {
        throw new GradleException('credentials.json must contain Android keystorePath, keystorePassword, keyAlias and keyPassword.')
    }
    def keystoreFile = new File(credentials.keystorePath)
    if (!keystoreFile.isAbsolute()) {
        keystoreFile = new File(credentialsFile.parentFile, credentials.keystorePath)
    }
    if (!keystoreFile.isFile()) {
        throw new GradleException('The keystore referenced by credentials.json does not exist.')
    }
    def productionDebugSigning = android.signingConfigs.create('bbplayerProductionDebug') {
        storeFile keystoreFile
        storePassword credentials.keystorePassword
        keyAlias credentials.keyAlias
        keyPassword credentials.keyPassword
    }
    android.buildTypes.debug.signingConfig = productionDebugSigning
}
`

module.exports = (config) => {
	if (process.env.BBPLAYER_PRODUCTION_DEBUG !== '1') return config
	if (process.env.APP_VARIANT !== 'production') {
		throw new Error('Production debug signing requires APP_VARIANT=production.')
	}

	return withAppBuildGradle(config, (config) => {
		if (config.modResults.language !== 'groovy') {
			throw new Error(
				'Production debug signing requires a Groovy build.gradle.',
			)
		}
		if (!config.modResults.contents.includes(signingBlock)) {
			config.modResults.contents += signingBlock
		}
		return config
	})
}
