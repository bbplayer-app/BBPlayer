import { SegmentedControl } from '@expo/ui/community/segmented-control'
import {
	Column,
	Host,
	OutlinedTextField,
	Text as ComposeText,
} from '@expo/ui/jetpack-compose'
import { fillMaxWidth } from '@expo/ui/jetpack-compose/modifiers'
import { Image } from 'expo-image'
import { useLocalSearchParams, useRouter } from 'expo-router'
import { useEffect, useState } from 'react'
import { ScrollView, StyleSheet, View } from 'react-native'
import { Appbar, Avatar, Text, useTheme } from 'react-native-paper'
import { useSafeAreaInsets } from 'react-native-safe-area-context'

import Button from '@/components/common/Button'
import NowPlayingBar from '@/components/NowPlayingBar'
import useCurrentTrack from '@/hooks/player/useCurrentTrack'
import { playlistKeys } from '@/hooks/queries/db/playlist'
import useAppStore from '@/hooks/stores/useAppStore'
import useTextFieldState from '@/hooks/useTextFieldState'
import { api } from '@/lib/api/bbplayer/client'
import { bilibiliApi } from '@/lib/api/bilibili/api'
import { queryClient } from '@/lib/config/queryClient'
import { sharedPlaylistFacade } from '@/lib/facades/sharedPlaylist'
import { playlistSyncWorker } from '@/lib/workers/PlaylistSyncWorker'
import { toastAndLogError } from '@/utils/error-handling'
import { returnOrThrowAsync } from '@/utils/neverthrow-utils'
import toast from '@/utils/toast'

type Mode = 'login' | 'register'

