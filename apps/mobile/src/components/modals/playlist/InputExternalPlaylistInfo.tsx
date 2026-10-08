import { SegmentedControl } from '@expo/ui/community/segmented-control'
import { useQueryClient } from '@tanstack/react-query'
import * as Clipboard from 'expo-clipboard'
import * as DocumentPicker from 'expo-document-picker'
import { File } from 'expo-file-system'
import { useRouter } from 'expo-router'
import { useState } from 'react'
import { Linking, StyleSheet, View } from 'react-native'
import {
	Dialog,
	Text,
	TextInput,
	TouchableRipple,
	useTheme,
} from 'react-native-paper'

import Button from '@/components/common/Button'
import IconButton from '@/components/common/IconButton'
import { playlistKeys } from '@/hooks/queries/db/playlist'
import { useModalStore } from '@/hooks/stores/useModalStore'
import { syncExternalPlaylistFacade } from '@/lib/facades/syncExternalPlaylist'
import { playlistOutService } from '@/lib/services/playlistOutService'
import {
	parseKugouCredentialsInput,
	playlistOutStorage,
} from '@/lib/storage/playlistOutStorage'
import { parseExternalPlaylistInfo } from '@/lib/utils/playlistUrlParser'
import type { GenericPlaylist, GenericTrack } from '@/types/external_playlist'
import toast from '@/utils/toast'

const PLATFORMS = [
	{
		key: 'qq',
		label: 'QQ音乐',
		bg: '#2BB66A',
		text: '#FFFFFF',
	},
	{
		key: 'netease',
		label: '网易云音乐',
		bg: '#D43C33',
		text: '#FFFFFF',
	},
	{
		key: 'kugou',
		label: '酷狗音乐',
		bg: '#0C8ED9',
		text: '#FFFFFF',
	},
	{
		key: 'qishui',
		label: '汽水音乐',
		bg: '#00C2B8',
		text: '#FFFFFF',
	},
] as const

const PLAYLISTOUT_WEB_URL = 'https://playlistout.lengxiqwq.com'

