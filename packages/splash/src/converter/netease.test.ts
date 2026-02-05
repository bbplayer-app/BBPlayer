import * as fs from 'fs'
import * as path from 'path'

import { parseYrc, formatSplTime } from './netease'

describe('Netease YRC Converter', () => {
	it('should format time correctly', () => {
		expect(formatSplTime(0)).toBe('00:00.000')
		expect(formatSplTime(1000)).toBe('00:01.000')
		expect(formatSplTime(60000)).toBe('01:00.000')
		expect(formatSplTime(61234)).toBe('01:01.234')
	})

	it('should parse JSON metadata lines', () => {
		const input = `{"t":0,"c":[{"tx":"制作人: "},{"tx":"ZUN"}]}\n{"t":1000,"c":[{"tx":"作词: "},{"tx":"Haruka"}]}`
		const output = parseYrc(input)
		expect(output).toBe('[00:00.000]制作人: ZUN\n[00:01.000]作词: Haruka')
	})

	it('should parse simple YRC line', () => {
		// [57500,3500](57500,520,0)流(58020,180,0)れ...
		const input = `[57500,3500](57500,520,0)流(58020,180,0)れ`
		const output = parseYrc(input)
		// 57500 = 57.500
		// 58020 = 58.020
		// End: 57500 + 3500 = 61000 = 01:01.000
		expect(output).toBe('[00:57.500]流[00:58.020]れ[01:01.000]')
	})

	it('should handle delayed start', () => {
		// Line starts at 1000, first word starts at 1500
		const input = `[1000,2000](1500,500,0)Hello(2000,500,0)World`
		const output = parseYrc(input)
		// [00:01.000]<00:01.500>Hello[00:02.000]World[00:03.000]
		expect(output).toBe(
			'[00:01.000]<00:01.500>Hello[00:02.000]World[00:03.000]',
		)
	})

	it('should parse real file data', () => {
		const filePath = path.join(__dirname, '../../test-data/687506.json')
		if (fs.existsSync(filePath)) {
			const data = JSON.parse(fs.readFileSync(filePath, 'utf-8')) as {
				yrc: {
					lyric: string
				}
			}
			if (data.yrc?.lyric) {
				const result = parseYrc(data.yrc.lyric)
				expect(result).toContain('[00:57.500]流[00:58.020]れ')
				console.log('Converted sample:\n', result.substring(0, 200))
			}
		} else {
			console.warn('Test data file not found, skipping real file test')
		}
	})
})
