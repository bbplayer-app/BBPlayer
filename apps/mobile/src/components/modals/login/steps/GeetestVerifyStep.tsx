import { Pressable, StyleSheet, View } from 'react-native'
import { Dialog, Portal, Text } from 'react-native-paper'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { WebView } from 'react-native-webview'
import type { WebViewMessageEvent } from 'react-native-webview'

import ActivityIndicator from '@/components/common/ActivityIndicator'
import Button from '@/components/common/Button'

interface Props {
	gt: string
	challenge: string
	onMessage: (event: WebViewMessageEvent) => void
	onCancel: () => void
}

function buildGeetestHtml(gt: string, challenge: string): string {
	const gtJson = JSON.stringify(gt)
	const challengeJson = JSON.stringify(challenge)
	return `<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body {
      display: flex; flex-direction: column;
      align-items: center; justify-content: center;
      min-height: 100vh; background: #f5f5f5;
      font-family: -apple-system, BlinkMacSystemFont, sans-serif;
    }
    .card {
      background: #fff; border-radius: 8px; padding: 20px;
      box-shadow: 0 2px 8px rgba(0,0,0,0.12); width: 90%; max-width: 340px;
    }
    h3 { text-align: center; margin-bottom: 16px; font-size: 16px; color: #333; }
    .err { color: #d32f2f; text-align: center; margin-top: 10px; font-size: 14px; }
  </style>
</head>
<body>
  <div class="card">
    <h3>请完成安全验证</h3>
    <div id="captcha"></div>
    <div class="err" id="err-msg"></div>
  </div>
  <script src="https://static.geetest.com/static/js/gt.0.4.9.js"></script>
  <script>
    initGeetest({
      gt: ${gtJson},
      challenge: ${challengeJson},
      offline: false,
      new_captcha: true,
      product: 'popup',
      width: '100%',
      https: true
    }, function(captchaObj) {
      captchaObj.appendTo('#captcha');
      captchaObj.onSuccess(function() {
        var r = captchaObj.getValidate();
        window.ReactNativeWebView.postMessage(JSON.stringify({
          validate: r.geetest_validate,
          seccode: r.geetest_seccode,
          challenge: r.geetest_challenge
        }));
      });
      captchaObj.onError(function() {
        document.getElementById('err-msg').textContent = '验证出错，请关闭后重试';
      });
    });
  </script>
</body>
</html>`
}

export default function GeetestVerifyStep({
	gt,
	challenge,
	onMessage,
	onCancel,
}: Props) {
	const insets = useSafeAreaInsets()

	return (
		<>
			<Dialog.Title>安全验证</Dialog.Title>
			<Dialog.Content>
				<ActivityIndicator
					size='large'
					style={styles.geetestLoading}
				/>
			</Dialog.Content>
			<Dialog.Actions>
				<Button onPress={onCancel}>取消</Button>
			</Dialog.Actions>
			<Portal>
				<View
					style={[
						StyleSheet.absoluteFill,
						styles.geetestPortalContainer,
						{ paddingTop: insets.top, paddingBottom: insets.bottom },
					]}
				>
					<View style={styles.geetestModalHeader}>
						<Text
							variant='titleMedium'
							style={styles.geetestModalTitle}
						>
							安全验证
						</Text>
						<Pressable
							onPress={onCancel}
							style={styles.geetestModalClose}
						>
							<Text variant='labelLarge'>取消</Text>
						</Pressable>
					</View>
					<WebView
						style={styles.geetestWebView}
						source={{
							html: buildGeetestHtml(gt, challenge),
							baseUrl: 'https://www.bilibili.com',
						}}
						onMessage={onMessage}
						javaScriptEnabled
						originWhitelist={['*']}
						mixedContentMode='always'
						startInLoadingState
						renderLoading={() => (
							<ActivityIndicator
								style={StyleSheet.absoluteFill}
								size='large'
							/>
						)}
					/>
				</View>
			</Portal>
		</>
	)
}

const styles = StyleSheet.create({
	geetestLoading: {
		marginVertical: 24,
	},
	geetestPortalContainer: {
		backgroundColor: '#f5f5f5',
	},
	geetestModalHeader: {
		flexDirection: 'row',
		alignItems: 'center',
		justifyContent: 'space-between',
		paddingHorizontal: 16,
		paddingVertical: 12,
		backgroundColor: '#fff',
		borderBottomWidth: StyleSheet.hairlineWidth,
		borderBottomColor: 'rgba(0,0,0,0.1)',
	},
	geetestModalTitle: {
		flex: 1,
	},
	geetestModalClose: {
		paddingLeft: 16,
		paddingVertical: 4,
	},
	geetestWebView: {
		flex: 1,
	},
})
