import { Orpheus } from '@bbplayer/orpheus'
import type { TrueSheet as TrueSheetType } from '@lodev09/react-native-true-sheet'
import { TrueSheet } from '@lodev09/react-native-true-sheet'
import type { RefObject } from 'react'
import { memo, useEffect, useRef, useState } from 'react'
import { ScrollView, StyleSheet, View } from 'react-native'
import { GestureHandlerRootView } from 'react-native-gesture-handler'
import {
	Divider,
	HelperText,
	ProgressBar,
	Switch,
	Text,
	TextInput,
	useTheme,
} from 'react-native-paper'
import { useSafeAreaInsets } from 'react-native-safe-area-context'

import Button from '@/components/common/Button'
import { toastAndLogError } from '@/utils/error-handling'

type Stage = 'config' | 'exporting' | 'completed' | 'error'

interface ProgressState {
	current: number
	total: number
	failed: number
	stage: Stage
	message: string
}

export interface ExportDownloadsProgressModalProps {
	sheetRef: RefObject<TrueSheetType | null>
	ids: string[]
	destinationUri: string
}

const PREVIEW_VALUES: Record<string, string> = {
	id: 'bilibili::BV114514::1919810',
	name: '春日影',
	artist: 'Crychic',
	bvid: 'BV114514',
	cid: '1919810',
}

const VARIABLE_KEYS = Object.keys(PREVIEW_VALUES)

