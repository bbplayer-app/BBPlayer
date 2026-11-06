# WavySlider waveform sources

`wave/Wave.kt` and the drawing helpers in `wave/WavyTrack.kt` are adapted from
Mahdi Hosseinzadeh's [wavy-slider](https://github.com/mahozad/wavy-slider), version 2.2.0,
licensed under Apache-2.0 (see LICENSE.txt).

Source artifact: https://repo.maven.apache.org/maven2/ir/mahozad/multiplatform/wavy-slider-android/2.2.0/wavy-slider-android-2.2.0-sources.jar

The original wave animation and path drawing are retained. The track adapter takes
a value fraction and public colors rather than accessing Material 3 internals.
Material 3 1.5's public Slider handles input, semantics, and thumb layout.
This avoids the published library's binary dependency on removed SliderState APIs.
