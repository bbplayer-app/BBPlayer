import React, { useEffect, useRef, useState } from 'react'
import {
	StyleSheet,
	View,
	TouchableOpacity,
	ScrollView,
	Text,
} from 'react-native'
import RNFS from 'react-native-fs'

const DebugLogs = () => {
	const [files, setFiles] = useState([])
	const [file, setFile] = useState(null)
	const [logs, setLogs] = useState(null)

	const fileViewRef = useRef(null)

	useEffect(() => {
		RNFS.readdir(RNFS.DocumentDirectoryPath + '/logs').then((result) => {
			if (result) {
				setFiles(result)
			}
		})
	}, [])

	useEffect(() => {
		if (file) {
			RNFS.readFile(RNFS.DocumentDirectoryPath + '/logs/' + file, 'utf8').then(
				(result) => {
					setLogs(result)
				},
			)
		}
	}, [file])

	return (
		<View style={styles.container}>
			<View style={{ flex: 1, paddingHorizontal: 5, width: '100%' }}>
				<ScrollView
					style={{
						height: '20%',
						borderRadius: 10,
						borderBottomWidth: 2,
					}}
					contentContainerStyle={{ padding: 10 }}
					ref={fileViewRef}
					onContentSizeChange={() =>
						fileViewRef.current &&
						fileViewRef.current.scrollToEnd({ animated: true })
					}
				>
					{files.map((item: string, index: number) => {
						return (
							<TouchableOpacity
								key={index}
								onPress={() => {
									setFile(item)
								}}
							>
								<Text>- {item}</Text>
							</TouchableOpacity>
						)
					})}
				</ScrollView>
				<ScrollView
					style={{
						height: '65%',
						marginTop: '2%',
						marginBottom: 10,
						borderRadius: 10,
					}}
					contentContainerStyle={{ padding: 10 }}
					ref={fileViewRef}
					onContentSizeChange={() =>
						fileViewRef.current &&
						fileViewRef.current.scrollToEnd({ animated: true })
					}
				>
					{logs ? <Text>{logs}</Text> : <Text>SELECT LOG FILE...</Text>}
				</ScrollView>
			</View>
		</View>
	)
}

const styles = StyleSheet.create({
	container: {
		flex: 1,
		paddingTop: 10,
		justifyContent: 'center',
		alignItems: 'center',
	},
	title: {
		marginTop: 10,
		marginBottom: 10,
		maxWidth: '50%',
	},
})

export { DebugLogs }
