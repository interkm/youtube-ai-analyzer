import json
import re
from google import genai
from google.genai import types

MODE_DESCRIPTIONS = {
    "summary": "유튜브 영상의 핵심 내용을 균형 있게 요약하고 주요 인사이트를 도출하는 일반 요약 모드입니다.",
    "action": "실행 중심 모드입니다. 당장 실행 가능한 현실적인 마일스톤, 구체적인 마일스톤별 작업 계획과 필요한 도구 위주로 분석하세요.",
    "business": "사업화 중심 모드입니다. 영상 내용의 핵심 가치를 발굴하여 비즈니스화할 수 있는 모델, 수익 구조 및 가치 제안에 초점을 맞추어 분석하세요.",
    "saas_idea": "SaaS 아이디어 중심 모드입니다. 영상 내용을 소프트웨어 서비스(SaaS)나 웹/앱 서비스 비즈니스로 전환하여 구현 가능한 소프트웨어 아이디어를 중심으로 분석하세요.",
    "content_biz": "콘텐츠 사업 중심 모드입니다. 영상 내용을 기반으로 유튜브/쇼츠, 뉴스레터, 지식 상품, 커뮤니티 등으로 가공 및 판매할 수 있는 미디어/콘텐츠 비즈니스 전략 위주로 분석하세요.",
    "auto_agency": "자동화 대행 중심 모드입니다. 단순 반복 업무나 비즈니스 프로세스 중 AI와 API 연동 등을 통해 자동화할 수 있는 영역을 찾아내어 이를 대행해주는 서비스 관점으로 분석하세요.",
    "investor": "냉철한 투자자 관점 모드입니다. 영상에서 제안하는 사업성이나 아이디어의 거품을 걷어내고, 시장 포화도, 높은 리스크, 비용 회수 장벽, 실행의 현실적 난이도를 극도로 차갑고 보수적으로 분석하세요.",
    "solo_startup": "1인 창업 관점 모드입니다. 막대한 팀 빌딩이나 대규모 자본 없이, 창업자 1인이 기동성을 가지고 바로 시작할 수 있는 저비용 고효율 1인 비즈니스 모델 위주로 분석하세요.",
    "skeptical_filter": "냉철한 폐기/선별 관점 모드입니다. 실현 불가능하거나 시간 낭비가 될 아이디어를 명확하게 폐기하고, 오직 현실적으로 생존 가능성이 높은 아이디어만 가차 없이 걸러내어 분석하세요."
}