export default function AccountSettingsPage() {
	const router = useRouter()
	const { returnTo } = useLocalSearchParams<{ returnTo?: string }>()
	const colors = useTheme().colors
	const insets = useSafeAreaInsets()
	const haveTrack = useCurrentTrack()
	const account = useAppStore((state) => state.bbplayerAccount)
	const token = useAppStore((state) => state.bbplayerToken)
	const setToken = useAppStore((state) => state.setBbplayerToken)
	const setAccount = useAppStore((state) => state.setBBPlayerAccount)
	const clearAccount = useAppStore((state) => state.clearBBPlayerAccount)
	const hasBilibiliCookie = useAppStore((state) => state.hasBilibiliCookie())

	const [mode, setMode] = useState<Mode>('login')
	const [username, setUsername] = useState('')
	const [password, setPassword] = useState('')
	const [name, setName] = useState('')
	const [face, setFace] = useState('')
	const usernameState = useTextFieldState(username)
	const passwordState = useTextFieldState(password)
	const nameState = useTextFieldState(name)
	const faceState = useTextFieldState(face)
	const [isSubmitting, setIsSubmitting] = useState(false)
	const [isRefreshing, setIsRefreshing] = useState(false)
	const [isSavingProfile, setIsSavingProfile] = useState(false)
	const [isFillingProfile, setIsFillingProfile] = useState(false)
	const [authStatusText, setAuthStatusText] = useState<string | null>(null)

	const finishAuth = async () => {
		setAuthStatusText('正在同步云端共享歌单...')
		const restoreResult = await sharedPlaylistFacade.restoreFromCloud()
		if (restoreResult.isOk() && restoreResult.value.restored > 0) {
			await queryClient.invalidateQueries({
				queryKey: playlistKeys.playlistLists(),
			})
			setAuthStatusText(`已恢复 ${restoreResult.value.restored} 个共享歌单`)
			toast.success(`已恢复 ${restoreResult.value.restored} 个共享歌单`)
		} else if (restoreResult.isOk()) {
			setAuthStatusText('云端共享歌单已同步')
		} else {
			setAuthStatusText('云端共享歌单同步失败，可稍后重新登录重试')
			toast.error('同步云端共享歌单失败', {
				description: restoreResult.error.message,
			})
		}
		playlistSyncWorker.triggerSync()
		if (returnTo) {
			router.replace(returnTo as never)
		}
	}

	useEffect(() => {
		if (account) {
			setName(account.name)
			setFace(account.face ?? '')
		}
	}, [account])

	useEffect(() => {
		if (!token || account) return
		let cancelled = false
		setIsRefreshing(true)
		api.auth.me
			.$get()
			.then(async (resp) => {
				if (!resp.ok) return
				const data = await resp.json()
				if (!cancelled) setAccount(data.account)
			})
			.catch((e) => {
				toastAndLogError('获取 BBPlayer 账号信息失败', e, 'Settings.Account')
			})
			.finally(() => {
				if (!cancelled) setIsRefreshing(false)
			})
		return () => {
			cancelled = true
		}
	}, [account, setAccount, token])

	const fillProfileFromBilibili = async () => {
		if (!hasBilibiliCookie) {
			toast.error('请先登录 Bilibili 账号')
			return
		}
		setIsFillingProfile(true)
		setAuthStatusText('正在读取 Bilibili 资料...')
		try {
			const info = await returnOrThrowAsync(bilibiliApi.getUserInfo())
			if (info.name) setName(info.name)
			if (info.face) {
				setFace(info.face)
				void Image.prefetch(info.face, 'disk')
			}
			setAuthStatusText('已填充 Bilibili 昵称和头像')
			toast.success('已填充 Bilibili 资料')
		} catch (e) {
			setAuthStatusText(null)
			toast.error('读取 Bilibili 资料失败', {
				description: e instanceof Error ? e.message : String(e),
			})
		} finally {
			setIsFillingProfile(false)
		}
	}

	const handleRegister = async () => {
		const normalizedUsername = username.trim()
		if (!normalizedUsername || password.length < 8) {
			toast.error('用户名不能为空，密码至少 8 位')
			return
		}
		setIsSubmitting(true)
		setAuthStatusText('正在创建 BBPlayer 账号...')
		try {
			setAuthStatusText('正在注册 BBPlayer 账号...')
			const resp = await api.auth.register.$post({
				json: {
					username: normalizedUsername,
					password,
					name: name.trim() || normalizedUsername,
					face: face.trim() || undefined,
				},
			})
			if (!resp.ok) {
				throw new Error(
					`注册失败：${resp.status} ${JSON.stringify(await resp.json().catch(() => ({})))}`,
				)
			}
			const data = await resp.json()
			setToken(data.token)
			setAccount(data.account)
			setPassword('')
			toast.success('注册成功')
			await finishAuth()
		} catch (e) {
			setAuthStatusText(null)
			toastAndLogError('注册失败', e, 'Settings.Account')
		} finally {
			setIsSubmitting(false)
		}
	}

	const handleLogin = async () => {
		const normalizedUsername = username.trim()
		if (!normalizedUsername || password.length < 8) {
			toast.error('用户名不能为空，密码至少 8 位')
			return
		}
		setIsSubmitting(true)
		setAuthStatusText('正在登录 BBPlayer 账号...')
		try {
			const resp = await api.auth.login.$post({
				json: {
					username: normalizedUsername,
					password,
				},
			})
			if (!resp.ok) {
				throw new Error(
					`登录失败：${resp.status} ${JSON.stringify(await resp.json().catch(() => ({})))}`,
				)
			}
			const data = await resp.json()
			setToken(data.token)
			setAccount(data.account)
			setPassword('')
			toast.success('登录成功')
			await finishAuth()
		} catch (e) {
			setAuthStatusText(null)
			toastAndLogError('登录失败', e, 'Settings.Account')
		} finally {
			setIsSubmitting(false)
		}
	}

	const handleSaveProfile = async () => {
		setIsSavingProfile(true)
		try {
			const resp = await api.auth.profile.$patch({
				json: {
					name: name.trim(),
					face: face.trim() || undefined,
				},
			})
			if (!resp.ok) {
				throw new Error(`保存失败：${resp.status}`)
			}
			const data = await resp.json()
			setAccount(data.account)
			toast.success('已保存')
		} catch (e) {
			toastAndLogError('保存资料失败', e, 'Settings.Account')
		} finally {
			setIsSavingProfile(false)
		}
	}

	return (
		<View style={[styles.container, { backgroundColor: colors.background }]}>
			<Appbar.Header>
				<Appbar.BackAction onPress={() => router.back()} />
				<Appbar.Content title='BBPlayer 账号' />
			</Appbar.Header>
			<ScrollView
				style={styles.scrollView}
				contentContainerStyle={[
					styles.scrollContent,
					{ paddingBottom: insets.bottom + (haveTrack ? 90 : 24) },
				]}
			>
				{account ? (
					<View style={styles.section}>
						<View style={styles.profileHeader}>
							{account.face ? (
								<Avatar.Image
									size={64}
									source={{ uri: account.face }}
								/>
							) : (
								<Avatar.Text
									size={64}
									label={account.name.slice(0, 1)}
								/>
							)}
							<View style={styles.profileText}>
								<Text variant='titleMedium'>{account.name}</Text>
								<Text variant='bodySmall'>@{account.username}</Text>
							</View>
						</View>
						<Host
							matchContents={{ vertical: true }}
							style={styles.formHost}
						>
							<Column
								modifiers={[fillMaxWidth()]}
								verticalArrangement={{ spacedBy: 8 }}
							>
								<OutlinedTextField
									value={nameState}
									onValueChange={setName}
									singleLine
									modifiers={[fillMaxWidth()]}
								>
									<OutlinedTextField.Label>
										<ComposeText>昵称</ComposeText>
									</OutlinedTextField.Label>
								</OutlinedTextField>
								<OutlinedTextField
									value={faceState}
									onValueChange={setFace}
									singleLine
									keyboardOptions={{ capitalization: 'none' }}
									modifiers={[fillMaxWidth()]}
								>
									<OutlinedTextField.Label>
										<ComposeText>头像 URL</ComposeText>
									</OutlinedTextField.Label>
								</OutlinedTextField>
							</Column>
						</Host>
						<Button
							mode='contained'
							onPress={handleSaveProfile}
							loading={isSavingProfile}
							disabled={isSavingProfile || isRefreshing}
						>
							保存资料
						</Button>
						<Button
							onPress={() => {
								clearAccount()
								toast.success('已退出 BBPlayer 账号')
							}}
						>
							退出登录
						</Button>
					</View>
				) : (
					<View style={styles.section}>
						<View style={styles.descriptionBlock}>
							<Text variant='titleMedium'>登录 BBPlayer 账号</Text>
							<Text
								variant='bodyMedium'
								style={{ color: colors.onSurfaceVariant }}
							>
								登录后可以开启歌单共享、邀请他人协同编辑，并在新设备上自动恢复你的云端共享歌单。
							</Text>
						</View>
						<SegmentedControl
							selectedIndex={mode === 'login' ? 0 : 1}
							onChange={(event) => {
								const selectedIndex = event.nativeEvent.selectedSegmentIndex
								setMode(selectedIndex === 0 ? 'login' : 'register')
							}}
							values={['登录', '注册']}
						/>
						<Host
							matchContents={{ vertical: true }}
							style={styles.formHost}
						>
							<Column
								modifiers={[fillMaxWidth()]}
								verticalArrangement={{ spacedBy: 8 }}
							>
								<OutlinedTextField
									value={usernameState}
									onValueChange={setUsername}
									singleLine
									keyboardOptions={{ capitalization: 'none' }}
									modifiers={[fillMaxWidth()]}
								>
									<OutlinedTextField.Label>
										<ComposeText>用户名</ComposeText>
									</OutlinedTextField.Label>
								</OutlinedTextField>
								<OutlinedTextField
									value={passwordState}
									onValueChange={setPassword}
									singleLine
									visualTransformation='password'
									modifiers={[fillMaxWidth()]}
								>
									<OutlinedTextField.Label>
										<ComposeText>密码</ComposeText>
									</OutlinedTextField.Label>
								</OutlinedTextField>
								{mode === 'register' && (
									<>
										<OutlinedTextField
											value={nameState}
											onValueChange={setName}
											singleLine
											modifiers={[fillMaxWidth()]}
										>
											<OutlinedTextField.Label>
												<ComposeText>昵称</ComposeText>
											</OutlinedTextField.Label>
										</OutlinedTextField>
										<OutlinedTextField
											value={faceState}
											onValueChange={setFace}
											singleLine
											keyboardOptions={{ capitalization: 'none' }}
											modifiers={[fillMaxWidth()]}
										>
											<OutlinedTextField.Label>
												<ComposeText>头像 URL</ComposeText>
											</OutlinedTextField.Label>
										</OutlinedTextField>
									</>
								)}
							</Column>
						</Host>
						{mode === 'register' && (
							<Button
								onPress={fillProfileFromBilibili}
								loading={isFillingProfile}
								disabled={isSubmitting || isFillingProfile}
							>
								使用 Bilibili 资料填充
							</Button>
						)}
						<Button
							mode='contained'
							onPress={mode === 'login' ? handleLogin : handleRegister}
							loading={isSubmitting}
							disabled={isSubmitting}
						>
							{mode === 'login' ? '登录' : '注册'}
						</Button>
						{authStatusText && (
							<Text
								variant='bodySmall'
								style={{ color: colors.onSurfaceVariant }}
							>
								{authStatusText}
							</Text>
						)}
					</View>
				)}
			</ScrollView>
			<View style={styles.nowPlayingBarContainer}>
				<NowPlayingBar />
			</View>
		</View>
	)
}

const styles = StyleSheet.create({
	container: {
		flex: 1,
	},
	scrollView: {
		flex: 1,
	},
	scrollContent: {
		paddingHorizontal: 24,
	},
	section: {
		gap: 14,
		paddingTop: 12,
	},
	descriptionBlock: {
		gap: 6,
		marginBottom: 4,
	},
	formHost: {
		width: '100%',
	},
	profileHeader: {
		flexDirection: 'row',
		alignItems: 'center',
		gap: 14,
		marginBottom: 8,
	},
	profileText: {
		flex: 1,
		gap: 2,
	},
	nowPlayingBarContainer: {
		position: 'absolute',
		bottom: 0,
		left: 0,
		right: 0,
	},
})
