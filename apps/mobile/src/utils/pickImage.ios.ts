import * as ImagePicker from 'expo-image-picker'

/** iOS 上用系统相册选择图片：文档选择器只能打开“文件”。 */
export async function pickImage(): Promise<string | null> {
	const result = await ImagePicker.launchImageLibraryAsync({
		mediaTypes: ['images'],
	})
	if (result.canceled || result.assets.length === 0) return null
	return result.assets[0].uri
}