def build_analysis_prompt(
    title: str,
    channel: str,
    description: str,
    transcript: str,
    transcript_lang: str,
    duration_str: str,
    view_count_str: str,
    analysis_mode: str = "summary",
) -> str:
    """분석을 위한 마스터 프롬프트를 생성합니다."""

    mode_description = MODE_DESCRIPTIONS.get(analysis_mode, MODE_DESCRIPTIONS["summary"])

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

    prompt = f"""당신은 유튜브 영상을 분석하여 가장 실현 가능한 사업 아이디어를 발굴하고 실천 전략을 설계하는 전문 비즈니스 컨설턴트이자 냉철한 엔젤 투자자입니다.
아래 유튜브 영상의 내용을 분석하여 주어진 JSON 구조에 맞추어 상세히 답변해 주세요.
**모든 답변은 반드시 한국어로 작성하세요.**
자연스럽게 필요한 경우 Obsidian 내부 링크 형식(예: [[사업 아이디어]], [[수익 모델]], [[MVP 테스트]])을 답변에 섞어서 사용해 주십시오.

## 현재 분석 모드
{mode_description}

{content_section}

---

## 출력 형식 (JSON)
반드시 다음 JSON 구조를 유지해야 합니다. 어떠한 다른 텍스트도 섞지 말고 순수한 JSON만 반환하세요:

```json
{{
  "summary_box": {{
    "one_line": "한 줄 결론 (명확하고 바로 와닿는 한 줄 핵심 요약)",
    "opportunity_score": 85,
    "recommendation_grade": "A",
    "solo_possible": "가능/불가능 중 선택",
    "mvp_possible": "3일 이내 가능 / 1주일 이내 가능 / 불가능 중 선택",
    "revenue_model": "예상 수익모델 리스트 (예: 자동화 대행 / 구독형 리포트 / 컨설팅 등)",
    "first_action": "가장 먼저 실행해야 하는 핵심 액션 1가지 (예: 관련 영상 10개 수집 및 댓글 30개 분석)"
  }},
  "summary": {{
    "one_line": "한 줄 결론 (위 summary_box와 동일한 내용)",
    "keywords": ["핵심키워드1", "핵심키워드2", "핵심키워드3", "핵심키워드4", "핵심키워드5"],
    "points": [
      "핵심 포인트 1 (영상 내용의 중요 키포인트)",
      "핵심 포인트 2",
      "핵심 포인트 3",
      "핵심 포인트 4",
      "핵심 포인트 5"
    ],
    "major_change": "이 영상에서 말하는 가장 중요한 거시적/기술적/시장적 변화",
    "target_audience": "이 영상을 반드시 봐야 하는 사람들의 페르소나 및 대상군",
    "practical_takeaway": "영상에서 실질적으로 바로 가져가서 써먹을 수 있는 구체적인 개념이나 정보"
  }},
  "checklist": {{
    "today": [
      {{
        "task": "오늘 할 일: 구체적인 행동 단위 작업 (예: '시장조사' 같은 추상적 문장 금지. '동일 주제 상위 유튜브 영상 10개 댓글 수집 후 불만 30개 추출'과 같이 작성)",
        "time": "소요시간 (예: 2시간)",
        "tools": "필요한 도구 (예: 유튜브, 메모장, 스프레드시트)",
        "difficulty": "하",
        "priority": "상"
      }}
    ],
    "this_week": [
      {{
        "task": "이번 주 할 일: 구체적인 행동 단위 작업 (예: '구글폼으로 랜딩페이지 1장 제작 후 사전 예약자 모으기')",
        "time": "소요시간 (예: 5시간)",
        "tools": "필요한 도구 (예: Notion, Tally, Google Forms)",
        "difficulty": "중",
        "priority": "중"
      }}
    ],
    "thirty_days": [
      {{
        "task": "30일 안에 할 일: 구체적인 행동 단위 작업 (예: '10명의 첫 사전 예약 고객에게 이메일로 베타 서비스 안내 발송')",
        "time": "소요시간 (예: 3일)",
        "tools": "필요한 도구 (예: Gmail, Stibee)",
        "difficulty": "상",
        "priority": "하"
      }}
    ]
  }},
  "business_app": [
    {{
      "category": "선택된 카테고리 (영상 내용에 맞는 것만 콘텐츠 사업 / 교육/강의 사업 / SaaS/웹서비스 / 자동화 대행 / 컨설팅 / B2B 솔루션 / 커뮤니티 사업 / 데이터/리서치 사업 / 커머스/제휴 사업 / 내부 생산성 개선 / 에이전시 서비스 / 구독형 서비스 / 로컬 비즈니스 / 프리랜서 서비스 / 생산성 도구 / 리서치/정보 상품 중에서 3~5개만 선택하여 각각 항목 생성)",
      "points": "적용 포인트 (영상의 핵심 지식을 이 카테고리에 어떻게 대입할 수 있는지 설명)",
      "target_customer": "타깃 고객 (이 비즈니스를 누구에게 팔 것인가)",
      "customer_problem": "고객의 문제 (그들이 겪고 있는 페인 포인트)",
      "product_service": "제공할 수 있는 서비스/제품 (어떤 형태로 판매할 것인가)",
      "execution_method": "바로 실행할 수 있는 방법 (최소 리소스로 시작하는 구체적 방법)",
      "required_tools": "필요한 도구 (구동에 필수적인 노코드 툴, API 등)",
      "revenue_method": "예상 수익화 방식 (구독, 건당 수수료, 패키지 판매 등)",
      "priority": "상/중/하 중 선택"
    }}
  ],
  "business_ideas": [
    {{
      "name": "아이디어명 (영상에서 파생 가능한 구체적인 사업 아이디어, 반드시 5개 이상 제안해야 함)",
      "one_line": "한 줄 설명",
      "problem_solved": "고객 문제 (어떤 불만을 해결하는가)",
      "target_customer": "타깃 고객",
      "product_service": "제공 서비스/제품",
      "revenue_model": "수익모델 (구독형 요금제, 일회성 판매 등)",
      "initial_steps": "초기 실행 방법 (처음 1, 2단계)",
      "required_resources": "필요한 자원 (돈, 시간, 툴 등)",
      "automation_potential": "자동화 가능성 (높음/보통/낮음 등 사유 포함)",
      "solo_possible": "1인 실행 가능 여부 (가능/불가능 및 팁)",
      "difficulty": "예상 난이도 (상/중/하)",
      "profitability": "예상 수익성 (높음/보통/낮음)",
      "speed_to_market": "시장 진입 속도 (빠름/보통/느림)",
      "recommended": "최종 추천 여부 (추천/보류/비추천)"
    }}
  ],
  "business_analysis": {{
    "marketability": 85,
    "feasibility": 70,
    "profitability": 75,
    "scalability": 80,
    "automation_potential": 90,
    "risk": "낮음/중간/높음 중 선택",
    "priority": "S/A/B/C/D 중 최종 추천 등급 선택",
    "reasoning": "최종 등급 판정 사유 및 설명"
  }},
  "critical_analysis": {{
    "why_profitable": "이 아이디어가 돈이 되는 구체적인 이유",
    "why_not_profitable": "돈이 안 될 수도 있는 현실적인 가능성 및 위험 요소",
    "payment_point": "고객이 실제로 자신의 지갑에서 돈을 꺼내 지불할 핵심 소구점",
    "failure_point": "이 비즈니스가 실패할 가능성이 가장 높은 치명적인 아킬레스건",
    "competitor_threat": "경쟁자가 생겼을 때 쉽게 복사하거나 따라오기 쉬운 부분과 진입장벽의 한계",
    "minimum_version": "대형 인프라 없이 창업자 혼자서 시작할 수 있는 가장 작고 원시적인 최초 버전(MVP)",
    "first_customer": "지인 영업이 아닌 실제 첫 유료 고객을 모집하고 결제하게 만드는 방법",
    "validation_7days": "단 7일 동안 최소 비용으로 이 시장의 수요를 직접 검증하는 초고속 검증 시나리오",
    "discard_ideas": "영상의 아이디어 중 시간 낭비이므로 과감하게 버려야 할 부류/컨셉 제안",
    "save_ideas": "리스크가 있더라도 반드시 안고 가며 집중해야 할 핵심 생존 아이디어"
  }}
}}
```

## 주의사항:
- `business_ideas` 목록은 반드시 5개 이상으로 가득 채워주십시오.
- 점수, 난이도, 예상 수익성, 리스크 등은 사실적이고 차갑게 작성하십시오. 과장이 섞여 있거나 허무맹랑한 분석은 절대 피하십시오.
- JSON만 출력하세요. 마크다운 코드블록 없이 순수 JSON만 반환하세요.
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
    analysis_mode: str = "summary",
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
        analysis_mode=analysis_mode,
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
            "raw": raw_text[:800],
        }

async def generate_transformation(
    api_key: str,
    title: str,
    channel: str,
    analysis_data: dict,
    transcript: str,
    transform_type: str,
) -> dict:
    """기존 분석 데이터 및 자막을 활용하여 심층 비즈니스 문서로 변환합니다."""
    client = genai.Client(api_key=api_key)

    type_prompts = {
        "biz_app_guide": f"""당신은 신규 비즈니스 확장 및 운영전략 전문가입니다.