const InputExternalPlaylistInfoModal = () => {
	const theme = useTheme()
	const router = useRouter()
	const queryClient = useQueryClient()
	const close = useModalStore((state) => state.close)

	// Mode state: 'smart' (default) vs 'legacy'
	const [mode, setMode] = useState<'smart' | 'legacy'>(() =>
		playlistOutStorage.getImportMode(),
	)
	const [showKugouSettings, setShowKugouSettings] = useState(false)
	const [kugouTokenInput, setKugouTokenInput] = useState(() =>
		playlistOutStorage.getKugouToken(),
	)
	const [kugouUseridInput, setKugouUseridInput] = useState(() =>
		playlistOutStorage.getKugouUserid(),
	)
	const [isValidatingKugou, setIsValidatingKugou] = useState(false)
	const [kugouValidationResult, setKugouValidationResult] = useState<{
		valid: boolean
		message: string
	} | null>(null)

	// Smart mode inputs
	const [smartInput, setSmartInput] = useState('')
	const [isResolving, setIsResolving] = useState(false)

	// Legacy mode inputs
	const [legacyInput, setLegacyInput] = useState('')
	const [legacySource, setLegacySource] = useState<'netease' | 'qq'>('netease')

	const detectedPlatform = playlistOutService.detectPlatform(smartInput)
	const kugouStatus = playlistOutStorage.isKugouConfigured()

	const switchMode = (newMode: 'smart' | 'legacy') => {
		setMode(newMode)
		playlistOutStorage.setImportMode(newMode)
	}

	const handlePaste = async () => {
		try {
			const text = await Clipboard.getStringAsync()
			if (text) {
				setSmartInput(text.trim())
				toast.info('已粘贴剪贴板内容')
			} else {
				toast.info('剪贴板为空')
			}
		} catch {
			toast.error('无法读取剪贴板')
		}
	}

	const handleOpenWebsite = async () => {
		try {
			await Linking.openURL(PLAYLISTOUT_WEB_URL)
		} catch {
			toast.error('无法打开外部浏览器')
		}
	}

	const handleDirectBilibiliImport = async (data: {
		playlist: GenericPlaylist
		tracks: GenericTrack[]
	}): Promise<boolean> => {
		if (!playlistOutService.isDirectBilibiliPlaylist(data)) {
			return false
		}
		const loadingToast = toast.loading('检测到哔哩哔哩歌单，正在直接导入...')
		try {
			const saveRes =
				await syncExternalPlaylistFacade.saveDirectBilibiliPlaylist(
					{
						title: data.playlist.title,
						coverUrl: data.playlist.coverUrl ?? '',
						description: data.playlist.description ?? '',
					},
					data.tracks,
				)
			toast.dismiss(loadingToast)
			if (saveRes.isErr()) {
				toast.error(`直接导入失败: ${saveRes.error.message}`)
				return true
			}
			await queryClient.invalidateQueries({
				queryKey: playlistKeys.playlistLists(),
			})
			toast.success('哔哩哔哩歌单已直接导入到本地')
			const playlistId = saveRes.value
			close('InputExternalPlaylistInfo')
			useModalStore.getState().doAfterModalHostClosed(() => {
				router.navigate(`/playlist/local/${playlistId}`)
			})
			return true
		} catch (e) {
			toast.dismiss(loadingToast)
			toast.error(`直接导入失败: ${e instanceof Error ? e.message : String(e)}`)
			return true
		}
	}

	const handleSmartResolve = async () => {
		const trimmed = smartInput.trim()
		if (!trimmed) {
			toast.error('请输入歌单链接')
			return
		}

		setIsResolving(true)
		// If input is raw JSON text, parse it directly
		if (trimmed.startsWith('{') || trimmed.startsWith('[')) {
			const jsonRes = playlistOutService.parseJsonPlaylist(trimmed)
			if (jsonRes.isErr()) {
				setIsResolving(false)
				toast.error(jsonRes.error.message)
				return
			}
			if (await handleDirectBilibiliImport(jsonRes.value)) {
				setIsResolving(false)
				return
			}
			setIsResolving(false)
			const cacheId = jsonRes.value.playlist.id
			playlistOutService.setCachedPlaylist(cacheId, jsonRes.value)
			close('InputExternalPlaylistInfo')
			useModalStore.getState().doAfterModalHostClosed(() => {
				router.navigate({
					pathname: '/playlist/external-sync',
					params: { id: cacheId, source: 'local_json' },
				})
			})
			return
		}

		// If input is an online .json URL, resolve it so Bilibili JSON can be imported directly
		if (/^https?:\/\/[^\s]+\.json(?:\?[^\s]*)?$/i.test(trimmed)) {
			const resolveRes = await playlistOutService.resolvePlaylist(trimmed)
			if (resolveRes.isErr()) {
				setIsResolving(false)
				toast.error(resolveRes.error.message)
				return
			}
			if (await handleDirectBilibiliImport(resolveRes.value)) {
				setIsResolving(false)
				return
			}
			setIsResolving(false)
			const cacheId = resolveRes.value.playlist.id
			playlistOutService.setCachedPlaylist(cacheId, resolveRes.value)
			close('InputExternalPlaylistInfo')
			useModalStore.getState().doAfterModalHostClosed(() => {
				router.navigate({
					pathname: '/playlist/external-sync',
					params: { id: cacheId, source: 'local_json' },
				})
			})
			return
		}

		// Navigate to external-sync with playlistout source for API resolution
		setIsResolving(false)
		close('InputExternalPlaylistInfo')
		useModalStore.getState().doAfterModalHostClosed(() => {
			router.navigate({
				pathname: '/playlist/external-sync',
				params: { id: trimmed, source: 'playlistout' },
			})
		})
	}

	const handlePickLocalJson = async () => {
		try {
			const res = await DocumentPicker.getDocumentAsync({
				type: ['application/json', 'text/json', '*/*'],
				copyToCacheDirectory: true,
			})
			if (res.canceled || !res.assets?.[0]?.uri) return

			const asset = res.assets[0]
			const file = new File(asset.uri)
			const content = await file.text()
			const jsonRes = playlistOutService.parseJsonPlaylist(
				content,
				asset.name ? asset.name.replace(/\.json$/i, '') : '本地导入歌单',
			)

			if (jsonRes.isErr()) {
				toast.error(jsonRes.error.message)
				return
			}

			if (await handleDirectBilibiliImport(jsonRes.value)) {
				return
			}

			const cacheId = jsonRes.value.playlist.id
			playlistOutService.setCachedPlaylist(cacheId, jsonRes.value)
			close('InputExternalPlaylistInfo')
			useModalStore.getState().doAfterModalHostClosed(() => {
				router.navigate({
					pathname: '/playlist/external-sync',
					params: { id: cacheId, source: 'local_json' },
				})
			})
		} catch (e) {
			toast.error(
				`读取本地文件失败: ${e instanceof Error ? e.message : String(e)}`,
			)
		}
	}

	const handleTokenChange = (text: string) => {
		const parsed = parseKugouCredentialsInput(text)
		if (parsed) {
			setKugouTokenInput(parsed.token)
			if (parsed.userid) {
				setKugouUseridInput(parsed.userid)
				toast.info('已自动识别并拆分填入 Token 与 UID')
			}
		} else {
			setKugouTokenInput(text)
		}
		setKugouValidationResult(null)
	}

	const handleUseridChange = (text: string) => {
		const parsed = parseKugouCredentialsInput(text)
		if (parsed) {
			setKugouTokenInput(parsed.token)
			if (parsed.userid) {
				setKugouUseridInput(parsed.userid)
				toast.info('已自动识别并拆分填入 Token 与 UID')
			}
		} else {
			setKugouUseridInput(text)
		}
		setKugouValidationResult(null)
	}

	const handleValidateKugou = async () => {
		if (!kugouTokenInput.trim() && !kugouUseridInput.trim()) {
			toast.info('请先填入 Token 与 UID')
			return
		}
		setIsValidatingKugou(true)
		const res = await playlistOutService.verifyKugouCredentials(
			kugouTokenInput,
			kugouUseridInput,
		)
		setIsValidatingKugou(false)
		setKugouValidationResult(res)
		if (res.valid) {
			toast.success(res.message)
		} else {
			toast.error(res.message)
		}
	}

	const handleSaveKugouToken = () => {
		playlistOutStorage.setKugouCredentials(kugouTokenInput, kugouUseridInput)
		toast.success('酷狗凭据已保存')
		setShowKugouSettings(false)
	}

	const handleClearKugouToken = () => {
		playlistOutStorage.clearKugouCredentials()
		setKugouTokenInput('')
		setKugouUseridInput('')
		setKugouValidationResult(null)
		toast.success('酷狗凭据已清空')
		setShowKugouSettings(false)
	}

	const handleLegacyConfirm = () => {
		if (!legacyInput.trim()) return
		const parsed = parseExternalPlaylistInfo(legacyInput)
		const finalId = parsed?.id ?? legacyInput.trim()
		const finalSource = parsed?.source ?? legacySource

		close('InputExternalPlaylistInfo')
		useModalStore.getState().doAfterModalHostClosed(() => {
			router.navigate({
				pathname: '/playlist/external-sync',
				params: { id: finalId, source: finalSource },
			})
		})
	}

	// Sub-view: Kugou Token & UserID Settings
	if (showKugouSettings) {
		const isConfigured = Boolean(
			playlistOutStorage.getKugouToken() || playlistOutStorage.getKugouUserid(),
		)
		return (
			<>
				<Dialog.Title>⚙️ 酷狗音乐解析设置</Dialog.Title>
				<Dialog.Content>
					<Text
						variant='bodySmall'
						style={{ color: theme.colors.onSurfaceVariant, marginBottom: 12 }}
					>
						因酷狗官方限制，解析完整歌单必须同时提供 Token 与用户 ID
						(UID)。未配置或缺少 UID 时仅能解析前 10 首。
					</Text>

					<TextInput
						label='酷狗 Token'
						value={kugouTokenInput}
						onChangeText={handleTokenChange}
						mode='outlined'
						style={styles.input}
						placeholder='粘贴获取的 Token（支持自动拆分）'
					/>

					<TextInput
						label='酷狗 用户 ID (UID)'
						value={kugouUseridInput}
						onChangeText={handleUseridChange}
						mode='outlined'
						style={styles.input}
						placeholder='粘贴获取的 User ID'
					/>

					<View style={styles.settingsActionRow}>
						<Button
							mode='contained-tonal'
							icon='open-in-new'
							onPress={handleOpenWebsite}
							style={{ flex: 1, marginRight: 8 }}
						>
							网页端获取凭据
						</Button>
						<Button
							mode='outlined'
							icon='check-circle-outline'
							onPress={handleValidateKugou}
							loading={isValidatingKugou}
							disabled={isValidatingKugou}
							style={{ flex: 1 }}
						>
							测试连接
						</Button>
					</View>

					{kugouValidationResult && (
						<Text
							variant='labelSmall'
							style={{
								marginTop: 8,
								color: kugouValidationResult.valid
									? theme.colors.primary
									: theme.colors.error,
								fontWeight: '600',
							}}
						>
							{kugouValidationResult.valid ? '✅ ' : '❌ '}
							{kugouValidationResult.message}
						</Text>
					)}

					<View
						style={[
							styles.hintBox,
							{ backgroundColor: theme.colors.elevation.level2, marginTop: 10 },
						]}
					>
						<Text
							variant='labelSmall'
							style={{ color: theme.colors.primary, lineHeight: 18 }}
						>
							💡 获取方式：{'\n'}
							1. 点击上方「网页端获取凭据」在网页中扫码登录酷狗{'\n'}
							2. 分别点击「复制 Token」和「复制 User ID」粘贴到此处{'\n'}
							3. 点击「测试连接」验证通过后点击保存即可！{'\n'}📌
							说明：酷狗接口仅允许解锁本人创建/收藏的歌单；他人歌单受限制仅能预览
							10 首，他人歌单建议在网页端导出 JSON 导入。
						</Text>
					</View>
				</Dialog.Content>
				<Dialog.Actions>
					{isConfigured ? (
						<Button onPress={handleClearKugouToken}>清空</Button>
					) : null}
					<Button onPress={() => setShowKugouSettings(false)}>取消</Button>
					<Button
						mode='contained'
						onPress={handleSaveKugouToken}
					>
						保存
					</Button>
				</Dialog.Actions>
			</>
		)
	}

	// View: Legacy Mode
	if (mode === 'legacy') {
		return (
			<>
				<View style={styles.headerRow}>
					<Dialog.Title style={styles.titleText}>输入外部歌单信息</Dialog.Title>
					<Button
						mode='text'
						compact
						onPress={() => switchMode('smart')}
					>
						智能模式
					</Button>
				</View>
				<Dialog.Content>
					<TextInput
						label='歌单 ID / 链接'
						value={legacyInput}
						onChangeText={(text) => {
							setLegacyInput(text)
							const result = parseExternalPlaylistInfo(text)
							if (result) {
								setLegacySource(result.source)
							}
						}}
						mode='outlined'
						style={styles.input}
					/>
					<View style={styles.segmentedContainer}>
						<Text style={styles.label}>来源：</Text>
						<SegmentedControl
							selectedIndex={legacySource === 'netease' ? 0 : 1}
							onChange={(event) => {
								const selectedIndex = event.nativeEvent.selectedSegmentIndex
								setLegacySource(selectedIndex === 0 ? 'netease' : 'qq')
							}}
							values={['网易云音乐', 'QQ音乐']}
							style={styles.segmentedButtons}
						/>
					</View>
				</Dialog.Content>
				<Dialog.Actions>
					<Button onPress={() => close('InputExternalPlaylistInfo')}>
						取消
					</Button>
					<Button
						onPress={handleLegacyConfirm}
						disabled={!legacyInput.trim()}
					>
						确定
					</Button>
				</Dialog.Actions>
			</>
		)
	}

	// View: Smart PlaylistOut Mode (Default)
	return (
		<>
			<View style={styles.headerRow}>
				<Dialog.Title style={styles.titleText}>导入外部歌单</Dialog.Title>
				<View style={styles.headerRightActions}>
					<IconButton
						icon='cog-outline'
						size={20}
						onPress={() => {
							setKugouTokenInput(playlistOutStorage.getKugouToken())
							setKugouUseridInput(playlistOutStorage.getKugouUserid())
							setKugouValidationResult(null)
							setShowKugouSettings(true)
						}}
					/>
					<Button
						mode='text'
						compact
						onPress={() => switchMode('legacy')}
					>
						旧版模式
					</Button>
				</View>
			</View>

			<Dialog.Content style={styles.smartContent}>
				{/* 智能输入框 */}
				<TextInput
					label='歌单链接'
					placeholder='粘贴歌单链接'
					value={smartInput}
					onChangeText={setSmartInput}
					mode='outlined'
					style={styles.input}
					right={
						<TextInput.Icon
							icon='content-paste'
							onPress={handlePaste}
						/>
					}
				/>

				{/* 平台指示标签：整块圆角矩形背景点亮各平台专属品牌色 */}
				<View style={styles.platformRow}>
					{PLATFORMS.map((p) => {
						const isMatched = detectedPlatform === p.key
						return (
							<View
								key={p.key}
								style={[
									styles.platformChip,
									{
										backgroundColor: isMatched
											? p.bg
											: theme.colors.elevation.level2,
									},
								]}
							>
								<Text
									variant='labelSmall'
									style={[
										styles.platformLabel,
										{
											color: isMatched ? p.text : theme.colors.onSurfaceVariant,
											fontWeight: isMatched ? 'bold' : 'normal',
										},
									]}
								>
									{p.label}
								</Text>
							</View>
						)
					})}
				</View>

				{/* 提示信息卡片：通用解析方式 + 酷狗音乐特殊说明 */}
				<View
					style={[
						styles.infoNoticeCard,
						{ backgroundColor: theme.colors.elevation.level2 },
					]}
				>
					<View style={styles.noticeItemRow}>
						<Text style={[styles.bulletDot, { color: theme.colors.primary }]}>
							•
						</Text>
						<Text
							variant='bodySmall'
							style={[
								styles.noticeTextLine,
								{ color: theme.colors.onSurfaceVariant },
							]}
						>
							可直接粘贴以上支持的链接，或在网页端解析后导出 JSON 进行本地导入
						</Text>
					</View>
					<View style={[styles.noticeItemRow, { marginTop: 6 }]}>
						<Text style={[styles.bulletDot, { color: theme.colors.primary }]}>
							•
						</Text>
						<Text
							variant='bodySmall'
							style={[
								styles.noticeTextLine,
								{ color: theme.colors.onSurfaceVariant },
							]}
						>
							{kugouStatus.configured
								? '已配置酷狗凭据，支持完整解析本人创建歌单；他人歌单受限制仅能预览 10 首'
								: kugouStatus.hasToken && !kugouStatus.hasUserid
									? '⚠️ 酷狗已填 Token 但缺少 UID，请点击右上角设置补全 UID 解锁完整歌单'
									: '酷狗音乐未登录受限仅 10 首，需要在右上角设置中填入 Token 与 UID 解锁'}
						</Text>
					</View>
				</View>

				{/* 核心大操作按钮（置于面板内部核心区） */}
				<Button
					mode='contained'
					style={styles.primaryResolveButton}
					contentStyle={styles.primaryResolveButtonContent}
					onPress={handleSmartResolve}
					loading={isResolving}
					disabled={!smartInput.trim() || isResolving}
				>
					开始智能解析
				</Button>

				{/* 辅助操作栏：左侧选择本地 JSON，右侧网页端解析 */}
				<View style={styles.secondaryActionsRow}>
					<Button
						mode='text'
						compact
						icon='folder-outline'
						onPress={handlePickLocalJson}
						textColor={theme.colors.secondary}
						style={styles.auxButton}
					>
						选择本地 JSON
					</Button>
					<Button
						mode='text'
						compact
						icon='open-in-new'
						onPress={handleOpenWebsite}
						textColor={theme.colors.secondary}
						style={styles.auxButton}
					>
						网页端解析
					</Button>
				</View>
			</Dialog.Content>

			{/* 底部操作区：署名水平居中，取消按钮靠右 */}
			<View style={styles.footerRow}>
				<View
					style={styles.centerAttributionContainer}
					pointerEvents='none'
				>
					<Text
						variant='labelSmall'
						style={[styles.footerText, { color: theme.colors.outline }]}
					>
						Powered by Playlist Out
					</Text>
				</View>
				<TouchableRipple
					onPress={() => close('InputExternalPlaylistInfo')}
					style={styles.cancelRipple}
					borderless
				>
					<Text style={[styles.cancelText, { color: theme.colors.primary }]}>
						取消
					</Text>
				</TouchableRipple>
			</View>
		</>
	)
}

