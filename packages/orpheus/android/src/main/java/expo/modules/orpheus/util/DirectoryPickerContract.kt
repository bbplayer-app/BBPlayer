package expo.modules.orpheus.util

import android.app.Activity
import android.content.Context
import android.content.Intent
import android.net.Uri
import expo.modules.kotlin.activityresult.AppContextActivityResultContract

/**
 * SAF directory picker contract for expo-modules-core's RegisterActivityContracts API.
 *
 * Input:  ignored (pass empty string "")
 * Output: URI string of the selected directory, or null if cancelled / error
 */
class DirectoryPickerContract : AppContextActivityResultContract<String, String?> {
    override fun createIntent(context: Context, input: String): Intent =
        Intent(Intent.ACTION_OPEN_DOCUMENT_TREE).apply {
            addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION or Intent.FLAG_GRANT_WRITE_URI_PERMISSION or Intent.FLAG_GRANT_PERSISTABLE_URI_PERMISSION)
        }

    override fun parseResult(input: String, resultCode: Int, intent: Intent?): String? {
        if (resultCode != Activity.RESULT_OK || intent == null) return null
        return intent.data?.toString()
    }
}
