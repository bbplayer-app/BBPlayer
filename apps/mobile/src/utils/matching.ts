/**
 * Gaussian function used for scoring
 * @param x The difference value
 * @param sigma The standard deviation
 * @returns A value between 0 and 1
 */
export function gaussian(x: number, sigma: number): number {
	return Math.exp(-(x * x) / (2 * sigma * sigma))
}

/**
 * Calculate the length of the Longest Common Subsequence between two strings
 * @param s1 First string
 * @param s2 Second string
 * @returns Length of LCS
 */
export function lcs(s1: string, s2: string): number {
	const m = s1.length
	const n = s2.length
	const dp: number[][] = Array.from({ length: m + 1 }, (): number[] =>
		Array.from({ length: n + 1 }, () => 0),
	)

	for (let i = 1; i <= m; i++) {
		for (let j = 1; j <= n; j++) {
			if (s1[i - 1] === s2[j - 1]) {
				dp[i][j] = dp[i - 1][j - 1] + 1
			} else {
				dp[i][j] = Math.max(dp[i - 1][j], dp[i][j - 1])
			}
		}
	}

	return dp[m][n]
}

/**
 * Calculate a normalized LCS score (0 to 1)
 * @param s1 First string
 * @param s2 Second string
 * @returns Score relative to the longer string length
 */
export function lcsScore(s1: string, s2: string): number {
	if (s1.length === 0 || s2.length === 0) return 0
	const lcsLen = lcs(s1, s2)
	// Use max length to penalize length mismatches
	return lcsLen / Math.max(s1.length, s2.length)
}

/**
 * Clean string for matching (remove non-alphanumeric, keep Chinese)
 * @param str Input string
 * @returns Cleaned string
 */
export function cleanString(str: string): string {
	return str.toLowerCase().replace(/[^\w\u4e00-\u9fa5]/g, '') // Keep alphanumeric and Chinese
}
