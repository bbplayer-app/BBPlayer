import { Orpheus } from '@bbplayer/orpheus'
import type { AudioQualityInfo } from '@bbplayer/orpheus'
import { useCallback, useEffect, useRef, useState } from 'react'
import { ScrollView } from 'react-native'
import { Dialog } from 'react-native-paper'

import Button from '@/components/common/Button'
import {
	createAudioQualityReadVersion,
	formatActualAudioQuality,
	formatAudioQualityLabel,
	getAudioQualityAccessHint,
	getDolbyOptionNotice,
	getVisibleAudioQualityOptions,
	resolveSelectedAudioQualityPreference,
} from '@/constants/audioQuality'
import useDolbySupport from '@/hooks/player/useDolbySupport'
import usePreferredAudioQuality from '@/hooks/player/usePreferredAudioQuality'
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

	const preference = usePreferredAudioQuality()

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
	} = useAudioQualitySwitch({ preference, actualQuality })

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

	// 切换中偏好已经变了但曲目还没重新加载，这时不提示「下一首起生效」
	const actual = formatActualAudioQuality(
		actualQuality,
		pendingTarget === null ? preference : undefined,
	)

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
			actualSubtitleText = '正在重新加载这首歌'
			break
		case 'checking':
			actualTitleText = '正在检查当前音质…'
			actualSubtitleText = undefined
			break
		case 'unconfirmed':
			actualTitleText = '暂时没拿到当前音质'
			actualSubtitleText = '可以点「重新检查」再试一次'
			break
		case 'actual':
			actualTitleText = actual ? actual.title : '暂无正在播放的曲目'
			actualSubtitleText = actual ? actual.subtitle : undefined
			break
		case 'loading':
			actualTitleText = '正在读取当前音质…'
			actualSubtitleText = undefined
			break
		case 'load_failed':
			actualTitleText = '读取当前音质失败'
			actualSubtitleText = '可以点「重试」再试一次'
			break
		default:
			actualTitleText = '没有正在播放的歌'
			actualSubtitleText = '选好的默认音质从下一首开始用'
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

	const dolbySupport = useDolbySupport()
	const dolbyNotice = getDolbyOptionNotice(dolbySupport?.level ?? null)

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
						notices={dolbyNotice ? { dolby: dolbyNotice } : undefined}
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
