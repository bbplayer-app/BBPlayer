import * as DocumentPicker from 'expo-document-picker'

/** 让用户选择一张图片，返回临时文件地址；取消时返回 null。 */
export async function pickImage(): Promise<string | null> {
	const result = await DocumentPicker.getDocumentAsync({
		type: 'image/*',
		copyToCacheDirectory: true,
		multiple: false,
	})

	if (result.canceled || result.assets.length === 0) return null

	return result.assets[0].uri
}
