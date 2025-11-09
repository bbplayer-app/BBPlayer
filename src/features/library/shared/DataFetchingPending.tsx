import { StyleSheet, View } from 'react-native'
import { ActivityIndicator, useTheme } from 'react-native-paper'

export function DataFetchingPending() {
	const { colors } = useTheme()
	return (
		<View style={[styles.container, { backgroundColor: colors.background }]}>
			<ActivityIndicator size='large' />
		</View>
	)
}

const styles = StyleSheet.create({
	container: {
		flex: 1,
		alignItems: 'center',
		justifyContent: 'center',
	},
})
