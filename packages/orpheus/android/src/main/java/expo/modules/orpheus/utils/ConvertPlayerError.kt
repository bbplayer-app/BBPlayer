package expo.modules.orpheus.utils

import android.util.Log
import androidx.media3.common.PlaybackException

fun PlaybackException.toJsMap(): Map<String, Any?> {
    var rootCause: Throwable? = this
    while (rootCause?.cause != null) {
        rootCause = rootCause.cause
    }

    return mapOf(
        "errorCode" to errorCode,
        "errorCodeName" to errorCodeName,
        "timestamp" to System.currentTimeMillis().toString(),
        "message" to message,
        "stackTrace" to Log.getStackTraceString(this),
        "rootCauseClass" to (rootCause?.javaClass?.name ?: "Unknown"),
        "rootCauseMessage" to (rootCause?.message ?: "")
    )
}