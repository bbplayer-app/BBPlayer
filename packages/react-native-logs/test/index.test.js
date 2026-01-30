'use strict'
var rnlogs = require('../dist/index.js')

test('Module should be defined', () => {
	expect(rnlogs).toBeDefined()
	expect(rnlogs.logger).toBeDefined()
})

test('Logger should be created by createLogger', () => {
	var log = rnlogs.logger.createLogger()
	expect(log).toBeDefined()
})

test('The default log functions should be defined in all transports', () => {
	var log = rnlogs.logger.createLogger()
	expect(log.debug).toBeDefined()
	expect(log.info).toBeDefined()
	expect(log.warn).toBeDefined()
	expect(log.error).toBeDefined()
})

test('When setSeverity, the getSeverity should be the same', () => {
	var log = rnlogs.logger.createLogger()
	log.setSeverity('info')
	expect(log.getSeverity()).toBe('info')
	log.setSeverity('debug')
	expect(log.getSeverity()).toBe('debug')
})

test('When set higher severity level then the current level, log function shoud return false', () => {
	var log = rnlogs.logger.createLogger()
	log.setSeverity('info')
	expect(log.debug('message')).toBe(false)
})

test('Custom levels should be defined, even with wrong level config', () => {
	var customConfig = {
		severity: 'wrongLevel',
		levels: { custom: 0 },
	}
	var log = rnlogs.logger.createLogger(customConfig)
	log.setSeverity('custom')
	expect(log.getSeverity()).toBe('custom')
	expect(log.custom).toBeDefined()
})

test('Set wrong level config should throw error', () => {
	expect.assertions(1)
	var customConfig = {
		severity: 'wrongLevel',
		levels: { wrongLevel: 'thisMustBeANumber' },
	}
	try {
		var log = rnlogs.logger.createLogger(customConfig)
	} catch (e) {
		expect(e.message).toMatch(
			'[react-native-logs] ERROR: [wrongLevel] wrong level config',
		)
	}
})

test('Set undefined level should throw error', () => {
	expect.assertions(1)
	var log = rnlogs.logger.createLogger()
	try {
		log.setSeverity('wrongLevel')
	} catch (e) {
		expect(e.message).toMatch(
			'[react-native-logs:setSeverity] ERROR: Level [wrongLevel] not exist',
		)
	}
})

test('Initialize with reserved key should throw error', () => {
	expect.assertions(1)
	var customConfig = {
		severity: 'custom',
		levels: { custom: 0, setSeverity: 1 },
	}
	try {
		var log = rnlogs.logger.createLogger(customConfig)
	} catch (e) {
		expect(e.message).toMatch(
			'[react-native-logs] ERROR: [setSeverity] is a reserved key, you cannot set it as custom level',
		)
	}
})
