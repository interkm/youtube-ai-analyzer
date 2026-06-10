import os
import httpx
import json
import re
from gemini_service import build_analysis_prompt

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
    analysis_mode: str = "summary",
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
        analysis_mode=analysis_mode,
    )

    _referer = os.environ.get("RAILWAY_PUBLIC_DOMAIN", "http://localhost:5173")
    if _referer and not _referer.startswith("http"):
        _referer = f"https://{_referer}"
    headers = {
        "Authorization": f"Bearer {api_key}",
        "Content-Type": "application/json",
        "HTTP-Referer": _referer,
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
            "raw": raw_text[:800],
        }


async def generate_transformation_with_openrouter(
    api_key: str,
    title: str,
    channel: str,
    analysis_data: dict,
    transcript: str,
    transform_type: str,
    model: str = DEFAULT_MODEL,
) -> dict:
    """OpenRouter API로 심층 비즈니스 문서 변환을 실행합니다."""
    # gemini_service에서 프롬프트를 가져오기 위해 임시 생성
    from gemini_service import generate_transformation
    
    # generate_transformation 내부에서 프롬프트가 무엇인지 가져오기 힘드므로 직접 프롬프트를 빌드하거나,
    # generate_transformation 의 구조를 간접 활용합니다. 여기서는 API 호출만 OpenRouter로 대행합니다.
    # 똑같은 프롬프트를 구성하기 위해 mock client를 활용하거나 프롬프트 텍스트를 구성해야 합니다.
    # gemini_service.py의 generate_transformation 내에 있는 type_prompts 딕셔너리와 매칭합니다.
    
    # 간단히 하기 위해 gemini_service의 generate_transformation을 모방하여 프롬프트를 조립합니다.
    # 이 부분은 gemini_service.py의 generate_transformation에 있는 로직과 동일해야 합니다.
    type_prompts = {
        "elec_safety_plan": f"당신은 국내 전기안전관리대행 사업의 성장전략 전문가입니다. 다음 유튜브 분석 데이터와 영상 내용을 바탕으로, '전기안전관리대행 사업을 위한 구체적 적용 방안 및 로드맵'을 작성하세요.\n\n[유튜브 영상 제목] {title} (채널: {channel})\n[핵심 요약]\n{json.dumps(analysis_data.get('summary', {}), ensure_ascii=False)}\n\n1. 마케팅(블로그, 키워드 광고) 적용안\n2. 1인 실행 프로세스 자동화\n3. CRM DB 및 Hermes AI 에이전트 결합안\n4. 실행 일정 및 기대 효과\n이모지 없이 마크다운 형식으로 작성하세요.",
        "blog_post": f"당신은 전문 SEO 마케터이자 비즈니스 에디터입니다. 다음 유튜브 분석 데이터를 바탕으로 블로그 포스팅을 작성하세요.\n\n[유튜브 영상 제목] {title} (채널: {channel})\n[핵심 요약]\n{json.dumps(analysis_data.get('summary', {}), ensure_ascii=False)}\n\n도입부, 3단락 본론, 결론 및 액션 유도 CTA, 관련 키워드를 포함하고 이모지 없이 마크다운으로 작성하세요.",
        "landing_page": f"당신은 전문 카피라이터이자 UX 기획자입니다. 다음 유튜브 내용을 바탕으로 고전환 랜딩페이지 상세 기획안을 작성하세요.\n\n[유튜브 영상 제목] {title}\n[핵심 요약]\n{json.dumps(analysis_data.get('summary', {}), ensure_ascii=False)}\n\n메인 헤드라인, 페인포인트 자극, 가치제안, 특장점, CTA 및 신청서 폼 기획을 포함하고 이모지 없이 마크다운으로 작성하세요.",
        "hermes_brief": f"당신은 AI 에이전트 설계자입니다. 다음 유튜브 분석을 바탕으로 Hermes AI 에이전트 작업지시서를 작성하세요.\n\n[유튜브 영상 제목] {title}\n[적용 기획]\n{json.dumps(analysis_data.get('business_app', {}), ensure_ascii=False)}\n\n에이전트 역할정의 (System Prompt), 입력 스펙, 처리 로직 단계, 출력 스펙, 실제 LLM 프롬프트 템플릿을 포함하고 이모지 없이 마크다운으로 작성하세요."
    }
    
    prompt = type_prompts.get(transform_type, type_prompts["blog_post"])
    
    _referer = os.environ.get("RAILWAY_PUBLIC_DOMAIN", "http://localhost:5173")
    if _referer and not _referer.startswith("http"):
        _referer = f"https://{_referer}"
    headers = {
        "Authorization": f"Bearer {api_key}",
        "Content-Type": "application/json",
        "HTTP-Referer": _referer,
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
        "max_tokens": 4096,
        "temperature": 0.7,
    }

    async with httpx.AsyncClient(timeout=120.0) as client:
        response = await client.post(
            "https://openrouter.ai/api/v1/chat/completions",
            headers=headers,
            json=payload,
        )

    if response.status_code != 200:
        return {
            "success": False,
            "error": f"OpenRouter API 오류 ({response.status_code}): {response.text}",
        }

    result_json = response.json()
    result_text = result_json["choices"][0]["message"]["content"].strip()
    return {"success": True, "result": result_text}
