import { useLikeComment } from '@/hooks/mutations/bilibili/comments'
import type { BilibiliCommentItem } from '@/types/apis/bilibili'
import { toastAndLogError } from '@/utils/error-handling'
import { formatRelativeTime } from '@/utils/time'
import { useRecyclingState } from '@shopify/flash-list'
import { Image } from 'expo-image'
import { useRouter } from 'expo-router'
import { useState } from 'react'
import { Modal, StyleSheet, TouchableOpacity, View } from 'react-native'
import type { RenderItemInfo } from 'react-native-awesome-gallery'
import Gallery from 'react-native-awesome-gallery'
import { IconButton, Text, useTheme } from 'react-native-paper'
import { useSafeAreaInsets } from 'react-native-safe-area-context'

interface CommentItemProps {
	item: BilibiliCommentItem
	onReplyPress?: (item: BilibiliCommentItem) => void
	bvid: string
}

const renderImageItem = ({
	item,
	setImageDimensions,
}: RenderItemInfo<{ uri: string }>) => {
	return (
		<Image
			source={item.uri}
			style={StyleSheet.absoluteFillObject}
			contentFit='contain'
			onLoad={(e) => {
				const { width, height } = e.source
				setImageDimensions({ width, height })
			}}
		/>
	)
}

export function CommentItem({ item, onReplyPress, bvid }: CommentItemProps) {
	const theme = useTheme()
	const [liked, setLiked] = useState(item.action === 1)
	const [likeCount, setLikeCount] = useState(item.like || 0)
	const router = useRouter()
	const [galleryVisible, setGalleryVisible] = useRecyclingState(false, [
		item.rpid,
	])
	const [selectedIndex, setSelectedIndex] = useRecyclingState(0, [item.rpid])
	const insets = useSafeAreaInsets()

	const openGallery = (index: number) => {
		setSelectedIndex(index)
		setGalleryVisible(true)
	}

	const closeGallery = () => {
		setGalleryVisible(false)
	}

	const { mutateAsync: likeComment } = useLikeComment()

	const handleLike = async () => {
		setLiked(!liked)
		setLikeCount(liked ? likeCount - 1 : likeCount + 1)
		const newAction = liked ? 0 : 1
		try {
			await likeComment({
				bvid,
				rpid: item.rpid,
				newAction: newAction,
			})
		} catch (e) {
			toastAndLogError('点赞失败', e, 'Comments.CommentItem')
			setLiked(liked)
			setLikeCount(likeCount)
			return
		}
	}

	const onClickUser = () => {
		router.push(`/playlist/remote/uploader/${item.mid}`)
	}

	return (
		<>
			<View style={styles.container}>
				<View onTouchEnd={onClickUser}>
					<Image
						source={{ uri: item.member.avatar }}
						style={styles.avatar}
						contentFit='cover'
					/>
				</View>
				<View style={styles.contentContainer}>
					<View style={styles.header}>
						<Text
							style={[styles.username, { color: theme.colors.secondary }]}
							numberOfLines={1}
							onPress={onClickUser}
						>
							{item.member.uname}
						</Text>
						<Text style={[styles.time, { color: theme.colors.outline }]}>
							{formatRelativeTime(item.ctime * 1000)}
						</Text>
					</View>

					<Text
						style={[styles.message, { color: theme.colors.onSurface }]}
						selectable
					>
						{item.content.message}
					</Text>

					{item.content.pictures && item.content.pictures.length > 0 && (
						<View style={styles.imagesContainer}>
							{item.content.pictures.map((pic, index) => (
								<TouchableOpacity
									key={index}
									onPress={() => openGallery(index)}
								>
									<Image
										key={index}
										source={{ uri: pic.img_src }}
										style={styles.commentImage}
										contentFit='contain'
									/>
								</TouchableOpacity>
							))}
						</View>
					)}

					<View style={styles.actions}>
						<TouchableOpacity
							style={styles.actionButton}
							onPress={handleLike}
						>
							<IconButton
								icon={liked ? 'thumb-up' : 'thumb-up-outline'}
								size={16}
								iconColor={liked ? theme.colors.primary : theme.colors.outline}
								style={styles.actionIcon}
							/>
							<Text style={{ color: theme.colors.outline, fontSize: 12 }}>
								{likeCount > 0 ? likeCount : '点赞'}
							</Text>
						</TouchableOpacity>

						{item.rcount > 0 && (
							<TouchableOpacity
								style={styles.actionButton}
								onPress={() => onReplyPress?.(item)}
							>
								<IconButton
									icon='comment-outline'
									size={16}
									iconColor={theme.colors.outline}
									style={styles.actionIcon}
								/>
								<Text style={{ color: theme.colors.outline, fontSize: 12 }}>
									{item.rcount}
								</Text>
							</TouchableOpacity>
						)}
					</View>

					{item.replies && item.replies.length > 0 && (
						<TouchableOpacity
							onPress={() => onReplyPress?.(item)}
							style={[
								styles.repliesPreview,
								{ backgroundColor: theme.colors.surfaceVariant },
							]}
						>
							{item.replies.slice(0, 3).map((reply) => (
								<Text
									key={reply.rpid}
									numberOfLines={1}
									style={[
										styles.replyPreviewText,
										{ color: theme.colors.onSurfaceVariant },
									]}
								>
									<Text style={{ fontWeight: 'bold' }}>
										{reply.member.uname}:{' '}
									</Text>
									{reply.content.message}
								</Text>
							))}
							{item.rcount > 3 && (
								<Text
									style={[styles.viewMoreText, { color: theme.colors.primary }]}
								>
									查看全部 {item.rcount} 条回复
								</Text>
							)}
						</TouchableOpacity>
					)}
				</View>
			</View>
			<Modal
				visible={galleryVisible}
				transparent={true}
				animationType='none'
				onRequestClose={closeGallery}
				statusBarTranslucent
				navigationBarTranslucent
			>
				<View
					style={[
						styles.galleryContainer,
						{
							paddingTop: insets.top,
							paddingBottom: insets.bottom,
							paddingLeft: insets.left,
							paddingRight: insets.right,
						},
					]}
				>
					<Gallery
						data={
							item.content.pictures?.map((pic) => ({ uri: pic.img_src })) ?? []
						}
						keyExtractor={(item) => item.uri}
						renderItem={renderImageItem}
						initialIndex={selectedIndex}
						numToRender={5}
						doubleTapInterval={150}
						onSwipeToClose={closeGallery}
					/>
				</View>
			</Modal>
		</>
	)
}

