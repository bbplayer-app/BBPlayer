import type { FC } from 'react'
import { TouchableOpacity, Text, StyleSheet } from 'react-native'

interface ControlButtonProps {
	label: string
	onPress: () => void
}

export const ControlButton: FC<ControlButtonProps> = ({ label, onPress }) => (
	<TouchableOpacity
		style={styles.controlBtn}
		onPress={onPress}
	>
		<Text style={styles.controlBtnText}>{label}</Text>
	</TouchableOpacity>
)

interface ButtonProps {
	title: string
	onPress: () => void
	primary?: boolean
	danger?: boolean
	small?: boolean
	active?: boolean
}

export const Button: FC<ButtonProps> = ({
	title,
	onPress,
	primary,
	danger,
	small,
	active,
}) => (
	<TouchableOpacity
		style={[
			styles.btn,
			primary && styles.btnPrimary,
			danger && styles.btnDanger,
			active && styles.btnActive,
			small && styles.btnSmall,
		]}
		onPress={onPress}
	>
		<Text
			style={[
				styles.btnText,
				small && { fontSize: 12 },
				// oxlint-disable-next-line @typescript-eslint/prefer-nullish-coalescing
				(primary || danger || active) && { color: '#fff' },
			]}
		>
			{title}
		</Text>
	</TouchableOpacity>
)

const styles = StyleSheet.create({
	controlBtn: { padding: 10 },
	controlBtnText: { fontSize: 32, color: '#fff' },
	btn: {
		backgroundColor: '#333',
		paddingVertical: 12,
		paddingHorizontal: 16,
		borderRadius: 8,
		minWidth: 80,
		alignItems: 'center',
		marginBottom: 0,
	},
	btnSmall: { paddingVertical: 8, paddingHorizontal: 12, minWidth: 60 },
	btnPrimary: { backgroundColor: '#1DB954' },
	btnDanger: { backgroundColor: '#E53935' },
	btnActive: { backgroundColor: '#1DB954' },
	btnText: { color: '#ddd', fontWeight: '600' },
})
