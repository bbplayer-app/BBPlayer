import { NotImplementedError, ValidationError } from '@/lib/errors/service'
import type { TrackSourceData } from '@/types/services/track'
import { Effect } from 'effect'

export default function generateUniqueTrackKey(
	payload: TrackSourceData,
): Effect.Effect<string, ValidationError | NotImplementedError> {
	switch (payload.source) {
		case 'bilibili': {
			const biliMeta = payload.bilibiliMetadata
			if (!biliMeta.bvid) {
				return Effect.fail(new ValidationError({ message: 'bvid 不存在' }))
			}
			return biliMeta.isMultiPage
				? Effect.succeed(`${payload.source}::${biliMeta.bvid}::${biliMeta.cid}`)
				: Effect.succeed(`${payload.source}::${biliMeta.bvid}`)
		}
		case 'local': {
			// 基于 localPath 的业务主键太不可靠，考虑基于文件生成 hash
			return Effect.fail(
				new NotImplementedError({
					message: '本地文件曲目的唯一标识生成尚未实现',
				}),
			)
		}
		default:
			return Effect.fail(
				new ValidationError({
					message: `不支持的曲目来源：${String(payload)}`,
				}),
			)
	}
}
