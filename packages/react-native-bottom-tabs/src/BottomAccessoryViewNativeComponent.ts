import { codegenNativeComponent } from 'react-native'
import type { CodegenTypes, ViewProps } from 'react-native'

type Double = CodegenTypes.Double

export type OnNativeLayout = Readonly<{
	width: Double
	height: Double
}>

export type OnPlacementChanged = Readonly<{
	placement: string
}>

export interface BottomAccessoryViewNativeProps extends ViewProps {
	onNativeLayout?: CodegenTypes.DirectEventHandler<OnNativeLayout>
	onPlacementChanged?: CodegenTypes.DirectEventHandler<OnPlacementChanged>
}

export default codegenNativeComponent<BottomAccessoryViewNativeProps>(
	'BottomAccessoryView',
	{
		excludedPlatforms: ['android'],
	},
)
