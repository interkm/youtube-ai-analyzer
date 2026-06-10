import os
import json
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse
from pydantic import BaseModel
from dotenv import load_dotenv
from typing import Optional

from youtube_service import (
    extract_video_id,
    get_video_metadata,
    get_transcript,
    get_transcript_with_timestamps,
    format_duration,
    format_number,
)
from gemini_service import analyze_with_gemini, generate_transformation
from openrouter_service import (
    analyze_with_openrouter,
    OPENROUTER_MODELS,
    DEFAULT_MODEL,
    generate_transformation_with_openrouter,
)

load_dotenv()

app = FastAPI(title="유튜브 분석 API", version="2.1.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


class AnalyzeRequest(BaseModel):
    url: str
    api_key: Optional[str] = None
    api_provider: Optional[str] = "gemini"   # "gemini" | "openrouter"
    model: Optional[str] = None              # OpenRouter 모델명 (선택)
    analysis_mode: Optional[str] = "summary"  # 분석 모드 추가


class VideoInfoRequest(BaseModel):
    url: str


class SaveObsidianRequest(BaseModel):
    vault_path: str
    file_name: str
    content: str


class TransformRequest(BaseModel):
    title: str
    channel: str
    analysis_data: dict
    transcript: str
    transform_type: str
    api_key: Optional[str] = None
    api_provider: Optional[str] = "gemini"
    model: Optional[str] = None


@app.get("/")
def root():
    return {"status": "ok", "message": "유튜브 분석 API v2.1이 실행 중입니다.", "version": "2.1.0"}


@app.get("/api/models")
def get_models():
    """사용 가능한 OpenRouter 모델 목록을 반환합니다."""
    return {
        "openrouter_models": OPENROUTER_MODELS,
        "default_model": DEFAULT_MODEL,
    }


@app.post("/api/video-info")
async def get_video_info(req: VideoInfoRequest):
    """영상 메타데이터만 빠르게 가져옵니다."""
    video_id = extract_video_id(req.url)
    if not video_id:
        raise HTTPException(status_code=400, detail="유효하지 않은 유튜브 URL입니다.")

    metadata = get_video_metadata(video_id)
    return {
        "video_id": video_id,
        "url": f"https://www.youtube.com/watch?v={video_id}",
        **metadata,
        "duration_str": format_duration(metadata.get("duration", 0)),
        "view_count_str": format_number(metadata.get("view_count", 0)),
        "like_count_str": format_number(metadata.get("like_count", 0)),
    }


@app.post("/api/analyze")
async def analyze_video(req: AnalyzeRequest):
    """유튜브 영상을 전체 분석합니다. (Gemini 또는 OpenRouter 선택 가능)"""

    provider = (req.api_provider or "gemini").lower()
    mode = req.analysis_mode or "summary"

    # API 키 확인
    if provider == "openrouter":
        api_key = req.api_key or os.getenv("OPENROUTER_API_KEY", "")
        if not api_key:
            raise HTTPException(
                status_code=400,
                detail="OpenRouter API 키가 필요합니다. 설정에서 API 키를 입력해 주세요."
            )
    else:
        # 기본: Gemini
        api_key = req.api_key or os.getenv("GEMINI_API_KEY", "")
        if not api_key or api_key == "your_gemini_api_key_here":
            raise HTTPException(
                status_code=400,
                detail="Gemini API 키가 필요합니다. 설정에서 API 키를 입력해 주세요."
            )

    # Video ID 추출
    video_id = extract_video_id(req.url)
    if not video_id:
        raise HTTPException(status_code=400, detail="유효하지 않은 유튜브 URL입니다.")

    # 메타데이터 가져오기
    metadata = get_video_metadata(video_id)
    duration_str = format_duration(metadata.get("duration", 0))
    view_count_str = format_number(metadata.get("view_count", 0))

    # 자막 가져오기 (AI 분석용 텍스트 + 대본 전체용 타임스탬프)
    transcript, transcript_lang = get_transcript(video_id)
    transcript_entries, _ = get_transcript_with_timestamps(video_id)

    common_args = dict(
        api_key=api_key,
        title=metadata.get("title", ""),
        channel=metadata.get("channel", ""),
        description=metadata.get("description", ""),
        transcript=transcript,
        transcript_lang=transcript_lang,
        duration_str=duration_str,
        view_count_str=view_count_str,
        analysis_mode=mode,
    )

    # AI 분석 실행
    if provider == "openrouter":
        model = req.model or DEFAULT_MODEL
        analysis_result = await analyze_with_openrouter(**common_args, model=model)
    else:
        analysis_result = await analyze_with_gemini(**common_args)

    if not analysis_result["success"]:
        raise HTTPException(
            status_code=500,
            detail=f"AI 분석 실패: {analysis_result.get('error', '알 수 없는 오류')}"
        )

    # 모델명 가공
    model_name = provider == "openrouter" and (req.model or DEFAULT_MODEL) or "gemini-2.0-flash"

    return {
        "video_id": video_id,
        "url": f"https://www.youtube.com/watch?v={video_id}",
        "provider": provider,
        "model_used": model_name,
        "metadata": {
            **metadata,
            "duration_str": duration_str,
            "view_count_str": view_count_str,
            "like_count_str": format_number(metadata.get("like_count", 0)),
        },
        "transcript_info": {
            "available": bool(transcript),
            "language": transcript_lang,
            "length": len(transcript),
        },
        "transcript_entries": transcript_entries,
        "analysis": analysis_result["data"],
    }


@app.post("/api/save-obsidian")
async def save_obsidian(req: SaveObsidianRequest):
    """사용자가 입력한 로컬 경로에 Obsidian 마크다운 파일을 저장합니다 (로컬 작동용)."""
    try:
        # 디렉토리가 없으면 생성 시도
        normalized_path = os.path.abspath(req.vault_path)
        if not os.path.exists(normalized_path):
            os.makedirs(normalized_path, exist_ok=True)

        # 특수문자나 파일명 정규화
        safe_file_name = req.file_name
        for char in ['\\', '/', ':', '*', '?', '"', '<', '>', '|']:
            safe_file_name = safe_file_name.replace(char, '_')

        file_path = os.path.join(normalized_path, safe_file_name)
        with open(file_path, "w", encoding="utf-8") as f:
            f.write(req.content)

        return {
            "success": True,
            "message": f"Obsidian 파일이 성공적으로 저장되었습니다: {file_path}",
            "file_path": file_path
        }
    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail=f"Obsidian 파일 저장에 실패했습니다: {str(e)}"
        )


