import { Fragment, memo } from 'react'
import { Pressable, StyleSheet, View } from 'react-native'
import { Text, useTheme } from 'react-native-paper'

import {
	subtitleSeparator,
	type SubtitleParagraph,
} from '@/features/player/utils/subtitles'
import { formatDurationToHHMMSS } from '@/utils/time'

export const SubtitleParagraphItem = memo(function SubtitleParagraphItem({
	paragraph,
	currentCue,
	query,
	onSeek,
}: {
	paragraph: SubtitleParagraph
	currentCue: number
	query: string
	onSeek: (index: number) => void
}) {
	const { colors } = useTheme()
	return (
		<View style={styles.paragraph}>
			<Pressable
				onPress={() => onSeek(paragraph.cues[0].index)}
				accessibilityRole='button'
				accessibilityLabel={`跳转到 ${formatDurationToHHMMSS(Math.floor(paragraph.startTime / 1000))}`}
			>
				<Text
					variant='labelMedium'
					style={{
						color: colors.onSurfaceVariant,
						paddingVertical: 8,
						fontVariant: ['tabular-nums'],
					}}
				>
					{formatDurationToHHMMSS(Math.floor(paragraph.startTime / 1000))}
				</Text>
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
	paragraph: { paddingHorizontal: 24, paddingBottom: 16 },
	body: { fontSize: 18, lineHeight: 30, fontWeight: '400' },
})
