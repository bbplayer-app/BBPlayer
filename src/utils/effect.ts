import { AppRuntime } from '@/lib/effect/runtime'
import type { Effect, ManagedRuntime } from 'effect'

type AppRequirements = ManagedRuntime.ManagedRuntime.Context<typeof AppRuntime>
export const effectToPromise = async <A, E, Check extends boolean = false>(
	effect: Effect.Effect<A, E, AppRequirements>,
	enableUndefinedCheck: Check = false as Check,
): Promise<Check extends true ? NonNullable<A> : A> => {
	const result = await AppRuntime.runPromise(effect)
	if ((result === undefined || result === null) && enableUndefinedCheck) {
		throw new Error('返回数据为 undefined 或 null')
	}
	return result as Check extends true ? NonNullable<A> : A
}