@app.post("/api/transform")
async def transform_content(req: TransformRequest):
    """자막 및 1차 분석데이터를 기반으로 4종(적용안/블로그/랜딩/Hermes) 전문 문서로 변환합니다."""
    provider = (req.api_provider or "gemini").lower()

    if provider == "openrouter":
        api_key = req.api_key or os.getenv("OPENROUTER_API_KEY", "")
        if not api_key:
            raise HTTPException(status_code=400, detail="OpenRouter API 키가 필요합니다.")
        model = req.model or DEFAULT_MODEL
        res = await generate_transformation_with_openrouter(
            api_key=api_key,
            title=req.title,
            channel=req.channel,
            analysis_data=req.analysis_data,
            transcript=req.transcript,
            transform_type=req.transform_type,
            model=model
        )
    else:
        api_key = req.api_key or os.getenv("GEMINI_API_KEY", "")
        if not api_key or api_key == "your_gemini_api_key_here":
            raise HTTPException(status_code=400, detail="Gemini API 키가 필요합니다.")
        res = await generate_transformation(
            api_key=api_key,
            title=req.title,
            channel=req.channel,
            analysis_data=req.analysis_data,
            transcript=req.transcript,
            transform_type=req.transform_type
        )

    if not res["success"]:
        raise HTTPException(
            status_code=500,
            detail=f"변환 생성 실패: {res.get('error', '알 수 없는 오류')}"
        )

    return {"success": True, "result": res["result"]}


# ── React 프론트엔드 정적 파일 서빙 (Railway 배포용) ─────────────────────
FRONTEND_DIST = os.path.join(os.path.dirname(__file__), "frontend_dist")

if os.path.exists(FRONTEND_DIST):
    # /assets 경로: JS·CSS·이미지 등 번들 파일
    assets_dir = os.path.join(FRONTEND_DIST, "assets")
    if os.path.exists(assets_dir):
        app.mount("/assets", StaticFiles(directory=assets_dir), name="assets")

    @app.get("/{full_path:path}", include_in_schema=False)
    async def serve_spa(full_path: str):
        """SPA catch-all: 정적 파일이 있으면 반환, 없으면 index.html 반환."""
        file_path = os.path.join(FRONTEND_DIST, full_path)
        if os.path.isfile(file_path):
            return FileResponse(file_path)
        return FileResponse(os.path.join(FRONTEND_DIST, "index.html"))


if __name__ == "__main__":
    import uvicorn
    uvicorn.run("main:app", host="0.0.0.0", port=8001, reload=True)
