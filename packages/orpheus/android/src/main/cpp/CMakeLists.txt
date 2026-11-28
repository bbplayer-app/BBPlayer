cmake_minimum_required(VERSION 3.22.1)
project(orpheus_tags LANGUAGES CXX)

include(FetchContent)

# 只编我们要用的格式：B 站下载都是 MP4（AAC / 杜比 ec-3），Hi-Res 导出为 FLAC
set(BUILD_SHARED_LIBS OFF CACHE BOOL "" FORCE)
set(BUILD_TESTING OFF CACHE BOOL "" FORCE)
set(BUILD_EXAMPLES OFF CACHE BOOL "" FORCE)
set(BUILD_BINDINGS OFF CACHE BOOL "" FORCE)
set(WITH_ZLIB OFF CACHE BOOL "" FORCE)
set(WITH_APE OFF CACHE BOOL "" FORCE)
set(WITH_ASF OFF CACHE BOOL "" FORCE)
set(WITH_DSF OFF CACHE BOOL "" FORCE)
set(WITH_MATROSKA OFF CACHE BOOL "" FORCE)
set(WITH_MOD OFF CACHE BOOL "" FORCE)
set(WITH_RIFF OFF CACHE BOOL "" FORCE)
set(WITH_SHORTEN OFF CACHE BOOL "" FORCE)
set(WITH_TRUEAUDIO OFF CACHE BOOL "" FORCE)
set(WITH_MP4 ON CACHE BOOL "" FORCE)
set(WITH_VORBIS ON CACHE BOOL "" FORCE)
set(VISIBILITY_HIDDEN ON CACHE BOOL "" FORCE)

FetchContent_Declare(
    taglib
    URL https://github.com/taglib/taglib/releases/download/v2.3.2/taglib-2.3.2.tar.gz
    URL_HASH SHA256=3ca2d8afaa7f1cf7f6ed10e511ebc368bfacd6dcaa3dbfa690b89e502e8963dc
)
FetchContent_MakeAvailable(taglib)

add_library(orpheus_tags SHARED orpheus_tags.cpp)
target_compile_features(orpheus_tags PRIVATE cxx_std_17)
# TagLib 只给安装后的头文件路径，作为子项目时要自己指到源码目录
target_include_directories(orpheus_tags PRIVATE
    ${taglib_SOURCE_DIR}/taglib
    ${taglib_SOURCE_DIR}/taglib/toolkit
    ${taglib_BINARY_DIR}
)
target_compile_options(orpheus_tags PRIVATE -Os -fvisibility=hidden)
target_link_libraries(orpheus_tags PRIVATE tag log)
target_link_options(orpheus_tags PRIVATE -Wl,--gc-sections -Wl,--exclude-libs,ALL)
