from google import genai
from google.genai import types
import json
import re


def build_analysis_prompt(
    title: str,
    channel: str,
    description: str,
    transcript: str,
    transcript_lang: str,
    duration_str: str,
    view_count_str: str,
) -> str:
    """분석을 위한 마스터 프롬프트를 생성합니다."""

    content_section = f"""
## 유튜브 영상 정보
- **제목**: {title}
- **채널**: {channel}
- **영상 길이**: {duration_str}
- **조회수**: {view_count_str}
- **자막 언어**: {transcript_lang}

## 영상 설명
{description if description else '(설명 없음)'}

## 영상 자막/내용
{transcript if transcript else '(자막을 가져올 수 없습니다. 제목과 설명을 바탕으로 분석해 주세요.)'}
"""

    prompt = f"""당신은 유튜브 영상을 분석하는 전문 비즈니스 컨설턴트이자 콘텐츠 분석가입니다.
아래 유튜브 영상의 내용을 분석하여 5가지 항목으로 상세히 답변해 주세요.
**모든 답변은 반드시 한국어로 작성하세요.**

{content_section}

---

다음 5가지 항목을 각각 분석하여 JSON 형식으로 답변하세요.

## 출력 형식 (JSON)
```json
{{
  "summary": {{
    "title": "핵심 내용 요약",
    "points": ["핵심 포인트 1", "핵심 포인트 2", "핵심 포인트 3", "핵심 포인트 4", "핵심 포인트 5"],
    "keywords": ["키워드1", "키워드2", "키워드3", "키워드4", "키워드5"],
    "one_line": "한 줄 핵심 요약"
  }},
  "implementation": {{
    "title": "실행 방법",
    "overview": "전체적인 실행 방향",
    "steps": [
      {{"step": 1, "title": "단계 제목", "description": "상세 설명", "tips": "실용적 팁"}},
      {{"step": 2, "title": "단계 제목", "description": "상세 설명", "tips": "실용적 팁"}},
      {{"step": 3, "title": "단계 제목", "description": "상세 설명", "tips": "실용적 팁"}}
    ],
    "requirements": ["필요한 것 1", "필요한 것 2", "필요한 것 3"],
    "timeline": "예상 기간/일정"
  }},
  "applications": {{
    "title": "응용 분야",
    "industries": [
      {{"name": "산업/분야명", "use_case": "활용 방법", "potential": "높음"}},
      {{"name": "산업/분야명", "use_case": "활용 방법", "potential": "중간"}},
      {{"name": "산업/분야명", "use_case": "활용 방법", "potential": "높음"}}
    ],
    "target_users": ["대상 사용자 1", "대상 사용자 2", "대상 사용자 3"],
    "trend_connection": "현재 트렌드와의 연관성"
  }},
  "business_plan": {{
    "title": "사업 기획",
    "concept": "사업 컨셉 한 줄 설명",
    "value_proposition": "핵심 가치 제안",
    "target_market": "목표 시장",
    "revenue_model": ["수익 모델 1", "수익 모델 2", "수익 모델 3"],
    "key_activities": ["핵심 활동 1", "핵심 활동 2", "핵심 활동 3"],
    "initial_investment": "초기 투자 예상 규모",
    "go_to_market": "시장 진입 전략"
  }},
  "critical_analysis": {{
    "title": "냉철한 사업 분석",
    "overall_score": 75,
    "verdict": "전반적 평가 한 줄",
    "strengths": ["강점 1", "강점 2", "강점 3"],
    "weaknesses": ["약점 1", "약점 2", "약점 3"],
    "opportunities": ["기회 1", "기회 2", "기회 3"],
    "threats": ["위협 1", "위협 2", "위협 3"],
    "competition": "경쟁 환경 분석",
    "profitability": "수익성 현실적 평가",
    "risks": [
      {{"risk": "리스크명", "severity": "높음", "mitigation": "대응 방법"}},
      {{"risk": "리스크명", "severity": "중간", "mitigation": "대응 방법"}}
    ],
    "recommendation": "최종 투자/실행 권고사항"
  }}
}}
```

JSON만 출력하세요. 마크다운 코드블록 없이 순수 JSON만 반환하세요.
"""
    return prompt


async def analyze_with_gemini(
    api_key: str,
    title: str,
    channel: str,
    description: str,
    transcript: str,
    transcript_lang: str,
    duration_str: str,
    view_count_str: str,
) -> dict:
    """Gemini AI로 영상을 분석합니다 (google-genai SDK 사용)."""

    client = genai.Client(api_key=api_key)

    prompt = build_analysis_prompt(
        title=title,
        channel=channel,
        description=description,
        transcript=transcript,
        transcript_lang=transcript_lang,
        duration_str=duration_str,
        view_count_str=view_count_str,
    )

    response = client.models.generate_content(
        model="gemini-2.0-flash",
        contents=prompt,
        config=types.GenerateContentConfig(
            temperature=0.7,
            max_output_tokens=8192,
        ),
    )

    raw_text = response.text.strip()

    # 코드블록 제거 시도
    json_match = re.search(r'```(?:json)?\s*([\s\S]*?)\s*```', raw_text)
    if json_match:
        raw_text = json_match.group(1)

    # 중괄호로 시작하는 부분 추출
    brace_match = re.search(r'\{[\s\S]*\}', raw_text)
    if brace_match:
        raw_text = brace_match.group(0)

    try:
        result = json.loads(raw_text)
        return {"success": True, "data": result}
    except json.JSONDecodeError as e:
        return {
            "success": False,
            "error": f"JSON 파싱 오류: {str(e)}",
            "raw": raw_text[:500],
        }
