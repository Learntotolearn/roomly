#!/bin/bash
set -e

WHISPER_DIR="whisper.cpp"
REPO_URL="https://github.com/ggerganov/whisper.cpp.git"

# 检查 git
if ! command -v git &> /dev/null; then
  echo "❌ 未检测到 git，请先安装 git。"
  exit 1
fi

# 检查 make
if ! command -v make &> /dev/null; then
  echo "❌ 未检测到 make，请先安装 make（macOS: xcode-select --install，Linux: sudo apt install build-essential）。"
  exit 1
fi

# 克隆仓库
if [ ! -d "$WHISPER_DIR" ]; then
  echo "[1/3] 正在克隆 whisper.cpp..."
  git clone "$REPO_URL" "$WHISPER_DIR"
else
  echo "[1/3] whisper.cpp 已存在，跳过克隆。"
fi

# 编译
cd "$WHISPER_DIR"
echo "[2/3] 正在编译 whisper.cpp..."
make

# 返回上级目录
cd ..

# 提示头文件路径
WHISPER_H_PATH="$(pwd)/$WHISPER_DIR"
echo "[3/3] whisper.cpp 编译完成！"
echo "\n请将如下路径加入 CGO_CFLAGS 和 CGO_LDFLAGS："
echo "  export CGO_CFLAGS=\"-I$WHISPER_H_PATH\""
echo "  export CGO_LDFLAGS=\"-L$WHISPER_H_PATH\""
echo "\n或者将 $WHISPER_H_PATH/whisper.h 复制到 /usr/local/include。"
echo "\n现在可以重新运行 fix-go-whisper-deps.sh 进行依赖检测。"