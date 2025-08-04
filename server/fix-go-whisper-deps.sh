#!/bin/bash
set -e

echo "[1/3] 获取最新 go-whisper 依赖..."
go get github.com/ggerganov/whisper.cpp/bindings/go@latest

echo "[2/3] 整理依赖..."
go mod tidy

echo "[3/3] 检查 go-whisper API..."
cat > test_whisper.go <<EOF
package main
import (
	"fmt"
	whisper "github.com/ggerganov/whisper.cpp/bindings/go/pkg/whisper"
)
func main() {
	model, err := whisper.New("server/models/ggml-small.bin")
	if err != nil {
		panic(err)
	}
	defer model.Close()
	ctx, err := model.NewContext()
	if err != nil {
		panic(err)
	}
	fmt.Println("go-whisper API 正常！")
}
EOF

go run test_whisper.go && rm test_whisper.go

echo "✅ go-whisper 依赖和 API 检查通过！"