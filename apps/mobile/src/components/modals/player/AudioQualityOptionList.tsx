import type { AudioQualityPreference } from '@bbplayer/orpheus'
import { View } from 'react-native'
import {
	RadioButton,
	Text,
	TouchableRipple,
	useTheme,
} from 'react-native-paper'

import type { AudioQualityOption } from '@/constants/audioQuality'

import { styles } from './audioQualityModalStyles'

export interface AudioQualityOptionListProps {
	options: readonly AudioQualityOption[]
	selected: AudioQualityPreference
	onSelect: (preference: AudioQualityPreference) => void
	accessHint: string | null
}

export function AudioQualityOptionList({
	options,
	selected,
	onSelect,
	accessHint,
}: AudioQualityOptionListProps) {
	const colors = useTheme().colors

	return (
		<>
			{accessHint !== null && (
				<Text
					variant='bodySmall'
					style={[styles.accessHint, { color: colors.onSurfaceVariant }]}
				>
					{accessHint}
				</Text>
			)}

			<View
				accessibilityRole='radiogroup'
				style={styles.optionList}
			>
				{options.map((option) => {
					const isSelected = option.value === selected

					return (
						<TouchableRipple
							key={option.value}
							testID={`audio-quality-option-${option.value}`}
							borderless
							accessibilityRole='radio'
							accessibilityState={{
								checked: isSelected,
								selected: isSelected,
							}}
							onPress={() => {
								onSelect(option.value)
							}}
							style={[
								styles.optionRow,
								{
									backgroundColor: isSelected
										? colors.surfaceVariant
										: 'transparent',
								},
							]}
						>
							<View style={styles.optionContent}>
								<View pointerEvents='none'>
									<RadioButton
										value={option.value}
										status={isSelected ? 'checked' : 'unchecked'}
									/>
								</View>
								<View style={styles.optionText}>
									<View style={styles.optionHeader}>
										<Text variant='titleSmall'>{option.label}</Text>
										<Text
											variant='labelSmall'
											style={[styles.optionBadge, { color: colors.primary }]}
										>
											{option.badge}
										</Text>
									</View>
									<Text
										variant='bodySmall'
										style={{ color: colors.onSurfaceVariant }}
									>
										{option.description}
									</Text>
								</View>
							</View>
						</TouchableRipple>
					)
				})}
			</View>
		</>
	)
}
