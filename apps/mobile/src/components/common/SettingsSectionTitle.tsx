import { StyleSheet, type StyleProp, type TextStyle } from 'react-native'
import { Text, useTheme } from 'react-native-paper'

interface SettingsSectionTitleProps {
	title: string
	/** 作为页面内第一个分区时不预留顶部间距 */
	first?: boolean
	style?: StyleProp<TextStyle>
}

export default function SettingsSectionTitle({
	first,
	style,
	title,
}: SettingsSectionTitleProps) {
	const colors = useTheme().colors

	return (
		<Text
			variant='titleSmall'
			style={[
				styles.title,
				{ color: colors.primary, marginTop: first ? 0 : 28 },
				style,
			]}
		>
			{title}
		</Text>
	)
}

const styles = StyleSheet.create({
	title: {
		marginBottom: 4,
		fontWeight: '600',
	},
})