const styles = StyleSheet.create({
	headerRow: {
		flexDirection: 'row',
		alignItems: 'center',
		justifyContent: 'space-between',
		paddingRight: 8,
	},
	headerRightActions: {
		flexDirection: 'row',
		alignItems: 'center',
	},
	titleText: {
		flex: 1,
	},
	smartContent: {
		paddingTop: 4,
		paddingBottom: 0,
	},
	input: {
		marginBottom: 10,
	},
	platformRow: {
		flexDirection: 'row',
		marginBottom: 12,
		gap: 6,
	},
	platformChip: {
		flex: 1,
		paddingVertical: 6,
		paddingHorizontal: 4,
		borderRadius: 8,
		alignItems: 'center',
		justifyContent: 'center',
	},
	platformLabel: {
		fontSize: 11,
	},
	infoNoticeCard: {
		borderRadius: 12,
		paddingVertical: 10,
		paddingHorizontal: 12,
		marginBottom: 14,
	},
	noticeItemRow: {
		flexDirection: 'row',
		alignItems: 'flex-start',
	},
	bulletDot: {
		fontSize: 14,
		lineHeight: 18,
		marginRight: 6,
		fontWeight: 'bold',
	},
	noticeTextLine: {
		flex: 1,
		fontSize: 12,
		lineHeight: 18,
	},
	openWebButton: {
		marginTop: 4,
		marginBottom: 10,
		borderRadius: 12,
	},
	settingsActionRow: {
		flexDirection: 'row',
		marginTop: 4,
		marginBottom: 6,
	},
	hintBox: {
		borderRadius: 8,
		padding: 10,
	},
	primaryResolveButton: {
		borderRadius: 24,
		marginBottom: 8,
	},
	primaryResolveButtonContent: {
		height: 48,
	},
	secondaryActionsRow: {
		flexDirection: 'row',
		justifyContent: 'space-around',
		alignItems: 'center',
		marginBottom: 4,
	},
	auxButton: {
		borderRadius: 16,
	},
	footerRow: {
		position: 'relative',
		flexDirection: 'row',
		justifyContent: 'flex-end',
		alignItems: 'center',
		paddingHorizontal: 24,
		paddingBottom: 16,
		paddingTop: 6,
		minHeight: 40,
	},
	centerAttributionContainer: {
		position: 'absolute',
		left: 0,
		right: 0,
		top: 0,
		bottom: 0,
		justifyContent: 'center',
		alignItems: 'center',
	},
	footerText: {
		fontSize: 11,
		letterSpacing: 0.5,
	},
	cancelRipple: {
		paddingVertical: 6,
		paddingHorizontal: 8,
		marginRight: -8,
		borderRadius: 8,
	},
	cancelText: {
		fontSize: 14,
		fontWeight: '600',
	},
	segmentedContainer: {
		marginTop: 8,
	},
	label: {
		marginBottom: 8,
	},
	segmentedButtons: {
		marginTop: 4,
	},
})

export default InputExternalPlaylistInfoModal
