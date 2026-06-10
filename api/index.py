import os
import sys

# 백엔드 모듈 경로 추가
sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..', 'backend'))

import json
import re
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from typing import Optional

# 백엔드 서비스 임포트
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


@app.get("/api")
def root():
    return {"status": "ok", "message": "유튜브 분석 API v2.1이 실행 중입니다.", "version": "2.1.0"}


@app.get("/api/models")
def get_models():
    return {
        "openrouter_models": OPENROUTER_MODELS,
        "default_model": DEFAULT_MODEL,
    }


@app.post("/api/video-info")
async def get_video_info(req: VideoInfoRequest):
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
        api_key = req.api_key or os.getenv("GEMINI_API_KEY", "")
        if not api_key or api_key == "your_gemini_api_key_here":
            raise HTTPException(
                status_code=400,
                detail="Gemini API 키가 필요합니다. 설정에서 API 키를 입력해 주세요."
            )

    video_id = extract_video_id(req.url)
    if not video_id:
        raise HTTPException(status_code=400, detail="유효하지 않은 유튜브 URL입니다.")

    metadata = get_video_metadata(video_id)
    duration_str = format_duration(metadata.get("duration", 0))
    view_count_str = format_number(metadata.get("view_count", 0))

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
        normalized_path = os.path.abspath(req.vault_path)
        if not os.path.exists(normalized_path):
            os.makedirs(normalized_path, exist_ok=True)

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


# Vercel 핸들러
from mangum import Mangum
handler = Mangum(app, lifespan="off")
