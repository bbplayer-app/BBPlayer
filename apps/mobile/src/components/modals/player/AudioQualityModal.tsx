import { Orpheus } from '@bbplayer/orpheus'
import type {
	AudioQualityInfo,
	AudioQualityPreference,
} from '@bbplayer/orpheus'
import { useCallback, useEffect, useRef, useState } from 'react'
import { Platform, ScrollView } from 'react-native'
import { Dialog } from 'react-native-paper'

import Button from '@/components/common/Button'
import {
	createAudioQualityReadVersion,
	formatActualAudioQuality,
	formatAudioQualityLabel,
	getAudioQualityAccessHint,
	getVisibleAudioQualityOptions,
	resolveSelectedAudioQualityPreference,
} from '@/constants/audioQuality'
import { useBilibiliAccountAccess } from '@/hooks/queries/bilibili/user'
import { useModalStore } from '@/hooks/stores/useModalStore'
import { toastAndLogError } from '@/utils/error-handling'

import { AudioQualityCard } from './AudioQualityCard'
import { QUALITY_MESSAGES, showQualityMessage } from './audioQualityMessages'
import { resolveAudioQualityCardState } from './audioQualityModalState'
import { styles } from './audioQualityModalStyles'
import { AudioQualityOptionList } from './AudioQualityOptionList'
import { useAudioQualitySwitch } from './useAudioQualitySwitch'

const AudioQualityModal = () => {
	const close = useModalStore((state) => state.close)

	const [preference, setPreference] = useState<AudioQualityPreference>(() =>
		Platform.OS === 'android' ? Orpheus.preferredAudioQuality : 'high',
	)

	const [actualQuality, setActualQuality] = useState<AudioQualityInfo | null>(
		null,
	)

	const [qualityLoading, setQualityLoading] = useState(true)
	const [qualityLoadFailed, setQualityLoadFailed] = useState(false)
	const [qualityChecking, setQualityChecking] = useState(false)

	const mountedRef = useRef(true)
	const [readVersion] = useState(createAudioQualityReadVersion)

	const {
		pendingTarget,
		qualityUnconfirmed,
		handleQualityEvent,
		applyReadQuality,
		markUnconfirmed,
		switchQuality,
	} = useAudioQualitySwitch({ preference, setPreference, actualQuality })

	const loadCurrentQuality = useCallback(
		async (announce: boolean) => {
			const readToken = readVersion.begin()

			setQualityLoading(true)
			setQualityLoadFailed(false)

			if (announce) {
				setQualityChecking(true)
			}

			try {
				const info = await Orpheus.getCurrentAudioQuality()

				if (!mountedRef.current || !readVersion.isCurrent(readToken)) {
					return
				}

				setActualQuality(info)
				applyReadQuality(info)

				if (announce) {
					if (info !== null && info.actualKind !== 'unknown') {
						showQualityMessage(QUALITY_MESSAGES.recheckOk)
					} else {
						showQualityMessage(QUALITY_MESSAGES.recheckStillUnknown)
					}
				}
			} catch (error) {
				if (!mountedRef.current || !readVersion.isCurrent(readToken)) {
					return
				}

				setQualityLoadFailed(true)

				if (announce) {
					markUnconfirmed()
					showQualityMessage(QUALITY_MESSAGES.recheckStillUnknown)
				} else {
					toastAndLogError(
						QUALITY_MESSAGES.loadFailed.message,
						error,
						'Modal.AudioQuality',
					)
				}
			} finally {
				if (mountedRef.current) {
					setQualityLoading(false)
					setQualityChecking(false)
				}
			}
		},
		[applyReadQuality, markUnconfirmed, readVersion],
	)

	useEffect(() => {
		mountedRef.current = true

		return () => {
			mountedRef.current = false
		}
	}, [])

	useEffect(() => {
		void loadCurrentQuality(false)

		const subscription = Orpheus.addListener(
			'onAudioQualityChanged',
			(info) => {
				readVersion.invalidate()
				setActualQuality(info)
				setQualityLoadFailed(false)
				handleQualityEvent(info)
			},
		)

		return () => {
			subscription.remove()
		}
	}, [handleQualityEvent, loadCurrentQuality, readVersion])

	const actual = formatActualAudioQuality(actualQuality)

	const hasConfirmedActual =
		actualQuality !== null && actualQuality.actualKind !== 'unknown'

	const cardState = resolveAudioQualityCardState(
		pendingTarget !== null,
		qualityChecking,
		qualityUnconfirmed,
		hasConfirmedActual,
		qualityLoading,
		qualityLoadFailed,
	)

	let actualTitleText: string
	let actualSubtitleText: string | undefined

	switch (cardState) {
		case 'pending':
			actualTitleText = pendingTarget
				? `切换到 ${formatAudioQualityLabel(pendingTarget)}…`
				: '正在切换音质…'
			actualSubtitleText = '正在请求播放器重新加载当前曲目。'
			break
		case 'checking':
			actualTitleText = '正在检查当前音质…'
			actualSubtitleText = '正在向播放服务重新读取实际音质。'
			break
		case 'unconfirmed':
			actualTitleText = '音质未确认'
			actualSubtitleText = '播放器没有回填实际音质，可点「重新检查」。'
			break
		case 'actual':
			actualTitleText = actual ? actual.title : '暂无正在播放的曲目'
			actualSubtitleText = actual ? actual.subtitle : undefined
			break
		case 'loading':
			actualTitleText = '正在读取当前音质'
			actualSubtitleText = '正在向播放服务查询当前音质。'
			break
		case 'load_failed':
			actualTitleText = '读取当前音质失败'
			actualSubtitleText = '播放服务暂时没有返回结果，可以重试。'
			break
		default:
			actualTitleText = '暂无正在播放的曲目'
			actualSubtitleText = '选好档位会存为默认音质，下一首播放时生效。'
	}

	const accountAccess = useBilibiliAccountAccess()

	const visibleOptions = getVisibleAudioQualityOptions({
		accountTier: accountAccess.tier,
		availableQualities: actualQuality?.availableQualities,
		isFromDownloadCache: actualQuality?.isFromDownloadCache,
	})

	const selectedPreference = resolveSelectedAudioQualityPreference(
		preference,
		visibleOptions,
	)

	const accessHint = getAudioQualityAccessHint(accountAccess.tier)

	return (
		<>
			<Dialog.Title>音质</Dialog.Title>
			<Dialog.Content style={styles.content}>
				<ScrollView
					style={styles.scroll}
					contentContainerStyle={styles.scrollContent}
					showsVerticalScrollIndicator={false}
				>
					<AudioQualityCard
						showPendingIndicator={pendingTarget !== null}
						titleText={actualTitleText}
						subtitleText={actualSubtitleText}
						showSpinner={pendingTarget !== null}
						showRecheckButton={
							pendingTarget === null &&
							(qualityUnconfirmed || (qualityLoadFailed && actual === null))
						}
						recheckLabel={qualityUnconfirmed ? '重新检查' : '重试'}
						onRecheck={() => {
							void loadCurrentQuality(true)
						}}
					/>
					<AudioQualityOptionList
						options={visibleOptions}
						selected={selectedPreference}
						onSelect={(next) => {
							void switchQuality(next)
						}}
						accessHint={accessHint}
					/>
				</ScrollView>
			</Dialog.Content>
			<Dialog.Actions>
				<Button onPress={() => close('AudioQuality')}>关闭</Button>
			</Dialog.Actions>
		</>
	)
}

export default AudioQualityModal
