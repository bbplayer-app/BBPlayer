import { getGradientColors } from '@/utils/color'

// 需要先导出 hslToRgb 才能测试，或者通过 getGradientColors 间接测试

describe('color utils', () => {
	describe('getGradientColors', () => {
		it('应该返回包含两个颜色的对象', () => {
			const result = getGradientColors('test', false)
			expect(result).toHaveProperty('color1')
			expect(result).toHaveProperty('color2')
		})

		it('应该返回有效的 rgba 格式字符串', () => {
			const result = getGradientColors('test', false)
			const rgbaRegex = /^rgba\(\d{1,3}, \d{1,3}, \d{1,3}, 1\)$/
			expect(result.color1).toMatch(rgbaRegex)
			expect(result.color2).toMatch(rgbaRegex)
		})

		it('应该为相同输入生成相同的颜色', () => {
			const result1 = getGradientColors('consistent', false)
			const result2 = getGradientColors('consistent', false)
			expect(result1).toEqual(result2)
		})

		it('应该为不同输入生成不同的颜色', () => {
			const result1 = getGradientColors('string1', false)
			const result2 = getGradientColors('string2', false)
			// 不同输入应该产生不同的颜色（除非极小概率哈希碰撞）
			expect(result1.color1).not.toBe(result2.color1)
		})

		it('应该为浅色模式和深色模式生成不同的颜色', () => {
			const lightResult = getGradientColors('test', false)
			const darkResult = getGradientColors('test', true)
			// 浅色模式和深色模式的颜色应该不同
			expect(lightResult.color1).not.toBe(darkResult.color1)
			expect(lightResult.color2).not.toBe(darkResult.color2)
		})

		it('应该正确处理空字符串', () => {
			const result = getGradientColors('', false)
			expect(result).toHaveProperty('color1')
			expect(result).toHaveProperty('color2')
		})

		it('应该正确处理中文字符', () => {
			const result = getGradientColors('测试歌曲名称', false)
			const rgbaRegex = /^rgba\(\d{1,3}, \d{1,3}, \d{1,3}, 1\)$/
			expect(result.color1).toMatch(rgbaRegex)
			expect(result.color2).toMatch(rgbaRegex)
		})

		it('应该正确处理特殊字符', () => {
			const result = getGradientColors('!@#$%^&*()', false)
			const rgbaRegex = /^rgba\(\d{1,3}, \d{1,3}, \d{1,3}, 1\)$/
			expect(result.color1).toMatch(rgbaRegex)
			expect(result.color2).toMatch(rgbaRegex)
		})
	})
})
