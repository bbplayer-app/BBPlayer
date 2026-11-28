import { StyleSheet, View } from 'react-native'
import { Icon, Text, TouchableRipple, useTheme } from 'react-native-paper'

import type { ResumeCardInfo } from '@/features/playlist/resume/useMultiPageResume'

interface ResumeCardProps {
	info: ResumeCardInfo
	onPress: () => void
	/** 跟随封面取色，不传时用主题的 secondaryContainer */
	containerColor?: string
	contentColor?: string
}

/**
 * 多 P 视频的续播卡片，放在歌单头部按钮行下面。
 * 写出分 P 标题，听书时光看「P7」不知道是哪一章
 */
export function ResumeCard({
	info,
	onPress,
	containerColor,
	contentColor,
}: ResumeCardProps) {
	const { colors } = useTheme()
	const backgroundColor = containerColor ?? colors.secondaryContainer
	const color = contentColor ?? colors.onSecondaryContainer

	return (
		<View style={[styles.container, { backgroundColor }]}>
			<TouchableRipple
				onPress={onPress}
				testID='playlist-resume-card'
				accessibilityRole='button'
				style={styles.ripple}
			>
				<View style={styles.content}>
					<Icon
						source={info.listening ? 'volume-high' : 'play-circle'}
						size={28}
						color={color}
					/>
					<View style={styles.texts}>
						<Text
							variant='labelLarge'
							style={{ color }}
						>
							{info.listening
								? `正在播放 P${info.partNumber}`
								: `续播 P${info.partNumber}`}
						</Text>
						<Text
							variant='bodyMedium'
							style={{ color }}
							numberOfLines={1}
						>
							{info.title}
						</Text>
					</View>
				</View>
			</TouchableRipple>
		</View>
	)
}

const styles = StyleSheet.create({
	container: {
		borderRadius: 12,
		overflow: 'hidden',
	},
	ripple: {
		paddingHorizontal: 16,
		paddingVertical: 10,
	},
	content: {
		flexDirection: 'row',
		alignItems: 'center',
		gap: 12,
	},
	texts: {
		flex: 1,
	},
})
