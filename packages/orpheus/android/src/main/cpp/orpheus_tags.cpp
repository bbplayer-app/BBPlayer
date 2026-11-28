// TagLib 的薄 JNI 封装：只负责把 Kotlin 传来的文本标签和封面写进文件
#include <jni.h>
#include <android/log.h>

#include <fileref.h>
#include <tpropertymap.h>
#include <tvariant.h>

namespace {

constexpr const char *kLogTag = "OrpheusTags";

TagLib::String toTagString(JNIEnv *env, jstring value) {
    const char *chars = env->GetStringUTFChars(value, nullptr);
    TagLib::String result(chars, TagLib::String::UTF8);
    env->ReleaseStringUTFChars(value, chars);
    return result;
}

}  // namespace

extern "C" JNIEXPORT jboolean JNICALL
Java_expo_modules_orpheus_util_TagWriter_nativeWrite(
    JNIEnv *env,
    jclass /* clazz */,
    jstring path,
    jobjectArray keys,
    jobjectArray values,
    jbyteArray cover,
    jstring coverMime,
    jint coverWidth,
    jint coverHeight) {
    const char *pathChars = env->GetStringUTFChars(path, nullptr);
    TagLib::FileRef file(pathChars, false);
    env->ReleaseStringUTFChars(path, pathChars);

    if (file.isNull()) {
        __android_log_print(ANDROID_LOG_WARN, kLogTag, "unsupported or unreadable file");
        return JNI_FALSE;
    }

    TagLib::PropertyMap properties = file.properties();
    const jsize count = env->GetArrayLength(keys);
    for (jsize i = 0; i < count; ++i) {
        auto key = static_cast<jstring>(env->GetObjectArrayElement(keys, i));
        auto value = static_cast<jstring>(env->GetObjectArrayElement(values, i));
        properties.replace(toTagString(env, key), TagLib::StringList(toTagString(env, value)));
        env->DeleteLocalRef(key);
        env->DeleteLocalRef(value);
    }
    // 返回值是没能写进去的键，这里只记日志，不当作失败
    const TagLib::PropertyMap rejected = file.setProperties(properties);
    if (!rejected.isEmpty()) {
        __android_log_print(ANDROID_LOG_WARN, kLogTag, "rejected properties: %s",
                            rejected.toString().toCString(true));
    }

    if (cover != nullptr) {
        const jsize size = env->GetArrayLength(cover);
        jbyte *bytes = env->GetByteArrayElements(cover, nullptr);
        TagLib::VariantMap picture;
        picture["data"] = TagLib::ByteVector(reinterpret_cast<const char *>(bytes),
                                             static_cast<unsigned int>(size));
        picture["mimeType"] = coverMime != nullptr ? toTagString(env, coverMime)
                                                   : TagLib::String("image/jpeg");
        picture["description"] = TagLib::String();
        picture["pictureType"] = TagLib::String("Front Cover");
        // 只有 FLAC 的 PICTURE 块用得到宽高，TagLib 不会自己去读图片
        picture["width"] = static_cast<int>(coverWidth);
        picture["height"] = static_cast<int>(coverHeight);
        env->ReleaseByteArrayElements(cover, bytes, JNI_ABORT);
        file.setComplexProperties("PICTURE", {picture});
    }

    return file.save() ? JNI_TRUE : JNI_FALSE;
}