다음 유튜브 분석 데이터와 영상 내용을 바탕으로, **'기존 사업에 접목 및 적용하기 위한 구체적 실행 가이드 및 로드맵'**을 작성하세요.

[유튜브 영상 제목] {title} (채널: {channel})
[핵심 분석 요약]
{json.dumps(analysis_data.get('summary', {}), ensure_ascii=False, indent=2)}

## 요구사항:
1. 기존 비즈니스에 해당 아이디어나 개념을 접목하는 구체적인 단계를 제안해 주세요.
2. 창업가 또는 소규모 조직이 즉각 실행할 수 있는 실천 지침을 도출해 주세요.
3. 영상 지식을 실제 수익화로 전환하기 위해 필수적인 단기(1~2주) 실행 전략을 포함하세요.
4. 구체적인 주간 실행 일정과 예상 장애물 대응안을 작성하세요.
5. 이모지 없이 진중하고 차분한 한국어 마크다운 형식으로 보기 좋게 정리해서 반환하세요.""",

        "mvp_execution_plan": f"""당신은 린 스타트업 코치이자 MVP(Minimum Viable Product) 빌더입니다.
다음 유튜브 내용과 사업 요약을 바탕으로, **'7일 이내에 실제 시장의 반응을 검증할 수 있는 초단기 MVP 실행계획서'**를 작성하세요.

[유튜브 영상 제목] {title}
[핵심 분석 요약]
{json.dumps(analysis_data.get('summary', {}), ensure_ascii=False, indent=2)}

