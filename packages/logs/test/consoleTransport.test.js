'use strict'
var rnlogs = require('../dist/index.js')

var transport =
	require('../dist/transports/consoleTransport.js').consoleTransport

test('The log function should print string, beutified objects and functions in console', () => {
	var log = rnlogs.logger.createLogger({
		transport: transport,
		printDate: false,
		printLevel: false,
	})
	var outputData = ''
	var outputExp = ''
	var storeLog = (inputs) => (outputData += inputs)
	console['log'] = jest.fn(storeLog)
	log.debug('message')
	outputExp = `message`
	expect(outputData).toBe(outputExp)
	outputData = ''
	log.debug({ message: 'message' })
	outputExp = `{\n  \"message\": \"message\"\n}`
	expect(outputData).toBe(outputExp)
	outputData = ''
	function testFunc() {
		return 'test'
	}
	log.debug(testFunc)
	outputExp = `[function testFunc()]`
	expect(outputData).toBe(outputExp)
})

test('When set higher power level, the lover power level, should not print in console', () => {
	var log = rnlogs.logger.createLogger({ transport: transport })
	log.setSeverity('info')
	var outputData = ''
	var storeLog = (inputs) => (outputData += inputs)
	console['log'] = jest.fn(storeLog)
	log.debug('message')
	expect(outputData.length).toBe(0)
})

test('When set {enabled:false}, should not print in console', () => {
	var log = rnlogs.logger.createLogger({
		transport: transport,
		enabled: false,
	})
	var outputData = ''
	var storeLog = (inputs) => (outputData += inputs)
	console['log'] = jest.fn(storeLog)
	log.debug('message')
	expect(outputData.length).toBe(0)
})

test('When set {enabled:false, printDate:false} and the call log.enable(), should print expected output', () => {
	var log = rnlogs.logger.createLogger({
		transport: transport,
		printDate: false,
		enabled: false,
	})
	log.enable()
	var outputData = ''
	var storeLog = (inputs) => (outputData += inputs)
	console['log'] = jest.fn(storeLog)
	log.debug('message')
	var levelTxt = `DEBUG : `
	var outputExp = `${levelTxt}message`
	expect(outputData).toBe(outputExp)
})

test('When set {printDate:false, printLevel:false} and empty msg, should not print in console', () => {
	var log = rnlogs.logger.createLogger({
		transport: transport,
		printDate: false,
		printLevel: false,
	})
	var outputData = ''
	var storeLog = (inputs) => (outputData += inputs)
	console['log'] = jest.fn(storeLog)
	log.debug('')
	expect(outputData).toBe('')
})

test("When set {dateFormat:'utc'}, should output toUTCString dateformat", () => {
	var log = rnlogs.logger.createLogger({
		transport: transport,
		dateFormat: 'utc',
	})
	var outputData = ''
	var storeLog = (inputs) => (outputData += inputs)
	console['log'] = jest.fn(storeLog)
	log.debug('message')
	var pattern = /\d\d:\d\d:\d\d GMT \| DEBUG \: message$/
	expect(outputData).toMatch(pattern)
})

test("When set {dateFormat:'iso'}, should output toISOString dateformat", () => {
	var log = rnlogs.logger.createLogger({
		transport: transport,
		dateFormat: 'iso',
	})
	var outputData = ''
	var storeLog = (inputs) => (outputData += inputs)
	console['log'] = jest.fn(storeLog)
	log.debug('message')
	var pattern = /T\d\d:\d\d:\d\d\.\d\d\dZ \| DEBUG \: message$/
	expect(outputData).toMatch(pattern)
})

test('The log function should print expected output', () => {
	var log = rnlogs.logger.createLogger({
		transport: transport,
		printDate: false,
	})
	var outputData = ''
	var storeLog = (inputs) => (outputData += inputs)
	console['log'] = jest.fn(storeLog)
	log.debug('message')
	var levelTxt = `DEBUG : `
	var outputExp = `${levelTxt}message`
	expect(outputData).toBe(outputExp)
})

test('The log function should print concatenated expected output', () => {
	var log = rnlogs.logger.createLogger({
		transport: transport,
		printDate: false,
	})
	var outputData = ''
	var storeLog = (inputs) => (outputData += inputs)
	console['log'] = jest.fn(storeLog)
	log.debug('message', 'message2')
	var levelTxt = `DEBUG : `
	var outputExp = `${levelTxt}message message2`
	expect(outputData).toBe(outputExp)
})

test('The enabled namespaced log function should print expected output', () => {
	var log = rnlogs.logger.createLogger({
		transport: transport,
		printDate: false,
		enabledExtensions: ['NAMESPACE'],
	})
	const namespacedLog = log.extend('NAMESPACE')
	var outputData = ''
	var storeLog = (inputs) => (outputData += inputs)
	console['log'] = jest.fn(storeLog)
	namespacedLog.debug('message')
	var levelTxt = `NAMESPACE | DEBUG : `
	var outputExp = `${levelTxt}message`
	expect(outputData).toBe(outputExp)
})

test('The enabled namespaced log function should print concatenated expected output', () => {
	var log = rnlogs.logger.createLogger({
		transport: transport,
		printDate: false,
		enabledExtensions: ['NAMESPACE'],
	})
	const namespacedLog = log.extend('NAMESPACE')
	var outputData = ''
	var storeLog = (inputs) => (outputData += inputs)
	console['log'] = jest.fn(storeLog)
	namespacedLog.debug('message', 'message2')
	var levelTxt = `NAMESPACE | DEBUG : `
	var outputExp = `${levelTxt}message message2`
	expect(outputData).toBe(outputExp)
})

test('The disabled namespaced log function should not print', () => {
	var log = rnlogs.logger.createLogger({
		transport: transport,
		printDate: false,
		enabledExtensions: ['NAMESPACE2'],
	})
	const namespacedLog = log.extend('NAMESPACE')
	var outputData = ''
	var storeLog = (inputs) => (outputData += inputs)
	console['log'] = jest.fn(storeLog)
	namespacedLog.debug('message')
	var outputExp = ``
	expect(outputData).toBe(outputExp)
})

test('The disabled/enabled namespaced in runtime log function should not print/print', () => {
	var log = rnlogs.logger.createLogger({
		transport: transport,
		printDate: false,
	})
	const namespacedLog = log.extend('NAMESPACE')
	var outputData = ''
	var storeLog = (inputs) => (outputData += inputs)
	console['log'] = jest.fn(storeLog)
	log.disable('NAMESPACE')
	namespacedLog.debug('message')
	var outputExp = ``
	expect(outputData).toBe(outputExp)
	log.enable('NAMESPACE')
	namespacedLog.debug('message')
	var outputExp = `NAMESPACE | DEBUG : message`
	expect(outputData).toBe(outputExp)
})
