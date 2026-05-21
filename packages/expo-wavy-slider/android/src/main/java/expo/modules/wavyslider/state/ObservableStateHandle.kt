package expo.modules.wavyslider.state

import expo.modules.kotlin.AppContext
import expo.modules.kotlin.records.Field
import expo.modules.kotlin.records.Record
import expo.modules.kotlin.sharedobjects.SharedObjectId
import expo.modules.kotlin.types.Either
import expo.modules.kotlin.types.OptimizedRecord

@OptimizedRecord
class ObservableStateHandle : Record {
    @Field
    val stateId: Int = 0
}

fun Either<ObservableStateHandle, Float>.setObservableFloat(
    appContext: AppContext,
    setState: (ObservableState?) -> Unit,
    setFallback: (Float) -> Unit
) {
    // 这部分逻辑来自 `expo/modules/kotlin/sharedobjects/SharedObjectTypeConverter.kt`，目的是根据 SharedObject Id 在 Registry 里取得对应的 SharedObject 实例
    if (`is`(ObservableStateHandle::class)) {
        val handle = get(ObservableStateHandle::class)
        val sharedObject = SharedObjectId(handle.stateId).toNativeObject(appContext.runtime)
        val state = sharedObject as? ObservableState
            ?: throw ClassCastException(
                "${sharedObject::class.java.name} cannot be cast to ${ObservableState::class.java.name}"
            )
        setState(state)
    } else {
        setState(null)
        setFallback(get(Float::class))
    }
}
