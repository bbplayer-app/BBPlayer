import { createNavigationContainerRef } from '@react-navigation/native'

import type { RootStackParamList } from '@/types/navigation'

const navigationRef = createNavigationContainerRef<RootStackParamList>()

export default navigationRef
