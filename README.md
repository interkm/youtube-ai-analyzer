# 유튜브 AI 분석기 🎬

유튜브 URL 하나로 영상의 **핵심 내용**, **실행 방법**, **응용 분야**, **사업 기획**, **냉철한 사업 분석**을 AI가 자동으로 분석해주는 프로그램입니다.

---

## 🚀 실행 방법

### 1. Gemini API 키 발급
- https://aistudio.google.com/apikey 에서 무료로 발급받으세요.

### 2. 백엔드 설치 및 실행

```powershell
# backend 폴더로 이동
cd backend

# (선택) 가상환경 생성
python -m venv venv
.\venv\Scripts\activate

# 패키지 설치
pip install -r requirements.txt

# API 키 설정 (선택 - UI에서 직접 입력도 가능)
copy .env.example .env
# .env 파일을 열어서 GEMINI_API_KEY=여기에키입력

# 서버 실행
python main.py
```

백엔드가 http://localhost:8000 에서 실행됩니다.

### 3. 프론트엔드 실행

```powershell
# frontend 폴더로 이동
cd frontend

# 패키지 설치 (처음 한 번만)
npm install

# 개발 서버 실행
npm run dev
```

브라우저에서 http://localhost:5173 접속

---

## 📊 분석 항목

| 탭 | 내용 |
|---|---|
| 📋 **핵심 내용** | 영상의 주요 메시지, 키워드, 핵심 포인트 |
| 🛠️ **실행 방법** | 단계별 실행 계획, 필요 준비물, 예상 기간 |
| 🌐 **응용 분야** | 산업별 활용 사례, 주요 타겟, 트렌드 연결 |
| 💡 **사업 기획** | 사업 컨셉, 수익 모델, 시장 진입 전략 |
| 🔍 **냉철한 분석** | SWOT, 리스크, 경쟁 환경, 수익성 평가, 종합 점수 |

---

## 🏗️ 기술 스택

- **Backend**: Python, FastAPI, youtube-transcript-api, yt-dlp, Google Gemini AI
- **Frontend**: Vite, React, TypeScript, Vanilla CSS

---

## ⚠️ 주의사항

- 자막이 비활성화된 영상은 설명과 제목 기반으로 분석됩니다.
- 분석 결과는 Markdown 파일로 내보낼 수 있습니다.
