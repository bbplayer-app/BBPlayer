/**
 * Creates a new object with all properties that have `undefined` values removed.
 * Useful for handling optional properties where `undefined` is not allowed but you want to use cleaner object construction.
 *
 * @param obj The object to compact
 * @returns A new object with `undefined` values removed
 */
export function compact<T extends object>(
	obj: T,
): {
	[K in keyof T as undefined extends T[K] ? K : never]?: Exclude<
		T[K],
		undefined
	>
} & {
	[K in keyof T as undefined extends T[K] ? never : K]: T[K]
} {
	// oxlint-disable-next-line @typescript-eslint/no-explicit-any
	const ret = {} as any

	for (const key in obj) {
		if (obj[key] !== undefined) {
			ret[key] = obj[key]!
		}
	}

	return ret
}