## 요구사항:
1. 검증할 핵심 가설 한 가지를 명확히 정의하십시오.
2. 3일 이내에 제작 가능한 초소형 제품/서비스 정의 (예: 구글폼 신청서, 랜딩페이지 1장 등).
3. 개발 없이 핵심 서비스를 수동으로 제공하는 방식(오즈의 마법사 방식 등)을 구체화하십시오.
4. 첫 유료 고객 10명을 확보하기 위한 모객 및 세일즈 시나리오.
5. 7일차에 달성해야 할 성공 기준(Metric) 및 검증 실패 시 피벗(Pivot) 방향.
6. 이모지 없이 명확하고 실천적인 마크다운 형식으로 작성하세요.""",

        "investor_analysis": f"""당신은 벤처캐피탈(VC)의 냉철한 심사역이자 리스크 분석가입니다.
다음 유튜브의 비즈니스 컨셉을 투자자 관점에서 철저하게 해부하여 **'비즈니스 리스크 진단 및 투자 심사 보고서'**를 작성하세요.

[유튜브 영상 제목] {title}
[핵심 분석 요약]
{json.dumps(analysis_data.get('summary', {}), ensure_ascii=False, indent=2)}

## 요구사항:
1. 이 비즈니스가 겉보기와 달리 실제로 돈이 되지 않을 근본적인 이유 3가지.
2. 초기 진입장벽의 한계와 대기업 또는 자본가들이 쉽게 카피할 수 있는 부분 분석.
3. 규제, 기술적 한계, 고객 이탈률 등 치명적인 리스크 요소 진단.
4. 시장 포화도와 현실적인 수익성 및 확장성 한계 분석.
5. 그럼에도 불구하고 투자 가치가 있는 핵심 생존 조건 제시.
6. 이모지를 제거하고 차갑고 정량적인 마크다운 보고서 형식으로 작성하십시오.""",

        "content_ideas": f"""당신은 전문 미디어 콘텐츠 디렉터이자 마케터입니다.
다음 유튜브 분석 내용을 재가공하여, 잠재고객을 끌어들이기 위한 **'멀티채널 콘텐츠 제작 기획 및 숏폼/텍스트 스크립트 시나리오'**를 작성하세요.

[유튜브 영상 제목] {title} (채널: {channel})
[핵심 분석 요약]
{json.dumps(analysis_data.get('summary', {}), ensure_ascii=False, indent=2)}

## 요구사항:
1. 유튜브 쇼츠/인스타 릴스/틱톡용 숏폼 기획안 3개 (각 기획안별 후킹 멘트, 연출 방향, 핵심 자막 스크립트).
2. 뉴스레터 또는 블로그 포스팅용 롱폼 콘텐츠 개요 및 매력적인 서론 예시.
3. 카드뉴스 제작을 위한 5페이지 슬라이드별 타이틀 및 텍스트 구성안.
4. 타깃 고객의 클릭을 유도하는 제목/카피라이팅 후보 5개.
5. 이모지 없이 차분하고 실용적인 한국어 마크다운 형식으로 정리하십시오.""",

        "auto_potential": f"""당신은 비즈니스 자동화 전문가이자 노코드 아키텍트입니다.
다음 유튜브의 사업 아이디어를 운영하는 데 들어가는 리소스를 최소화하기 위한 **'비즈니스 프로세스 자동화(RPA) 및 아키텍처 설계서'**를 작성하세요.

[유튜브 영상 제목] {title}
[핵심 분석 요약]
{json.dumps(analysis_data.get('summary', {}), ensure_ascii=False, indent=2)}

## 요구사항:
1. 비즈니스 운영 단계 중 AI와 자동화 도구가 즉각 대신할 수 있는 반복 업무 영역 정의.
2. 추천 자동화 도구 조합 (예: Make.com, Zapier, Webhook, Airtable 등)과 데이터 흐름도 설계.
3. AI API(OpenAI, Gemini 등)를 연동하여 자동으로 데이터를 요약/분류/답장하는 프롬프트 및 로직 기획.
4. 자동화 구축 시 발생할 수 있는 오류 처리 및 인간의 최종 검토 프로세스 결합 방안.
5. 예상되는 리소스 절감 효과 및 구축 난이도/소요 시간 추정.
6. 이모지 없이 완벽히 구조화된 기술 마크다운 형식으로 작성하십시오.""",

        "blog_post": f"""당신은 전문 검색엔진 최적화(SEO) 마케터이자 테크/비즈니스 에디터입니다.
