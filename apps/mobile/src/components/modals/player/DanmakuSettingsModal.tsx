import Slider from '@react-native-community/slider'
import { useState } from 'react'
import { StyleSheet, View } from 'react-native'
import { Dialog, Switch, Text } from 'react-native-paper'

import Button from '@/components/common/Button'
import { useAppStore } from '@/hooks/stores/useAppStore'
import { useModalStore } from '@/hooks/stores/useModalStore'

const DanmakuSettingsModal = () => {
	const close = useModalStore((state) => state.close)
	const enableDanmaku = useAppStore((state) => state.settings.enableDanmaku)
	const setSettings = useAppStore((state) => state.setSettings)
	const danmakuFilterLevel = useAppStore(
		(state) => state.settings.danmakuFilterLevel,
	)

	const [tempFilterLevel, setTempFilterLevel] = useState(danmakuFilterLevel)

	return (
		<>
			<Dialog.Title>弹幕设置</Dialog.Title>
			<Dialog.Content>
				<View style={styles.row}>
					<Text variant='bodyLarge'>启用弹幕</Text>
					<Switch
						value={enableDanmaku}
						onValueChange={(value) => setSettings({ enableDanmaku: value })}
					/>
				</View>

				<View style={styles.divider} />

				<Text variant='bodyLarge'>屏蔽等级: {tempFilterLevel}</Text>
				<Text
					variant='bodySmall'
					style={styles.description}
				>
					等级越高，屏蔽的弹幕越多（与 B 站的根据弹幕质量过滤相同）
				</Text>
				<Slider
					style={styles.slider}
					minimumValue={0}
					maximumValue={10}
					step={1}
					value={tempFilterLevel}
					onValueChange={setTempFilterLevel}
					onSlidingComplete={(value) =>
						setSettings({ danmakuFilterLevel: value })
					}
					minimumTrackTintColor='#6200ee'
					maximumTrackTintColor='#000000'
				/>
			</Dialog.Content>
			<Dialog.Actions>
				<Button onPress={() => close('DanmakuSettings')}>确定</Button>
			</Dialog.Actions>
		</>
	)
}

const styles = StyleSheet.create({
	row: {
		flexDirection: 'row',
		justifyContent: 'space-between',
		alignItems: 'center',
		marginBottom: 16,
	},
	divider: {
		height: 1,
		backgroundColor: '#e0e0e0',
		marginBottom: 16,
	},
	description: {
		color: '#666',
		marginBottom: 8,
	},
	slider: {
		width: '100%',
		height: 40,
	},
})

export default DanmakuSettingsModal