const styles = StyleSheet.create({
	container: {
		flexDirection: 'row',
		paddingHorizontal: 16,
		paddingVertical: 12,
	},
	avatar: {
		width: 40,
		height: 40,
		borderRadius: 20,
		marginRight: 12,
	},
	contentContainer: {
		flex: 1,
	},
	header: {
		flexDirection: 'row',
		justifyContent: 'space-between',
		alignItems: 'center',
		marginBottom: 4,
	},
	username: {
		fontSize: 14,
		fontWeight: 'bold',
		flex: 1,
		marginRight: 8,
	},
	time: {
		fontSize: 12,
	},
	message: {
		fontSize: 15,
		lineHeight: 22,
		marginBottom: 8,
	},
	imagesContainer: {
		flexDirection: 'row',
		flexWrap: 'wrap',
		gap: 8,
		marginBottom: 8,
	},
	commentImage: {
		width: 100,
		height: 100,
		borderRadius: 8,
		backgroundColor: '#f0f0f0',
	},
	actions: {
		flexDirection: 'row',
		alignItems: 'center',
		gap: 16,
	},
	actionButton: {
		flexDirection: 'row',
		alignItems: 'center',
	},
	actionIcon: {
		margin: 0,
		marginRight: 0,
	},
	repliesPreview: {
		marginTop: 8,
		padding: 8,
		borderRadius: 8,
	},
	replyPreviewText: {
		fontSize: 13,
		marginBottom: 4,
	},
	viewMoreText: {
		fontSize: 13,
		marginTop: 4,
		fontWeight: 'bold',
	},
	galleryContainer: {
		flex: 1,
		backgroundColor: 'black',
	},
})
