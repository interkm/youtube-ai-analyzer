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
from gemini_service import analyze_with_gemini
from openrouter_service import analyze_with_openrouter, OPENROUTER_MODELS, DEFAULT_MODEL

app = FastAPI(title="유튜브 분석 API", version="2.0.0")

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
    api_provider: Optional[str] = "gemini"
    model: Optional[str] = None


class VideoInfoRequest(BaseModel):
    url: str


@app.get("/api")
def root():
    return {"status": "ok", "message": "유튜브 분석 API v2가 실행 중입니다.", "version": "2.0.0"}


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

    if provider == "openrouter":
        api_key = req.api_key or os.getenv("OPENROUTER_API_KEY", "")
        if not api_key:
            raise HTTPException(
                status_code=400,
                detail="OpenRouter API 키가 필요합니다."
            )
    else:
        api_key = req.api_key or os.getenv("GEMINI_API_KEY", "")
        if not api_key or api_key == "your_gemini_api_key_here":
            raise HTTPException(
                status_code=400,
                detail="Gemini API 키가 필요합니다."
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

    return {
        "video_id": video_id,
        "url": f"https://www.youtube.com/watch?v={video_id}",
        "provider": provider,
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


# Vercel 핸들러
from mangum import Mangum
handler = Mangum(app, lifespan="off")
