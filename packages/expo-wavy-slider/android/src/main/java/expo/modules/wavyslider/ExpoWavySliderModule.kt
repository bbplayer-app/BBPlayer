package expo.modules.wavyslider

import android.os.Looper
import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition
import expo.modules.kotlin.jni.worklets.Worklet
import expo.modules.wavyslider.state.ObservableState
import expo.modules.wavyslider.state.WorkletCallback
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

            Prop("waveLength") { view: ExpoWavySliderView, waveLength: Float ->
                view.waveLength = waveLength
            }

            Prop("waveLengthState", null as ObservableState?) { view: ExpoWavySliderView, state: ObservableState? ->
                view.waveLengthState = state
            }

            Prop("waveHeight") { view: ExpoWavySliderView, waveHeight: Float ->
                view.waveHeight = waveHeight
            }

            Prop("waveHeightState", null as ObservableState?) { view: ExpoWavySliderView, state: ObservableState? ->
                view.waveHeightState = state
            }

            Prop("waveVelocity") { view: ExpoWavySliderView, waveVelocity: Float ->
                view.waveVelocity = waveVelocity
            }

            Prop("waveVelocityState", null as ObservableState?) { view: ExpoWavySliderView, state: ObservableState? ->
                view.waveVelocityState = state
            }

            Prop("waveDirection") { view: ExpoWavySliderView, waveDirection: WavySliderWaveDirection ->
                view.waveDirection = waveDirection
            }

            Prop("waveThickness") { view: ExpoWavySliderView, waveThickness: Float ->
                view.waveThickness = waveThickness
            }

            Prop("waveThicknessState", null as ObservableState?) { view: ExpoWavySliderView, state: ObservableState? ->
                view.waveThicknessState = state
            }

            Prop("trackThickness") { view: ExpoWavySliderView, trackThickness: Float ->
                view.trackThickness = trackThickness
            }

            Prop("trackThicknessState", null as ObservableState?) { view: ExpoWavySliderView, state: ObservableState? ->
                view.trackThicknessState = state
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
