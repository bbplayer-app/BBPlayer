import ExpoImageThemeColors from '@roitium/expo-image-theme-colors'
import { useImage } from 'expo-image'
import {
	Button,
	SafeAreaView,
	ScrollView,
	Text,
	View,
	Alert,
	StyleSheet,
} from 'react-native'

export default function App() {
	const imageUrl =
		'https://i2.hdslb.com/bfs/archive/aa7b946340dc5834309b4f529a5d3b52c69cfac8.jpg'
	const imageRef = useImage(imageUrl, {
		maxWidth: 200,
		maxHeight: 200,
	})

	const handlePress = async () => {
		if (!imageRef) {
			Alert.alert('Error', 'Image not loaded yet')
			return
		}

		try {
			console.log('Extracting colors...')
			const result = await ExpoImageThemeColors.extractThemeColorAsync(imageRef)
			console.log('Extraction Result:', JSON.stringify(result, null, 2))
			Alert.alert('Result', JSON.stringify(result, null, 2))
		} catch (e) {
			console.error(e)
			if (e instanceof Error) {
				Alert.alert('Error', e.message ?? 'Unknown error')
			}
		}
	}

	return (
		<SafeAreaView style={styles.container}>
			<ScrollView contentContainerStyle={styles.scrollContainer}>
				<Text style={styles.header}>Expo Image Theme Colors</Text>

				<View style={styles.card}>
					<Text style={styles.label}>Target Image:</Text>
					<Text style={styles.value}>{imageUrl}</Text>
				</View>

				<Button
					title='Extract Colors'
					onPress={handlePress}
				/>
			</ScrollView>
		</SafeAreaView>
	)
}

const styles = StyleSheet.create({
	container: {
		flex: 1,
		backgroundColor: '#fff',
	},
	scrollContainer: {
		padding: 20,
		alignItems: 'center',
	},
	header: {
		fontSize: 20,
		fontWeight: 'bold',
		marginBottom: 20,
		marginTop: 10,
	},
	card: {
		padding: 15,
		borderRadius: 10,
		backgroundColor: '#f0f0f0',
		width: '100%',
		marginBottom: 20,
	},
	label: {
		fontWeight: 'bold',
		marginBottom: 5,
	},
	value: {
		fontSize: 12,
		color: '#333',
	},
})
