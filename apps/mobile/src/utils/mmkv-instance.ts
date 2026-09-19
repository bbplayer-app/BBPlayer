import { createMMKV } from 'react-native-mmkv'

import type { TypedMMKVInterface } from '@/types/storage'

export const mmkv = createMMKV()
export const storage = mmkv as unknown as TypedMMKVInterface
