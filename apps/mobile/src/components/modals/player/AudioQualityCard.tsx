import { View } from 'react-native'
import { Surface, Text, useTheme } from 'react-native-paper'

import ActivityIndicator from '@/components/common/ActivityIndicator'
import Button from '@/components/common/Button'

import { styles } from './audioQualityModalStyles'

export interface AudioQualityCardProps {
	showPendingIndicator: boolean
	titleText: string
	subtitleText: string | undefined
	showSpinner: boolean
	showRecheckButton: boolean
	recheckLabel: string
	onRecheck: () => void
}

export function AudioQualityCard({
	showPendingIndicator,
	titleText,
	subtitleText,
	showSpinner,
	showRecheckButton,
	recheckLabel,
	onRecheck,
}: AudioQualityCardProps) {
	const colors = useTheme().colors

	return (
		<Surface
			elevation={0}
			style={[
				styles.actualCard,
				{ backgroundColor: colors.secondaryContainer },
			]}
		>
			<View style={styles.actualHeader}>
				<Text
					variant='labelMedium'
					style={[
						styles.actualHeaderLabel,
						{ color: colors.onSecondaryContainer },
					]}
				>
					当前实际播放音质
				</Text>
				<View style={styles.actualStatus}>
					{showPendingIndicator && (
						<Text
							variant='labelSmall'
							style={{ color: colors.onSecondaryContainer }}
						>
							切换中…
						</Text>
					)}
					<View style={styles.actualIndicatorSlot}>
						{showSpinner && (
							<ActivityIndicator
								size={14}
								color={colors.onSecondaryContainer}
							/>
						)}
					</View>
				</View>
			</View>
			<Text
				variant='titleMedium'
				style={[styles.actualTitle, { color: colors.onSecondaryContainer }]}
			>
				{titleText}
			</Text>
			<Text
				variant='bodySmall'
				style={{ color: colors.onSecondaryContainer }}
			>
				{subtitleText}
			</Text>
			{showRecheckButton && (
				<Button
					mode='text'
					compact
					contentStyle={styles.recheckButton}
					onPress={onRecheck}
					textColor={colors.onSecondaryContainer}
				>
					{recheckLabel}
				</Button>
			)}
		</Surface>
	)
}
