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
	/** 附在某个档位描述后面的提示，disabled 为 true 时该档位不可选 */
	notices?: Partial<
		Record<AudioQualityPreference, { disabled: boolean; text: string }>
	>
}

export function AudioQualityOptionList({
	options,
	selected,
	onSelect,
	accessHint,
	notices,
}: AudioQualityOptionListProps) {
	const colors = useTheme().colors

	return (
		<>
			<Text
				variant='labelLarge'
				style={styles.optionSectionTitle}
			>
				默认音质
			</Text>
			<Text
				variant='bodySmall'
				style={[styles.accessHint, { color: colors.onSurfaceVariant }]}
			>
				所有歌曲都按这里播放，选好后正在播放的这首也会马上切换。没有所选音质的歌会自动用能用的最高档。
			</Text>
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
					const notice = notices?.[option.value]
					const disabled = notice?.disabled === true

					return (
						<TouchableRipple
							key={option.value}
							testID={`audio-quality-option-${option.value}`}
							borderless
							accessibilityRole='radio'
							accessibilityState={{
								checked: isSelected,
								selected: isSelected,
								disabled,
							}}
							disabled={disabled}
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
								disabled && styles.optionDisabled,
							]}
						>
							<View style={styles.optionContent}>
								<View pointerEvents='none'>
									<RadioButton
										value={option.value}
										status={isSelected ? 'checked' : 'unchecked'}
										disabled={disabled}
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
									{notice && (
										<Text
											variant='bodySmall'
											style={{
												color: disabled ? colors.error : colors.primary,
											}}
										>
											{notice.text}
										</Text>
									)}
								</View>
							</View>
						</TouchableRipple>
					)
				})}
			</View>
		</>
	)
}
