#!/usr/bin/env python3
import subprocess
import tempfile
import os

def test_audio_conversion():
    """
    测试音频转换功能
    """
    try:
        # 创建一个简单的测试音频文件（静音）
        test_audio = b'\x00' * 16000  # 1秒的静音
        
        with tempfile.NamedTemporaryFile(suffix='.webm', delete=False) as temp_input:
            temp_input.write(test_audio)
            input_path = temp_input.name
        
        with tempfile.NamedTemporaryFile(suffix='.wav', delete=False) as temp_output:
            output_path = temp_output.name
        
        print(f"测试输入文件: {input_path}")
        print(f"测试输出文件: {output_path}")
        
        # 尝试转换
        cmd = [
            'ffmpeg', '-i', input_path, 
            '-acodec', 'pcm_s16le', 
            '-ar', '16000', 
            '-ac', '1', 
            '-y', output_path
        ]
        
        print("执行命令:", ' '.join(cmd))
        
        result = subprocess.run(cmd, capture_output=True, text=True)
        
        print(f"返回码: {result.returncode}")
        if result.stdout:
            print("标准输出:", result.stdout)
        if result.stderr:
            print("错误输出:", result.stderr)
        
        if result.returncode == 0 and os.path.exists(output_path):
            print("✅ 音频转换成功")
            print(f"输出文件大小: {os.path.getsize(output_path)} bytes")
            return True
        else:
            print("❌ 音频转换失败")
            return False
            
    except Exception as e:
        print(f"❌ 测试异常: {str(e)}")
        return False
    finally:
        # 清理临时文件
        if 'input_path' in locals() and os.path.exists(input_path):
            os.unlink(input_path)
        if 'output_path' in locals() and os.path.exists(output_path):
            os.unlink(output_path)

if __name__ == "__main__":
    print("开始测试音频转换...")
    success = test_audio_conversion()
    if success:
        print("🎉 音频转换测试通过！")
    else:
        print("💥 音频转换测试失败！") 