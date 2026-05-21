package expo.modules.wavyslider

import android.os.Looper
import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition
import expo.modules.kotlin.jni.worklets.Worklet
import expo.modules.kotlin.types.Either
import expo.modules.wavyslider.state.ObservableState
import expo.modules.wavyslider.state.ObservableStateHandle
import expo.modules.wavyslider.state.WorkletCallback
import expo.modules.wavyslider.state.setObservableFloat
import kotlinx.coroutines.launch

class ExpoWavySliderModule : Module() {

    override fun definition() = ModuleDefinition {
        Name("ExpoWavySlider")

        Class(WorkletCallback::class) {
            Constructor { worklet: Worklet ->
                val callback = WorkletCallback()
                callback.worklet = worklet
                callback
            }
        }

        Class(ObservableState::class) {
            Constructor { initial: Map<String, Any?> ->
                ObservableState(initial["value"])
            }

            Function("getValue") { state: ObservableState ->
                state.value
            }

            Function("setValue") { state: ObservableState, wrapper: Map<String, Any?> ->
                val newValue = wrapper["value"]
                val mainLooper = Looper.getMainLooper()
                // Update state on the UI thread
                if (mainLooper.isCurrentThread) {
                    state.value = newValue
                } else {
                    appContext.mainQueue.launch {
                        state.value = newValue
                    }
                }
            }

            Function("setOnChange") { state: ObservableState, callback: WorkletCallback? ->
                state.onChange = callback
            }
        }

        View(ExpoWavySliderView::class) {
            Prop("value") { view: ExpoWavySliderView, value: Float ->
                view.value = value
            }

            Prop("progress", null as ObservableState?) { view: ExpoWavySliderView, progress: ObservableState? ->
                view.progress = progress
            }

            Prop("bufferedValue") { view: ExpoWavySliderView, value: Float ->
                view.bufferedValue = value
            }

            Prop("bufferedProgress", null as ObservableState?) { view: ExpoWavySliderView, progress: ObservableState? ->
                view.bufferedProgress = progress
            }

            Prop("min") { view: ExpoWavySliderView, min: Float ->
                view.min = min
            }

            Prop("max") { view: ExpoWavySliderView, max: Float ->
                view.max = max
            }

            Prop("lowerLimit", null as Float?) { view: ExpoWavySliderView, lowerLimit: Float? ->
                view.lowerLimit = lowerLimit
            }

            Prop("upperLimit", null as Float?) { view: ExpoWavySliderView, upperLimit: Float? ->
                view.upperLimit = upperLimit
            }

            Prop("enabled") { view: ExpoWavySliderView, enabled: Boolean ->
                view.sliderEnabled = enabled
            }

            Prop("colors") { view: ExpoWavySliderView, colors: WavySliderColors ->
                view.colors = colors
            }

            Prop("waveLength") { view: ExpoWavySliderView, value: Either<ObservableStateHandle, Float> ->
                value.setObservableFloat(appContext, { view.waveLengthState = it }, { view.waveLength = it })
            }

            Prop("waveHeight") { view: ExpoWavySliderView, value: Either<ObservableStateHandle, Float> ->
                value.setObservableFloat(appContext, { view.waveHeightState = it }, { view.waveHeight = it })
            }

            Prop("waveVelocity") { view: ExpoWavySliderView, value: Either<ObservableStateHandle, Float> ->
                value.setObservableFloat(appContext, { view.waveVelocityState = it }, { view.waveVelocity = it })
            }

            Prop("waveDirection") { view: ExpoWavySliderView, waveDirection: WavySliderWaveDirection ->
                view.waveDirection = waveDirection
            }

            Prop("waveThickness") { view: ExpoWavySliderView, value: Either<ObservableStateHandle, Float> ->
                value.setObservableFloat(appContext, { view.waveThicknessState = it }, { view.waveThickness = it })
            }

            Prop("trackThickness") { view: ExpoWavySliderView, value: Either<ObservableStateHandle, Float> ->
                value.setObservableFloat(appContext, { view.trackThicknessState = it }, { view.trackThickness = it })
            }

            Prop("incremental") { view: ExpoWavySliderView, incremental: Boolean ->
                view.incremental = incremental
            }

            Prop("onValueChange", null as WorkletCallback?) { view: ExpoWavySliderView, callback: WorkletCallback? ->
                view.onValueChange = callback
            }

            Prop("onValueChangeFinished", null as WorkletCallback?) { view: ExpoWavySliderView, callback: WorkletCallback? ->
                view.onValueChangeFinished = callback
            }

            Prop("onDragStateChange", null as WorkletCallback?) { view: ExpoWavySliderView, callback: WorkletCallback? ->
                view.onDragStateChange = callback
            }
        }
    }
}