다음 유튜브 분석 데이터를 바탕으로 블로그 등에 당장 게재할 수 있는 **'완성도 높은 비즈니스 블로그 포스팅'**을 작성하세요.

[유튜브 영상 제목] {title} (채널: {channel})
[핵심 분석 요약]
{json.dumps(analysis_data.get('summary', {}), ensure_ascii=False, indent=2)}

## 요구사항:
1. 독자의 흥미를 유발하는 매력적인 서론을 구성하세요.
2. 본론은 3개 단락 이상으로 나누어, 영상이 다룬 핵심 기술/개념과 비즈니스 인사이트를 명확하게 설명해 주세요. (가독성이 뛰어난 서브 타이틀 및 불릿 포인트를 활용)
3. 결론에는 독자가 행동을 개시하도록 유도하는 CTA(Call to Action)를 깔끔하게 제시하세요.
4. 검색 노출에 최적화될 수 있도록 핵심 키워드들을 글 속에 자연스럽게 포함하세요.
5. 이모지 없이 깔끔하고 가독성 높은 한국어 마크다운 형식으로 반환하세요.""",

        "landing_page": f"""당신은 수십억 원의 매출을 만든 전문 카피라이터이자 UX 기획자입니다.
다음 유튜브 분석 내용을 비즈니스화하여 홍보하기 위한 **'고전환율 랜딩페이지 상세 기획안 및 카피라이팅'**을 작성하세요.

[유튜브 영상 제목] {title} (채널: {channel})
[핵심 요약]
{json.dumps(analysis_data.get('summary', {}), ensure_ascii=False, indent=2)}
[사업 아이디어 예시]
{json.dumps(analysis_data.get('business_ideas', [{{}}])[0], ensure_ascii=False, indent=2)}

## 요구사항:
1. **메인 헤드라인 및 서브 카피**: 방문자의 시선을 3초 안에 사로잡을 강렬한 카피라이팅.
2. **고객의 Pain Point 자극**: 고객이 현재 겪는 고통과 비효율 지적.
3. **해결책 제시 및 핵심 가치 제안(Value Proposition)**: 이 비즈니스가 어떻게 고통을 해결하는가.
4. **특장점(Features & Benefits) 3~4가지**: 핵심 혜택을 혜택 중심으로 설명.
5. **고객 사회적 증거(Social Proof) 가이드**: 임의의 신뢰도를 높여주는 후기/사례 프레임 기획.
6. **강력한 CTA(Call to Action) 버튼 카피 및 신청서 폼 구조**: 고객이 지금 당장 클릭해야 하는 이유.
7. 이모지 없이 차분하고 구조적인 한국어 마크다운 형식으로 작성하세요.""",

        "hermes_brief": f"""당신은 AI 에이전트 시스템 설계자이자 솔루션 아키텍트입니다.
다음 유튜브의 핵심 요약 및 사업 적용 기획을 실행하기 위한 **'범용 AI 에이전트 전용 작업지시서'**를 작성하세요.

[유튜브 영상 제목] {title}
[내 사업 적용 기획]
{json.dumps(analysis_data.get('business_app', [{}]), ensure_ascii=False, indent=2)}

## 요구사항:
1. **에이전트 역할정의 (System Prompt)**: 에이전트가 어떤 정체성으로 작동해야 하는지.
2. **입력 데이터 형식 및 구조 (Input Specs)**: 크롤링 DB, 텍스트 데이터 등 수신 데이터 구조.
3. **태스크 처리 단계 (Step-by-Step Processing Logic)**: 에이전트가 순차적으로 처리해야 할 비즈니스 로직.
4. **출력 요구사항 (Output Specs)**: 최종 가공 데이터, 블로그 원고, 메일 템플릿 등 반환할 최종 형태.
5. **예시 프롬프트 템플릿 (Prompt Template)**: 실제 LLM 호출에 사용될 프롬프트 구문 예시.
6. 이모지를 제거하고 완벽하게 기계적으로 실행 가능한 고정밀 한국어 마크다운 명세서 형식으로 작성해 주십시오."""
    }

    prompt = type_prompts.get(transform_type, type_prompts["blog_post"])

    response = client.models.generate_content(
        model="gemini-2.0-flash",
        contents=prompt,
        config=types.GenerateContentConfig(
            temperature=0.7,
            max_output_tokens=8192,
        ),
    )

    return {"success": True, "result": response.text.strip()}
