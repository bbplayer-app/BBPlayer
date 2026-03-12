#!/bin/bash
# Script to manually update Lyricon source code in the Orpheus package.
# Usage: ./scripts/update-lyricon.sh [version/tag/commit]
# Example: ./scripts/update-lyricon.sh 0.1.68

set -e

VERSION=${1:-master}
TARGET_JAVA_DIR="packages/orpheus/android/src/main/java"
TARGET_AIDL_DIR="packages/orpheus/android/src/main/aidl"
LYRICON_REPO="https://github.com/tomakino/lyricon.git"
TEMP_DIR="/tmp/lyricon-update-$$"

echo "🔄 Updating Lyricon source to version/commit: $VERSION"

# 1. Clone the repository
echo "📥 Cloning $LYRICON_REPO..."
git clone "$LYRICON_REPO" "$TEMP_DIR"
cd "$TEMP_DIR"
git checkout "$VERSION"
cd - > /dev/null

# 2. Prepare target directories (Clean up specifically the io/github/proify/lyricon path)
echo "🧹 Cleaning up old Lyricon source..."
rm -rf "$TARGET_JAVA_DIR/io/github/proify/lyricon"
rm -rf "$TARGET_AIDL_DIR/io/github/proify/lyricon"

# 3. Copy source files
echo "📂 Copying source files..."
# Kotlin files
# We use /io/. to copy the contents of io into the target's io folder
mkdir -p "$TARGET_JAVA_DIR"
cp -R "$TEMP_DIR/lyric/model/src/main/kotlin/io" "$TARGET_JAVA_DIR/"
cp -R "$TEMP_DIR/lyric/bridge/provider/src/main/kotlin/io" "$TARGET_JAVA_DIR/"

# AIDL files
mkdir -p "$TARGET_AIDL_DIR"
cp -R "$TEMP_DIR/lyric/bridge/provider/src/main/aidl/io" "$TARGET_AIDL_DIR/"

# 4. Apply necessary patches for Kotlin 2.1.20 compatibility
echo "🔧 Applying compatibility patches..."
BINDER_FILE="$TARGET_JAVA_DIR/io/github/proify/lyricon/provider/ProviderBinder.kt"

if [ -f "$BINDER_FILE" ]; then
    # Add missing encodeToString import if not present
    if grep -q "kotlinx.serialization.encodeToString" "$BINDER_FILE"; then
        echo "  - Import already exists."
    else
        echo "  - Adding kotlinx.serialization.encodeToString import..."
        # Using a more robust sed approach for both BSD and GNU sed
        sed -i.bak 's/import io.github.proify.lyricon.provider.service.RemoteServiceBinder/import io.github.proify.lyricon.provider.service.RemoteServiceBinder\nimport kotlinx.serialization.encodeToString/' "$BINDER_FILE"
        rm "${BINDER_FILE}.bak"
    fi
else
    echo "⚠️  Warning: ProviderBinder.kt not found at $BINDER_FILE"
fi

# 5. Update .lyricon_version
echo "📝 Updating .lyricon_version..."
cd "$TEMP_DIR"
ACTUAL_COMMIT=$(git rev-parse HEAD)
cd - > /dev/null
echo "$ACTUAL_COMMIT" > .lyricon_version
echo "  - Set .lyricon_version to $ACTUAL_COMMIT"

# 6. Cleanup
echo "🧹 Cleaning up temporary files..."
rm -rf "$TEMP_DIR"

echo "✅ Update complete!"
