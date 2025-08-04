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
