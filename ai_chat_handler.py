#!/usr/bin/env python3
# -*- coding: utf-8 -*-

import json
import sys
import traceback
from llama_cpp import Llama

# 全局模型实例
llm_model = None

def load_model():
    """加载AI模型"""
    global llm_model
    try:
        model_path = r"E:\model\Qwen\Qwen2.5-0.5B-Instruct-GGUF\qwen2.5-0.5b-instruct-q8_0.gguf"
        llm_model = Llama(model_path=model_path, n_ctx=2048, n_threads=4, verbose=False)
        return True
    except Exception as e:
        print(json.dumps({"error": f"模型加载失败: {str(e)}"}), file=sys.stderr)
        return False

def generate_response(message, history):
    """生成AI回复"""
    global llm_model
    
    if llm_model is None:
        if not load_model():
            return "抱歉，AI模型加载失败。"
    
    try:
        # 构建包含历史对话的prompt
        prompt = ""
        
        # 添加历史对话（最近5轮对话）
        history_limit = 5
        recent_history = history[-history_limit*2:] if len(history) > history_limit*2 else history
        
        for item in recent_history:
            if item['role'] == 'user':
                prompt += f"用户：{item['content']}\n"
            elif item['role'] == 'assistant':
                prompt += f"助手：{item['content']}\n"
        
        # 添加当前用户输入
        prompt += f"用户：{message}\n助手："
        
        # 生成回复
        response = llm_model(
            prompt,
            max_tokens=128,
            temperature=0.7,
            stop=[
                "用户:", "\n用户:", "用户：", "\n用户：",
                "问题:", "\n问题:", "问题：", "\n问题：",
                "提问:", "\n提问:", "提问：", "\n提问：",
                "Q:", "\nQ:", "A:", "\nA:",
                "Question:", "\nQuestion:", "Answer:", "\nAnswer:",
                "\n\n", "\n浣犲ソ", "浣犲ソ：", "\n助手：", "助手："
            ],
            echo=False,
            stream=False
        )
        
        # 获取回复文本
        if response and 'choices' in response and len(response['choices']) > 0:
            reply = response['choices'][0]['text'].strip()
            
            # 清理回复内容
            stop_words = ["用户:", "用户：", "问题:", "问题：", "提问:", "提问：", "Q:", "A:", "Question:", "Answer:"]
            for stop_word in stop_words:
                if stop_word in reply:
                    reply = reply.split(stop_word)[0].strip()
                    break
            
            return reply if reply else "我需要更多信息来回答您的问题。"
        else:
            return "抱歉，我无法生成回复。"
            
    except Exception as e:
        print(json.dumps({"error": f"生成回复失败: {str(e)}"}), file=sys.stderr)
        return "抱歉，处理您的消息时出现了错误。"

def main():
    """主函数"""
    try:
        # 从stdin读取JSON数据
        input_data = json.loads(sys.stdin.read())
        
        message = input_data.get('message', '')
        history = input_data.get('history', [])
        
        if not message:
            result = {"error": "消息不能为空"}
        else:
            # 生成AI回复
            ai_response = generate_response(message, history)
            result = {"response": ai_response}
        
        # 输出结果
        print(json.dumps(result, ensure_ascii=False))
        
    except json.JSONDecodeError:
        print(json.dumps({"error": "JSON解析错误"}), file=sys.stderr)
        sys.exit(1)
    except Exception as e:
        print(json.dumps({"error": f"未知错误: {str(e)}"}), file=sys.stderr)
        sys.exit(1)

if __name__ == "__main__":
    main() 