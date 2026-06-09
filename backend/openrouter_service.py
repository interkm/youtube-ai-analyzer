import httpx
import json
import re
from gemini_service import build_analysis_prompt


# OpenRouter에서 사용 가능한 모델 목록 (2026년 기준 실제 ID)
OPENROUTER_MODELS = {
    "google/gemini-2.5-flash": "Google Gemini 2.5 Flash",
    "google/gemini-2.5-pro": "Google Gemini 2.5 Pro",
    "google/gemini-3.5-flash": "Google Gemini 3.5 Flash",
    "anthropic/claude-3.5-sonnet": "Claude 3.5 Sonnet",
    "anthropic/claude-3-haiku": "Claude 3 Haiku",
    "openai/gpt-4o-mini": "GPT-4o Mini",
    "openai/gpt-4o": "GPT-4o",
    "deepseek/deepseek-chat": "DeepSeek Chat",
    "meta-llama/llama-3-70b-instruct": "Llama 3 70B",
}

DEFAULT_MODEL = "google/gemini-2.5-flash"


async def analyze_with_openrouter(
    api_key: str,
    title: str,
    channel: str,
    description: str,
    transcript: str,
    transcript_lang: str,
    duration_str: str,
    view_count_str: str,
    model: str = DEFAULT_MODEL,
) -> dict:
    """OpenRouter API로 영상을 분석합니다."""

    prompt = build_analysis_prompt(
        title=title,
        channel=channel,
        description=description,
        transcript=transcript,
        transcript_lang=transcript_lang,
        duration_str=duration_str,
        view_count_str=view_count_str,
    )

    headers = {
        "Authorization": f"Bearer {api_key}",
        "Content-Type": "application/json",
        "HTTP-Referer": "http://localhost:5173",
        "X-Title": "YouTube AI Analyzer",
    }

    payload = {
        "model": model,
        "messages": [
            {
                "role": "user",
                "content": prompt,
            }
        ],
        "max_tokens": 8192,
        "temperature": 0.7,
    }

    async with httpx.AsyncClient(timeout=120.0) as client:
        response = await client.post(
            "https://openrouter.ai/api/v1/chat/completions",
            headers=headers,
            json=payload,
        )

    if response.status_code != 200:
        error_detail = response.text
        try:
            error_json = response.json()
            error_detail = error_json.get("error", {}).get("message", error_detail)
        except Exception:
            pass
        return {
            "success": False,
            "error": f"OpenRouter API 오류 ({response.status_code}): {error_detail}",
        }

    result_json = response.json()
    raw_text = result_json["choices"][0]["message"]["content"].strip()

    # 코드블록 제거
    json_match = re.search(r'```(?:json)?\s*([\s\S]*?)\s*```', raw_text)
    if json_match:
        raw_text = json_match.group(1)

    # 중괄호로 시작하는 부분 추출
    brace_match = re.search(r'\{[\s\S]*\}', raw_text)
    if brace_match:
        raw_text = brace_match.group(0)

    try:
        parsed = json.loads(raw_text)
        return {"success": True, "data": parsed}
    except json.JSONDecodeError as e:
        return {
            "success": False,
            "error": f"JSON 파싱 오류: {str(e)}",
            "raw": raw_text[:500],
        }
