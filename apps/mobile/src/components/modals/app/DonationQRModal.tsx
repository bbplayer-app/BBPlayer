import { Asset } from 'expo-asset'
import { Image } from 'expo-image'
import * as MediaLibrary from 'expo-media-library'
import { Pressable, StyleSheet, View } from 'react-native'
import SquircleView from 'react-native-fast-squircle'
import { Dialog, Text } from 'react-native-paper'

import Button from '@/components/common/Button'
/* eslint-disable @typescript-eslint/no-unsafe-argument */
import { useModalStore } from '@/hooks/stores/useModalStore'
import toast from '@/utils/toast'

// eslint-disable-next-line @typescript-eslint/no-require-imports, @typescript-eslint/no-unsafe-assignment
const WECHAT_QR = require('../../../../assets/images/wechat.png')

export default function DonationQRModal({ type: _type }: { type: 'wechat' }) {
	const close = useModalStore((state) => state.close)
	const [permissionResponse, requestPermission] = MediaLibrary.usePermissions()

	const handleLongPress = async () => {
		try {
			if (
				permissionResponse?.status !== MediaLibrary.PermissionStatus.GRANTED &&
				permissionResponse?.accessPrivileges !== 'all'
			) {
				const { status } = await requestPermission()
				if (status !== MediaLibrary.PermissionStatus.GRANTED) {
					toast.error('无法保存图片', {
						description: '请在设置中允许访问相册',
					})
					return
				}
			}

			const asset = Asset.fromModule(WECHAT_QR)
			if (!asset.downloaded) {
				await asset.downloadAsync()
			}

			const uri = asset.localUri ?? asset.uri

			if (uri) {
				await MediaLibrary.saveToLibraryAsync(uri)
				toast.success('已保存到相册')
			} else {
				throw new Error('无法获取图片路径')
			}
		} catch (e) {
			toast.error('保存失败', { description: String(e) })
		}
	}

	return (
		<>
			<Dialog.Title style={{ textAlign: 'center' }}>微信支付</Dialog.Title>
			<Dialog.Content>
				<View style={styles.imageContainer}>
					<Pressable
						onLongPress={handleLongPress}
						delayLongPress={500}
					>
						<SquircleView
							style={styles.image}
							cornerSmoothing={0.6}
						>
							<Image
								// eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
								source={WECHAT_QR}
								style={styles.imageInner}
								contentFit='contain'
							/>
						</SquircleView>
					</Pressable>
					<Text
						variant='bodySmall'
						style={styles.hint}
					>
						长按保存收款码
					</Text>
				</View>
			</Dialog.Content>
			<Dialog.Actions>
				<Button onPress={() => close('DonationQR')}>关闭</Button>
			</Dialog.Actions>
		</>
	)
}

const styles = StyleSheet.create({
	imageContainer: {
		alignItems: 'center',
		justifyContent: 'center',
	},
	image: {
		width: 200,
		height: 200,
		backgroundColor: '#f0f0f0',
		marginBottom: 10,
		borderRadius: 44,
		overflow: 'hidden',
	},
	imageInner: {
		width: 200,
		height: 200,
	},
	hint: {
		textAlign: 'center',
		opacity: 0.6,
	},
})
