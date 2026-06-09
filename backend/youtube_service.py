import re
import yt_dlp
from youtube_transcript_api import YouTubeTranscriptApi
from youtube_transcript_api._errors import TranscriptsDisabled, NoTranscriptFound


def extract_video_id(url: str) -> str | None:
    """유튜브 URL에서 video ID를 추출합니다."""
    patterns = [
        r'(?:youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/embed\/|youtube\.com\/v\/|youtube\.com\/shorts\/)([a-zA-Z0-9_-]{11})',
        r'v=([a-zA-Z0-9_-]{11})',
    ]
    for pattern in patterns:
        match = re.search(pattern, url)
        if match:
            return match.group(1)
    return None


def get_video_metadata(video_id: str) -> dict:
    """yt-dlp를 사용하여 영상 메타데이터를 가져옵니다."""
    url = f"https://www.youtube.com/watch?v={video_id}"
    ydl_opts = {
        'quiet': True,
        'no_warnings': True,
        'extract_flat': False,
        'skip_download': True,
    }
    try:
        with yt_dlp.YoutubeDL(ydl_opts) as ydl:
            info = ydl.extract_info(url, download=False)
            return {
                "title": info.get("title", "제목 없음"),
                "channel": info.get("uploader", "알 수 없음"),
                "channel_url": info.get("uploader_url", ""),
                "view_count": info.get("view_count", 0),
                "like_count": info.get("like_count", 0),
                "duration": info.get("duration", 0),
                "upload_date": info.get("upload_date", ""),
                "description": (info.get("description", "") or "")[:2000],
                "thumbnail": info.get("thumbnail", ""),
                "tags": info.get("tags", [])[:10],
            }
    except Exception as e:
        return {
            "title": "메타데이터 로드 실패",
            "channel": "알 수 없음",
            "channel_url": "",
            "view_count": 0,
            "like_count": 0,
            "duration": 0,
            "upload_date": "",
            "description": "",
            "thumbnail": "",
            "tags": [],
            "error": str(e),
        }


def _fetch_transcript_entries(video_id: str) -> tuple[list, str]:
    """
    자막 엔트리 목록과 언어 정보를 반환하는 내부 함수.
    Returns: (entries, language_label)
    """
    priority_languages = ['ko', 'en', 'ko-KR', 'en-US']
    try:
        transcript_list = YouTubeTranscriptApi.list_transcripts(video_id)

        # 수동 자막 우선 시도
        for lang in priority_languages:
            try:
                transcript = transcript_list.find_manually_created_transcript([lang])
                entries = transcript.fetch()
                return entries, f"수동 자막 ({lang})"
            except Exception:
                continue

        # 자동 생성 자막 시도
        for lang in priority_languages:
            try:
                transcript = transcript_list.find_generated_transcript([lang])
                entries = transcript.fetch()
                return entries, f"자동 자막 ({lang})"
            except Exception:
                continue

        # 가능한 첫 번째 자막 사용
        try:
            transcripts = list(transcript_list)
            if transcripts:
                entries = transcripts[0].fetch()
                lang = transcripts[0].language_code
                return entries, f"자막 ({lang})"
        except Exception:
            pass

        return [], "자막 없음"

    except TranscriptsDisabled:
        return [], "자막 비활성화됨"
    except NoTranscriptFound:
        return [], "자막 없음"
    except Exception as e:
        return [], f"오류: {str(e)}"


def get_transcript(video_id: str) -> tuple[str, str]:
    """
    유튜브 자막을 텍스트로 가져옵니다 (AI 분석용, 15000자 제한).
    Returns: (transcript_text, language_used)
    """
    entries, lang_label = _fetch_transcript_entries(video_id)
    if not entries:
        return "", lang_label
    text = " ".join([entry['text'] for entry in entries])
    return text[:15000], lang_label


def get_transcript_with_timestamps(video_id: str) -> tuple[list, str]:
    """
    타임스탬프 포함 자막 데이터를 반환합니다 (대본 전체 탭용).
    Returns: (entries_list, language_used)
    entries_list: [{'start': float, 'duration': float, 'text': str}, ...]
    """
    entries, lang_label = _fetch_transcript_entries(video_id)
    result = [
        {
            'start': round(entry.get('start', 0), 2),
            'duration': round(entry.get('duration', 0), 2),
            'text': entry.get('text', ''),
        }
        for entry in entries
    ]
    return result, lang_label


def format_duration(seconds: int) -> str:
    """초를 시:분:초 형식으로 변환합니다."""
    if not seconds:
        return "알 수 없음"
    hours = seconds // 3600
    minutes = (seconds % 3600) // 60
    secs = seconds % 60
    if hours > 0:
        return f"{hours}시간 {minutes}분 {secs}초"
    elif minutes > 0:
        return f"{minutes}분 {secs}초"
    else:
        return f"{secs}초"


def format_number(num: int) -> str:
    """숫자를 읽기 좋은 형식으로 변환합니다."""
    if not num:
        return "0"
    if num >= 100000000:
        return f"{num / 100000000:.1f}억"
    elif num >= 10000:
        return f"{num / 10000:.1f}만"
    elif num >= 1000:
        return f"{num / 1000:.1f}천"
    return str(num)
