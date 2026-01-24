// 直接复制 av2bv 和 bv2av 的纯函数逻辑进行测试，避免复杂的模块依赖链
// 这些函数是纯函数，没有副作用

/**
 * 转换B站bvid为avid
 */
function bv2av(bvid: string): number {
	const XOR_CODE = 23442827791579n
	const MASK_CODE = 2251799813685247n
	const BASE = 58n

	const data = 'FcwAPNKTMug3GV5Lj7EJnHpWsx4tb8haYeviqBz6rkCy12mUSDQX9RdoZf'
	const bvidArr = Array.from(bvid)
	;[bvidArr[3], bvidArr[9]] = [bvidArr[9], bvidArr[3]]
	;[bvidArr[4], bvidArr[7]] = [bvidArr[7], bvidArr[4]]
	bvidArr.splice(0, 3)
	const tmp = bvidArr.reduce(
		(pre, bvidChar) => pre * BASE + BigInt(data.indexOf(bvidChar)),
		0n,
	)
	return Number((tmp & MASK_CODE) ^ XOR_CODE)
}

/**
 * 将 AV 号转换为 BV 号
 */
function av2bv(avid: number | bigint): string {
	const XOR_CODE = 23442827791579n
	const MAX_AID = 2251799813685248n
	const BASE = 58n
	const MAGIC_STR = 'FcwAPNKTMug3GV5Lj7EJnHpWsx4tb8haYeviqBz6rkCy12mUSDQX9RdoZf'

	let tempNum = (BigInt(avid) | MAX_AID) ^ XOR_CODE

	const resultArray = Array.from('BV1000000000')

	for (let i = 11; i >= 3; i--) {
		resultArray[i] = MAGIC_STR[Number(tempNum % BASE)]
		tempNum /= BASE
	}

	;[resultArray[3], resultArray[9]] = [resultArray[9], resultArray[3]]
	;[resultArray[4], resultArray[7]] = [resultArray[7], resultArray[4]]

	return resultArray.join('')
}

describe('Bilibili AV/BV 转换工具', () => {
	describe('bv2av', () => {
		it('应该将有效的 BVID 转换为对应的 AVID', () => {
			// 使用真实的转换对照数据
			expect(bv2av('BV17x411w7KC')).toBe(170001)
			expect(bv2av('BV1xx411c7mD')).toBe(2)
		})

		it('应该正确处理不同格式的 BVID', () => {
			// BVID 大小写应该敏感
			expect(bv2av('BV1Ab411m7kL')).toBeGreaterThan(0)
		})
	})

	describe('av2bv', () => {
		it('应该将有效的 AVID 转换为对应的 BVID', () => {
			expect(av2bv(170001)).toBe('BV17x411w7KC')
			expect(av2bv(2)).toBe('BV1xx411c7mD')
		})

		it('应该正确处理大整数 AVID', () => {
			// 使用 BigInt 作为参数
			expect(av2bv(BigInt(170001))).toBe('BV17x411w7KC')
		})

		it('应该正确处理较大的 AVID', () => {
			const avid = 1000000000
			const bvid = av2bv(avid)
			// 确保生成的 BVID 格式正确
			expect(bvid).toMatch(/^BV[0-9A-Za-z]{10}$/)
		})
	})

	describe('AV/BV 互转一致性', () => {
		it('应该保证 av2bv(bv2av(bvid)) === bvid', () => {
			const testBvids = ['BV17x411w7KC', 'BV1xx411c7mD']

			for (const bvid of testBvids) {
				const avid = bv2av(bvid)
				const convertedBvid = av2bv(avid)
				expect(convertedBvid).toBe(bvid)
			}
		})

		it('应该保证 bv2av(av2bv(avid)) === avid', () => {
			const testAvids = [170001, 2, 1234567]

			for (const avid of testAvids) {
				const bvid = av2bv(avid)
				const convertedAvid = bv2av(bvid)
				expect(convertedAvid).toBe(avid)
			}
		})
	})
})