function buildPreviewFilename(pattern: string): string {
	if (!pattern.trim()) return `${PREVIEW_VALUES.name}.m4a`
	let result = pattern
	for (const [key, val] of Object.entries(PREVIEW_VALUES)) {
		result = result.replaceAll(`{${key}}`, val)
	}
	result = result.replace(/[\\/:*?"<>|]/g, '_').trim()
	return result ? `${result}.m4a` : `${PREVIEW_VALUES.name}.m4a`
}

function patternHasVariable(pattern: string): boolean {
	return VARIABLE_KEYS.some((k) => pattern.includes(`{${k}}`))
}

const ExportDownloadsProgressModal = memo(
	function ExportDownloadsProgressModal({
		sheetRef,
		ids,
		destinationUri,
	}: ExportDownloadsProgressModalProps) {
		const { colors } = useTheme()
		const insets = useSafeAreaInsets()

		const [filenamePattern, setFilenamePattern] = useState('{name}')
		const [embedLyrics, setEmbedLyrics] = useState(false)
		const [convertToLrc, setConvertToLrc] = useState(false)
		const [cropCoverArt, setCropCoverArt] = useState(false)

		const [progress, setProgress] = useState<ProgressState>({
			current: 0,
			total: ids.length,
			failed: 0,
			stage: 'config',
			message: '准备导出...',
		})
		const hasStarted = useRef(false)

		const stage = progress.stage

		// Reset internal state whenever a new export session begins (ids / destination changed)
		const idsKey = ids.join(',')
		useEffect(() => {
			setFilenamePattern('{name}')
			setEmbedLyrics(false)
			setConvertToLrc(false)
			setCropCoverArt(false)
			setProgress({
				current: 0,
				total: idsKey.split(',').filter(Boolean).length,
				failed: 0,
				stage: 'config',
				message: '准备导出...',
			})
			hasStarted.current = false
		}, [idsKey, destinationUri])

		function startExport() {
			if (hasStarted.current) return
			hasStarted.current = true

			setProgress((prev) => ({ ...prev, stage: 'exporting' }))

			const subscription = Orpheus.addListener('onExportProgress', (event) => {
				setProgress((prev) => {
					const failed = prev.failed + (event.status === 'error' ? 1 : 0)
					const current = event.index ?? prev.current
					const total = event.total ?? prev.total
					const isLast = current === total

					let message = `正在导出 ${current}/${total}...`
					if (event.status === 'error') {
						message = `导出 ${event.currentId} 失败: ${event.message ?? '未知错误'}`
					}

					return {
						current,
						total,
						failed,
						stage: isLast ? 'completed' : 'exporting',
						message: isLast
							? failed > 0
								? `导出完成，${total - failed} 个成功，${failed} 个失败`
								: `全部 ${total} 个曲目已成功导出`
							: message,
					}
				})
			})

			const effectivePattern = filenamePattern.trim() || '{name}'
			Orpheus.exportDownloads(
				ids,
				destinationUri,
				effectivePattern,
				embedLyrics,
				convertToLrc,
				cropCoverArt,
			).catch((e: unknown) => {
				toastAndLogError('启动批量导出失败', e, 'Modal.ExportDownloadsProgress')
				setProgress((prev) => ({
					...prev,
					stage: 'error',
					message: '启动导出任务失败',
				}))
				subscription.remove()
			})
		}

		function dismiss() {
			void sheetRef.current?.dismiss()
		}

		const isFinished = stage === 'completed' || stage === 'error'
		const progressValue =
			progress.total > 0 ? progress.current / progress.total : undefined

		const stageTitle =
			stage === 'config'
				? '导出设置'
				: stage === 'completed'
					? '导出完成'
					: stage === 'error'
						? '导出失败'
						: '正在批量导出歌曲'

		return (
			<TrueSheet
				ref={sheetRef}
				detents={[0.75]}
				cornerRadius={24}
				backgroundColor={colors.elevation.level1}
				scrollable
				dismissible={stage === 'config' || isFinished}
				onDidDismiss={() => {
					setProgress({
						current: 0,
						total: ids.length,
						failed: 0,
						stage: 'config',
						message: '准备导出...',
					})
					hasStarted.current = false
					setFilenamePattern('{name}')
					setEmbedLyrics(false)
					setConvertToLrc(false)
				}}
			>
				<GestureHandlerRootView style={{ flex: 1 }}>
					<View style={styles.sheetHeader}>
						<Text
							variant='titleLarge'
							style={styles.sheetTitle}
						>
							{stageTitle}
						</Text>
					</View>
					<ScrollView
						style={{ flex: 1 }}
						contentContainerStyle={[
							styles.sheetContent,
							{ paddingBottom: insets.bottom + 16 },
						]}
						nestedScrollEnabled
					>
						{stage === 'config' ? (
							<>
								{/* ── 文件名模板 ── */}
								<Text
									variant='labelLarge'
									style={styles.sectionTitle}
								>
									文件名模板
								</Text>
								<TextInput
									label='文件名模板'
									value={filenamePattern}
									onChangeText={setFilenamePattern}
									mode='outlined'
									placeholder='{name}'
									autoCapitalize='none'
									autoCorrect={false}
									dense
								/>
								<HelperText
									type={
										!filenamePattern.trim() ||
										patternHasVariable(filenamePattern)
											? 'info'
											: 'error'
									}
									visible
									style={styles.helperText}
								>
									{!filenamePattern.trim()
										? '为空时使用默认模板 {name}'
										: patternHasVariable(filenamePattern)
											? `预览：${buildPreviewFilename(filenamePattern)}`
											: '模板中未包含任何变量，将自动替换为 {name}'}
								</HelperText>
								{/* 可用变量说明 */}
								<View style={styles.variableBox}>
									<Text
										variant='labelSmall'
										style={styles.variableTitle}
									>
										可用变量
									</Text>
									{[
										['id', '曲目唯一 ID'],
										['name', '曲目标题'],
										['artist', '艺术家'],
										['bvid', 'B 站 BV 号'],
										['cid', 'B 站 CID（如果不是分 P 视频则为空）'],
									].map(([v, desc]) => (
										<Text
											key={v}
											variant='bodySmall'
											style={styles.variableRow}
										>
											<Text style={styles.variableTag}>{`{${v}}`}</Text>
											{'  '}
											{desc}
										</Text>
									))}
								</View>

								<Divider style={styles.divider} />

								{/* ── 内嵌歌词开关 ── */}
								<View style={styles.switchRow}>
									<View style={styles.switchLabel}>
										<Text variant='labelLarge'>内嵌歌词</Text>
									</View>
									<Switch
										value={embedLyrics}
										onValueChange={setEmbedLyrics}
									/>
								</View>
								<HelperText
									type='info'
									visible
									style={styles.helperText}
								>
									只有在播放器「歌词」页面加载过歌词的曲目才会包含内嵌歌词——歌词在播放时加载并缓存到本地，未打开过歌词页面的曲目将不含内嵌歌词。
								</HelperText>

								{/* ── SPL → LRC 开关（仅 embedLyrics 开启时显示）── */}
								{embedLyrics && (
									<>
										<Divider style={styles.divider} />
										<View style={styles.switchRow}>
											<View style={styles.switchLabel}>
												<Text variant='labelLarge'>转换为标准 LRC</Text>
											</View>
											<Switch
												value={convertToLrc}
												onValueChange={setConvertToLrc}
											/>
										</View>
										<HelperText
											type='info'
											visible
											style={styles.helperText}
										>
											BBPlayer 歌词遵循 SPL 规范（LRC
											超集），支持逐字时间戳（卡拉OK高亮效果）。但大多数播放器（除椒盐音乐外，因为这个规范就来自椒盐音乐）无法识别
											SPL 逐字语法，开启后将转换为所有播放器均可读取的标准
											LRC（逐字信息将被移除）。
										</HelperText>
									</>
								)}

								<Divider style={styles.divider} />

								{/* ── 裁剪封面开关 ── */}
								<View style={styles.switchRow}>
									<View style={styles.switchLabel}>
										<Text variant='labelLarge'>裁剪封面为正方形</Text>
									</View>
									<Switch
										value={cropCoverArt}
										onValueChange={setCropCoverArt}
									/>
								</View>
								<HelperText
									type='info'
									visible
									style={styles.helperText}
								>
									Bilibili 封面通常为 16:9，开启后将按中心裁剪为 1:1
									方形，符合主流音乐播放器的封面规范。
								</HelperText>

								<Divider style={styles.divider} />

								<View style={styles.actionRow}>
									<Button onPress={dismiss}>取消</Button>
									<Button
										mode='contained'
										onPress={startExport}
									>
										开始导出
									</Button>
								</View>
							</>
						) : (
							<>
								<View style={styles.progressContent}>
									<Text
										variant='bodyMedium'
										style={styles.message}
										numberOfLines={2}
									>
										{progress.message}
									</Text>
									<ProgressBar
										progress={isFinished ? 1 : progressValue}
										indeterminate={!isFinished && progressValue === undefined}
										style={styles.progressBar}
									/>
								</View>

								<View style={styles.actionRow}>
									<Button
										onPress={dismiss}
										disabled={!isFinished}
									>
										{isFinished ? '关闭' : '请稍候'}
									</Button>
								</View>
							</>
						)}
					</ScrollView>
				</GestureHandlerRootView>
			</TrueSheet>
		)
	},
)

ExportDownloadsProgressModal.displayName = 'ExportDownloadsProgressModal'

const styles = StyleSheet.create({
	sheetContent: {
		paddingHorizontal: 24,
		paddingTop: 8,
		gap: 2,
	},
	sheetHeader: {
		paddingHorizontal: 24,
		paddingTop: 26,
		paddingBottom: 16,
	},
	sheetTitle: {
		fontWeight: '700',
	},
	sectionTitle: {
		marginBottom: 6,
		marginTop: 4,
	},
	helperText: {
		marginTop: 0,
		paddingHorizontal: 0,
	},
	variableBox: {
		marginTop: 8,
		marginBottom: 4,
		paddingHorizontal: 12,
		paddingVertical: 8,
		borderRadius: 6,
		gap: 4,
		backgroundColor: 'rgba(128,128,128,0.08)',
	},
	variableTitle: {
		marginBottom: 4,
		opacity: 0.6,
	},
	variableRow: {
		opacity: 0.8,
	},
	variableTag: {
		fontFamily: 'monospace',
		fontWeight: '600',
	},
	divider: {
		marginVertical: 12,
	},
	switchRow: {
		flexDirection: 'row',
		justifyContent: 'space-between',
		alignItems: 'center',
	},
	switchLabel: {
		flex: 1,
		paddingRight: 8,
	},
	actionRow: {
		flexDirection: 'row',
		justifyContent: 'flex-end',
		gap: 8,
		marginTop: 8,
	},
	progressContent: {
		gap: 15,
		paddingVertical: 10,
	},
	message: {
		textAlign: 'center',
		height: 40,
	},
	progressBar: {
		height: 8,
		borderRadius: 4,
	},
})

export default ExportDownloadsProgressModal
