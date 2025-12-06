# Add project specific ProGuard rules here.
# By default, the flags in this file are appended to flags specified
# in /usr/local/Cellar/android-sdk/24.3.3/tools/proguard/proguard-android.txt
# You can edit the include path and order by changing the proguardFiles
# directive in build.gradle.
#
# For more details, see
#   http://developer.android.com/guide/developing/tools/proguard.html

# react-native-reanimated
-keep class com.swmansion.reanimated.** { *; }
-keep class com.facebook.react.turbomodule.** { *; }

# Add any project specific keep options here:
# 保留 media3
-keep class androidx.media3.** { *; }
-keep interface androidx.media3.** { *; }

-keep class com.google.android.exoplayer2.** { *; }
-keep interface com.google.android.exoplayer2.** { *; }

-dontwarn okhttp3.**
-keep class okhttp3.** { *; }
-keep interface okhttp3.** { *; }
-keepattributes Signature, InnerClasses, EnclosingMethod

-keep class androidx.media3.datasource.okhttp.** { *; }