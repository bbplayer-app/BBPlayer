import { codegenNativeComponent } from 'react-native'
import type { CodegenTypes, ViewProps } from 'react-native'

type DirectEventHandler<T> = CodegenTypes.DirectEventHandler<T>
type Double = CodegenTypes.Double

export type OnNativeLayout = Readonly<{
	width: Double
	height: Double
}>

export type OnPlacementChanged = Readonly<{
	placement: string
}>

export interface BottomAccessoryViewNativeProps extends ViewProps {
	onNativeLayout?: DirectEventHandler<OnNativeLayout>
	onPlacementChanged?: DirectEventHandler<OnPlacementChanged>
}

export default codegenNativeComponent<BottomAccessoryViewNativeProps>(
	'BottomAccessoryView',
	{
		excludedPlatforms: ['android'],
	},
)
