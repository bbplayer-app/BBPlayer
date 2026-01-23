import { StyleSheet } from 'react-native'
import type { BaseToastProps } from 'react-native-toast-message'
import { BaseToast } from 'react-native-toast-message'

const baseToastStyle = {
	style: { minHeight: 60 },
	text1Style: {
		fontSize: 15,
		fontWeight: 'normal' as const,
	},
	text2Style: {
		fontSize: 10,
	},
	text1NumberOfLines: 0,
	text2NumberOfLines: 0,
}

export const toastConfig = {
	success: (props: BaseToastProps) => (
		<BaseToast
			{...props}
			{...baseToastStyle}
			style={[baseToastStyle.style, styles.success]}
		/>
	),
	error: (props: BaseToastProps) => (
		<BaseToast
			{...props}
			{...baseToastStyle}
			style={[baseToastStyle.style, styles.error]}
		/>
	),
	info: (props: BaseToastProps) => (
		<BaseToast
			{...props}
			{...baseToastStyle}
			style={[baseToastStyle.style, styles.info]}
		/>
	),
}

const styles = StyleSheet.create({
	success: {
		borderLeftColor: 'green',
	},
	error: {
		borderLeftColor: 'red',
	},
	info: {
		borderLeftColor: '#87CEFA',
	},
})
