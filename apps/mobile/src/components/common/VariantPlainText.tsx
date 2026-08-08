import { MD3TypescaleKey, useTheme } from 'react-native-paper'
import type { PlainTextProps } from 'react-native-plain-text'
import { PlainText } from 'react-native-plain-text'

type Props = Omit<PlainTextProps, 'children'> & {
	variant?: keyof typeof MD3TypescaleKey
	children: string
}

/**
 * react-native-paper 的 `<Text variant>` 语义 + PlainText 渲染。
 * PlainText 不认 paper 的 `variant` 也不提供默认色，这里补齐
 * `theme.fonts[variant]` 与 `onSurface` 默认色，保持替换后观感一致。
 */
export function VariantPlainText({ variant, style, ...props }: Props) {
	const theme = useTheme()
	return (
		<PlainText
			style={[
				{ color: theme.colors.onSurface },
				variant ? theme.fonts[variant] : null,
				style,
			]}
			{...props}
		/>
	)
}
