import { useEffect, useState } from 'react'
import { ScrollView, StyleSheet, View } from 'react-native'
import { Dialog, Switch, Text, TextInput } from 'react-native-paper'

import Button from '@/components/common/Button'
import useAppStore from '@/hooks/stores/useAppStore'
import { useModalStore } from '@/hooks/stores/useModalStore'
import { llmCredentialService } from '@/lib/services/llmCredentialService'
import { toastAndLogError } from '@/utils/error-handling'
import toast from '@/utils/toast'

export default function LlmSmartShuffleSettingsModal() {
	const settings = useAppStore((state) => state.settings)
	const setSettings = useAppStore((state) => state.setSettings)
	const close = useModalStore((state) => state.close)

	const [enableLlmTagging, setEnableLlmTagging] = useState(
		settings.enableLlmTagging,
	)
	const [allowLlmMetadataUpload, setAllowLlmMetadataUpload] = useState(
		settings.allowLlmMetadataUpload,
	)
	const [llmBaseUrl, setLlmBaseUrl] = useState(settings.llmBaseUrl)
	const [llmApiKey, setLlmApiKey] = useState('')
	const [llmModel, setLlmModel] = useState(settings.llmModel)
	const [llmDefaultPreference, setLlmDefaultPreference] = useState(
		settings.llmDefaultPreference,
	)
	const [isLoadingApiKey, setIsLoadingApiKey] = useState(true)

	useEffect(() => {
		let isMounted = true
		llmCredentialService
			.migrateFromPlainSettings()
			.then(() => llmCredentialService.getApiKey())
			.then((apiKey) => {
				if (!isMounted) return
				setLlmApiKey(apiKey)
			})
			.catch((error) => {
				toastAndLogError(
					'读取 LLM API Key 失败',
					error,
					'LlmSmartShuffleSettings',
				)
			})
			.finally(() => {
				if (!isMounted) return
				setIsLoadingApiKey(false)
			})

		return () => {
			isMounted = false
		}
	}, [])

	const handleSave = async () => {
		try {
			await llmCredentialService.setApiKey(llmApiKey)
		} catch (error) {
			toastAndLogError(
				'保存 LLM API Key 失败',
				error,
				'LlmSmartShuffleSettings',
			)
			return
		}
		setSettings({
			enableLlmTagging,
			allowLlmMetadataUpload,
			llmBaseUrl: llmBaseUrl.trim() || 'https://api.openai.com/v1',
			llmModel: llmModel.trim() || 'gpt-4o-mini',
			llmDefaultPreference: llmDefaultPreference.trim(),
		})
		toast.success('智能随机播放设置已保存')
		close('LlmSmartShuffleSettings')
	}

	return (
		<>
			<Dialog.Title>智能随机播放</Dialog.Title>
			<Dialog.Content>
				<ScrollView style={styles.content}>
					<View style={styles.row}>
						<View style={styles.rowText}>
							<Text>启用 LLM 标签索引</Text>
							<Text
								variant='bodySmall'
								style={styles.description}
							>
								同步收藏夹后读取标题和基础元数据，生成本地标签索引，并用于 LLM
								排序。
							</Text>
						</View>
						<Switch
							value={enableLlmTagging}
							onValueChange={setEnableLlmTagging}
						/>
					</View>

					<View style={styles.row}>
						<View style={styles.rowText}>
							<Text>允许上传标题和基础元数据</Text>
							<Text
								variant='bodySmall'
								style={styles.description}
							>
								不会上传音频文件、Cookie 或完整播放历史。
							</Text>
						</View>
						<Switch
							value={allowLlmMetadataUpload}
							onValueChange={setAllowLlmMetadataUpload}
						/>
					</View>

					<TextInput
						label='OpenAI 兼容 API 地址'
						value={llmBaseUrl}
						onChangeText={setLlmBaseUrl}
						mode='outlined'
						style={styles.input}
						placeholder='https://api.openai.com/v1'
						autoCapitalize='none'
						autoCorrect={false}
					/>
					<TextInput
						label='API Key'
						value={llmApiKey}
						onChangeText={setLlmApiKey}
						mode='outlined'
						style={styles.input}
						secureTextEntry
						disabled={isLoadingApiKey}
						autoCapitalize='none'
						autoCorrect={false}
					/>
					<TextInput
						label='模型名称'
						value={llmModel}
						onChangeText={setLlmModel}
						mode='outlined'
						style={styles.input}
						placeholder='gpt-4o-mini'
						autoCapitalize='none'
						autoCorrect={false}
					/>
					<TextInput
						label='默认听歌取向'
						value={llmDefaultPreference}
						onChangeText={setLlmDefaultPreference}
						mode='outlined'
						style={styles.preferenceInput}
						multiline
						numberOfLines={4}
						textAlignVertical='top'
						placeholder='例如：多听点中V和最近收藏，少听太吵的歌'
					/>
				</ScrollView>
			</Dialog.Content>
			<Dialog.Actions>
				<Button onPress={() => close('LlmSmartShuffleSettings')}>取消</Button>
				<Button
					onPress={handleSave}
					disabled={isLoadingApiKey}
				>
					保存
				</Button>
			</Dialog.Actions>
		</>
	)
}

const styles = StyleSheet.create({
	content: {
		maxHeight: 520,
	},
	row: {
		flexDirection: 'row',
		alignItems: 'center',
		justifyContent: 'space-between',
		marginBottom: 16,
	},
	rowText: {
		flex: 1,
		marginRight: 16,
	},
	description: {
		marginTop: 4,
		opacity: 0.7,
	},
	input: {
		marginBottom: 12,
	},
	preferenceInput: {
		marginBottom: 4,
		maxHeight: 140,
	},
})
