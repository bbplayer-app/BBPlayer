import { useValue } from '@legendapp/state/react'
import { Fragment, memo } from 'react'
import { Keyboard, Pressable, StyleSheet, Text, View } from 'react-native'
import { useTheme } from 'react-native-paper'

import { VariantPlainText } from '@/components/common/VariantPlainText'
import type { SubtitleReaderStore } from '@/features/player/stores/subtitleReaderStore'
import {
	subtitleSeparator,
	type SubtitleParagraph,
} from '@/features/player/utils/subtitles'
import { formatDurationToHHMMSS } from '@/utils/time'

export const SubtitleParagraphItem = memo(function SubtitleParagraphItem({
	paragraph,
	store,
	query,
}: {
	paragraph: SubtitleParagraph
	store: SubtitleReaderStore
	query: string
}) {
	const { colors } = useTheme()
	const currentCue = useValue(store.state$.paragraphCue[paragraph.id])
	const focusedMatch = useValue(
		() => !!query && store.state$.focusedParagraphId.get() === paragraph.id,
	)
	const onSeek = (index: number) => {
		Keyboard.dismiss()
		void store.seek(index)
	}
	return (
		<View
			style={[
				styles.paragraph,
				{
					borderLeftWidth: 2,
					borderLeftColor: focusedMatch ? colors.primary : 'transparent',
				},
			]}
		>
			<Pressable
				onPress={() => onSeek(paragraph.cues[0].index)}
				accessibilityRole='button'
				accessibilityLabel={`跳转到 ${formatDurationToHHMMSS(Math.floor(paragraph.startTime / 1000))}`}
			>
				<VariantPlainText
					variant='labelMedium'
					style={{
						color: colors.onSurfaceVariant,
						paddingVertical: 8,
						fontVariant: ['tabular-nums'],
					}}
				>
					{formatDurationToHHMMSS(Math.floor(paragraph.startTime / 1000))}
				</VariantPlainText>
			</Pressable>
			<Text style={[styles.body, { color: colors.onSurface }]}>
				{paragraph.cues.map(({ line, index }, cueIndex) => {
					const spoken = index === currentCue
					const matching =
						!!query && line.content.toLocaleLowerCase().includes(query)
					return (
						<Fragment key={`${index}:${line.startTime}`}>
							{cueIndex > 0
								? subtitleSeparator(
										paragraph.cues[cueIndex - 1].line.content,
										line.content,
									)
								: ''}
							<Text
								onPress={() => onSeek(index)}
								accessibilityRole='button'
								accessibilityLabel={`从此句播放：${line.content}`}
								style={{
									backgroundColor: spoken
										? colors.secondaryContainer
										: matching
											? colors.tertiaryContainer
											: 'transparent',
									color: spoken
										? colors.onSecondaryContainer
										: matching
											? colors.onTertiaryContainer
											: colors.onSurface,
								}}
							>
								{line.content}
							</Text>
						</Fragment>
					)
				})}
			</Text>
		</View>
	)
})

const styles = StyleSheet.create({
	paragraph: { paddingLeft: 22, paddingRight: 24, paddingBottom: 16 },
	body: { fontSize: 18, lineHeight: 30, fontWeight: '400' },
})
