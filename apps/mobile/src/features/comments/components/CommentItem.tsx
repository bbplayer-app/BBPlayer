import { Galeria } from '@nandorojo/galeria'
import { Image } from 'expo-image'
import { useRouter } from 'expo-router'
import { memo, useEffect, useMemo, useState } from 'react'
import { Appearance, StyleSheet, TouchableOpacity, View } from 'react-native'
import SquircleView from 'react-native-fast-squircle'
import { Text, useTheme } from 'react-native-paper'

import IconButton from '@/components/common/IconButton'
import { useLikeComment } from '@/hooks/mutations/bilibili/comments'
import type {
	BilibiliCommentEmote,
	BilibiliCommentItem,
} from '@/types/apis/bilibili'
import { toastAndLogError } from '@/utils/error-handling'
import { formatRelativeTime } from '@/utils/time'

interface CommentItemProps {
	item: BilibiliCommentItem
	onReplyPress?: (item: BilibiliCommentItem) => void
	bvid: string
}

type MessageSegment =
	| { type: 'text'; key: string; text: string }
	| { type: 'emote'; key: string; text: string; emote: BilibiliCommentEmote }

const escapeRegExp = (value: string) =>
	value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')

const parseMessageSegments = (
	message: string,
	emotes?: Record<string, BilibiliCommentEmote>,
): MessageSegment[] => {
	const emoteKeys = Object.keys(emotes ?? {}).sort(
		(a, b) => b.length - a.length,
	)
	if (emoteKeys.length === 0) {
		return [{ type: 'text', key: 'text-0', text: message }]
	}

	const pattern = new RegExp(`(${emoteKeys.map(escapeRegExp).join('|')})`, 'g')
	const segments: MessageSegment[] = []
	let cursor = 0
	let index = 0

	for (const match of message.matchAll(pattern)) {
		const rawText = match[0]
		const start = match.index ?? 0
		if (start > cursor) {
			segments.push({
				type: 'text',
				key: `text-${index++}`,
				text: message.slice(cursor, start),
			})
		}
		const emote = emotes?.[rawText]
		if (emote?.url) {
			segments.push({
				type: 'emote',
				key: `emote-${index++}-${emote.id}`,
				text: rawText,
				emote,
			})
		} else {
			segments.push({ type: 'text', key: `text-${index++}`, text: rawText })
		}
		cursor = start + rawText.length
	}

	if (cursor < message.length) {
		segments.push({
			type: 'text',
			key: `text-${index}`,
			text: message.slice(cursor),
		})
	}

	return segments.length > 0
		? segments
		: [{ type: 'text', key: 'text-0', text: message }]
}

const CommentMessage = memo(function CommentMessage({
	message,
	emotes,
	color,
}: {
	message: string
	emotes?: Record<string, BilibiliCommentEmote>
	color: string
}) {
	const segments = useMemo(
		() => parseMessageSegments(message, emotes),
		[emotes, message],
	)

	return (
		<View style={styles.messageContainer}>
			{segments.map((segment) => {
				if (segment.type === 'text') {
					return (
						<Text
							key={segment.key}
							style={[styles.message, { color }]}
							selectable
						>
							{segment.text}
						</Text>
					)
				}

				const size = segment.emote.meta?.size === 2 ? 48 : 24
				return (
					<Image
						key={segment.key}
						source={{ uri: segment.emote.url }}
						style={{ width: size, height: size }}
						contentFit='contain'
						cachePolicy='disk'
						recyclingKey={segment.emote.url}
						accessibilityLabel={segment.text}
					/>
				)
			})}
		</View>
	)
})

export function CommentItem({ item, onReplyPress, bvid }: CommentItemProps) {
	const theme = useTheme()
	const [liked, setLiked] = useState(item.action === 1)
	const [likeCount, setLikeCount] = useState(item.like || 0)
	const router = useRouter()
	const [darkMode, setDarkMode] = useState(
		Appearance.getColorScheme() === 'dark',
	)

	useEffect(() => {
		const subscription = Appearance.addChangeListener(({ colorScheme }) => {
			setDarkMode(colorScheme === 'dark')
		})
		return () => subscription.remove()
	}, [])

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

					<CommentMessage
						message={item.content.message}
						emotes={item.content.emote}
						color={theme.colors.onSurface}
					/>

					{item.content.pictures && item.content.pictures.length > 0 && (
						<View style={styles.imagesContainer}>
							<Galeria
								urls={item.content.pictures.map((pic) => pic.img_src ?? '')}
								theme={darkMode ? 'dark' : 'light'}
							>
								{item.content.pictures.map((pic, index) => {
									return (
										/* oxlint-disable-next-line @typescript-eslint/unbound-method */
										<Galeria.Image
											index={index}
											// oxlint-disable-next-line react/no-array-index-key
											key={index}
										>
											<View
												style={styles.commentImage}
												testID='comment-image'
											>
												<Image
													source={{ uri: pic.img_src }}
													style={styles.commentImageInner}
													contentFit='contain'
												/>
											</View>
											{/* oxlint-disable-next-line @typescript-eslint/unbound-method */}
										</Galeria.Image>
									)
								})}
							</Galeria>
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
						<TouchableOpacity onPress={() => onReplyPress?.(item)}>
							<SquircleView
								style={[
									styles.repliesPreview,
									{ backgroundColor: theme.colors.surfaceVariant },
								]}
								cornerSmoothing={0.6}
							>
								{item.replies.slice(0, 3).map((reply) => (
									<View
										key={reply.rpid}
										style={styles.replyPreviewRow}
									>
										<Text
											style={[
												styles.replyPreviewText,
												{
													color: theme.colors.onSurfaceVariant,
													fontWeight: 'bold',
												},
											]}
										>
											{reply.member.uname}:{' '}
										</Text>
										<CommentMessage
											message={reply.content.message}
											emotes={reply.content.emote}
											color={theme.colors.onSurfaceVariant}
										/>
									</View>
								))}
								{item.rcount > 3 && (
									<Text
										style={[
											styles.viewMoreText,
											{ color: theme.colors.primary },
										]}
									>
										查看全部 {item.rcount} 条回复
									</Text>
								)}
							</SquircleView>
						</TouchableOpacity>
					)}
				</View>
			</View>
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
	messageContainer: {
		flexDirection: 'row',
		flexWrap: 'wrap',
		alignItems: 'center',
		columnGap: 2,
		marginBottom: 8,
	},
	message: {
		fontSize: 15,
		lineHeight: 22,
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
		borderRadius: 0,
		backgroundColor: '#f0f0f0',
		overflow: 'hidden',
	},
	commentImageInner: {
		width: 100,
		height: 100,
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
		borderRadius: 12,
		overflow: 'hidden',
	},
	replyPreviewText: {
		fontSize: 13,
		marginBottom: 4,
	},
	replyPreviewRow: {
		flexDirection: 'row',
		flexWrap: 'wrap',
	},
	viewMoreText: {
		fontSize: 13,
		marginTop: 4,
		fontWeight: 'bold',
	},
})
