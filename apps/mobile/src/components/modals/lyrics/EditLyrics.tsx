import { verify } from '@bbplayer/splash'
import {
	Host,
	OutlinedTextField,
	Text as ComposeText,
} from '@expo/ui/jetpack-compose'
import { fillMaxSize } from '@expo/ui/jetpack-compose/modifiers'
import * as WebBrowser from 'expo-web-browser'
import { useState } from 'react'
import { StyleSheet, Text, View, useWindowDimensions } from 'react-native'
import { Dialog, useTheme } from 'react-native-paper'
import { TabBar, TabView } from 'react-native-tab-view'

import Button from '@/components/common/Button'
import { alert } from '@/components/modals/AlertModal'
import { lyricsQueryKeys } from '@/hooks/queries/lyrics'
import { useModalStore } from '@/hooks/stores/useModalStore'
import useTextFieldState from '@/hooks/useTextFieldState'
import { queryClient } from '@/lib/config/queryClient'
import lyricService from '@/lib/services/lyricService'
import type { LyricFileData } from '@/types/player/lyrics'
import { toastAndLogError } from '@/utils/error-handling'
import toast from '@/utils/toast'

export default function EditLyricsModal({
	uniqueKey,
	lyrics,
}: {
	uniqueKey: string
	lyrics: LyricFileData
}) {
	const close = useModalStore((state) => state.close)
	const theme = useTheme()
	const layout = useWindowDimensions()

	const [lrc, setLrc] = useState(lyrics.lrc ?? '')
	const [tlyric, setTlyric] = useState(lyrics.tlyric ?? '')
	const [romalrc, setRomalrc] = useState(lyrics.romalrc ?? '')
	const lrcState = useTextFieldState(lrc)
	const tlyricState = useTextFieldState(tlyric)
	const romalrcState = useTextFieldState(romalrc)

	const [index, setIndex] = useState(0)
	const [routes] = useState([
		{ key: 'lrc', title: '主歌词' },
		{ key: 'tlyric', title: '翻译' },
		{ key: 'romalrc', title: '罗马音' },
	])

	const renderScene = ({ route }: { route: { key: string } }) => {
		switch (route.key) {
			case 'lrc':
				return (
					<View style={styles.inputContainer}>
						<Host style={styles.textFieldHost}>
							<OutlinedTextField
								value={lrcState}
								onValueChange={setLrc}
								minLines={12}
								maxLines={12}
								modifiers={[fillMaxSize()]}
							>
								<OutlinedTextField.Placeholder>
									<ComposeText>在此输入 LRC 格式歌词</ComposeText>
								</OutlinedTextField.Placeholder>
							</OutlinedTextField>
						</Host>
					</View>
				)
			case 'tlyric':
				return (
					<View style={styles.inputContainer}>
						<Host style={styles.textFieldHost}>
							<OutlinedTextField
								value={tlyricState}
								onValueChange={setTlyric}
								minLines={12}
								maxLines={12}
								modifiers={[fillMaxSize()]}
							>
								<OutlinedTextField.Placeholder>
									<ComposeText>在此输入翻译歌词</ComposeText>
								</OutlinedTextField.Placeholder>
							</OutlinedTextField>
						</Host>
					</View>
				)
			case 'romalrc':
				return (
					<View style={styles.inputContainer}>
						<Host style={styles.textFieldHost}>
							<OutlinedTextField
								value={romalrcState}
								onValueChange={setRomalrc}
								minLines={12}
								maxLines={12}
								modifiers={[fillMaxSize()]}
							>
								<OutlinedTextField.Placeholder>
									<ComposeText>在此输入罗马音歌词</ComposeText>
								</OutlinedTextField.Placeholder>
							</OutlinedTextField>
						</Host>
					</View>
				)
			default:
				return null
		}
	}

	const saveLyrics = async () => {
		const newLyricData: LyricFileData = {
			...lyrics,
			lrc,
			tlyric: tlyric || undefined,
			romalrc: romalrc || undefined,
			updateTime: Date.now(),
		}

		const result = await lyricService.saveLyricsToFile(newLyricData, uniqueKey)

		if (result.isErr()) {
			toastAndLogError(
				'保存歌词失败',
				result.error,
				'Components.EditLyricsModal',
			)
			return
		}

		queryClient.setQueryData(
			lyricsQueryKeys.smartFetchLyrics(uniqueKey),
			result.value,
		)
		toast.success('歌词保存成功')
		close('EditLyrics')
	}

	const handleConfirm = async () => {
		const result = verify(lrc)
		if (result.isValid) {
			await saveLyrics()
		} else {
			alert(
				'歌词格式错误',
				`第 ${result.error.line} 行存在错误: ${result.error.message}`,
				[
					{
						text: '取消',
						onPress: () => {
							// do nothing
						},
					},
					{
						text: '仍要保存',
						onPress: saveLyrics,
					},
				],
			)
		}
	}

	// oxlint-disable-next-line @typescript-eslint/no-explicit-any
	const renderTabBar = (props: any) => (
		<TabBar
			{...props}
			indicatorStyle={{ backgroundColor: theme.colors.onSecondaryContainer }}
			style={[styles.tabBar, { backgroundColor: theme.colors.surface }]}
			labelStyle={{ fontWeight: 'bold' }}
			activeColor={theme.colors.onSecondaryContainer}
			inactiveColor={theme.colors.onSurface}
		/>
	)

	return (
		<>
			<Dialog.Title>编辑歌词</Dialog.Title>
			<Dialog.Content style={styles.content}>
				<View style={styles.header}>
					<Text style={{ color: theme.colors.onSurfaceVariant }}>
						我们的歌词遵循 SPL(LRC) 规范，
					</Text>
					<Text
						style={{
							color: theme.colors.primary,
							textDecorationLine: 'underline',
						}}
						onPress={() =>
							WebBrowser.openBrowserAsync(
								'https://moriafly.com/standards/spl.html',
							)
						}
					>
						点击查看规范详情
					</Text>
				</View>
				<TabView
					navigationState={{ index, routes }}
					renderScene={renderScene}
					onIndexChange={setIndex}
					initialLayout={{ width: layout.width }}
					renderTabBar={renderTabBar}
					style={styles.tabView}
				/>
			</Dialog.Content>
			<Dialog.Actions>
				<Button onPress={() => close('EditLyrics')}>取消</Button>
				<Button onPress={handleConfirm}>确定</Button>
			</Dialog.Actions>
		</>
	)
}

const styles = StyleSheet.create({
	content: {
		paddingHorizontal: 0,
		paddingBottom: 0,
		height: 350,
	},
	header: {
		paddingHorizontal: 24,
		paddingBottom: 12,
		flexDirection: 'row',
		flexWrap: 'wrap',
	},
	tabView: {
		flex: 1,
	},
	tabBar: {
		overflow: 'hidden',
		justifyContent: 'center',
		maxHeight: 70,
		marginBottom: 0,
		marginTop: 10,
		elevation: 0,
	},
	inputContainer: {
		flex: 1,
		paddingHorizontal: 16,
		paddingTop: 10,
	},
	textFieldHost: {
		flex: 1,
		width: '100%',
	},
})
