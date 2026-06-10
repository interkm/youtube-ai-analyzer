import { useState, useRef, useEffect } from 'react'
import './index.css'

const STORAGE_KEYS = {
  gemini: 'yt_analyzer_gemini_key',
  openrouter: 'yt_analyzer_openrouter_key',
  obsidianPath: 'yt_analyzer_obsidian_path',
}

const API_BASE = import.meta.env.VITE_API_URL || ''

const OPENROUTER_MODELS: Record<string, string> = {
  'google/gemini-2.5-flash':           'Gemini 2.5 Flash (빠름·추천)',
  'google/gemini-2.5-pro':             'Gemini 2.5 Pro (정확)',
  'google/gemini-3.5-flash':           'Gemini 3.5 Flash (최신)',
  'anthropic/claude-3.5-sonnet':       'Claude 3.5 Sonnet',
  'anthropic/claude-3-haiku':          'Claude 3 Haiku (빠름)',
  'openai/gpt-4o-mini':                'GPT-4o Mini',
  'openai/gpt-4o':                     'GPT-4o',
  'deepseek/deepseek-chat':            'DeepSeek Chat',
  'meta-llama/llama-3-70b-instruct':   'Llama 3 70B',
}

const TABS = [
  { id: 'summary',       label: '핵심 요약' },
  { id: 'checklist',     label: '실행 체크리스트' },
  { id: 'business_app',  label: '내 사업 적용' },
  { id: 'ideas',         label: '사업 아이디어' },
  { id: 'analysis',      label: '사업성 분석' },
  { id: 'obsidian',      label: 'Obsidian 저장' },
  { id: 'raw_data',      label: '원문 데이터' },
]

const ANALYSIS_MODES = [
  { id: 'summary',            label: '일반 요약' },
  { id: 'action',             label: '실행 중심' },
  { id: 'business',           label: '사업화 중심' },
  { id: 'elec_safety',        label: '전기안전관리 적용' },
  { id: 'ai_auto',            label: 'AI 자동화 적용' },
  { id: 'content_pub',        label: '콘텐츠 자동발행 적용' },
  { id: 'investor',           label: '냉철한 투자자 관점' },
  { id: 'kyeongmin_exclusive',label: '김경민 대표 전용 모드' },
]

type LoadingStep = 'idle' | 'fetching-info' | 'analyzing' | 'done'

interface VideoMeta {
  title: string
  channel: string
  thumbnail: string
  view_count_str: string
  like_count_str: string
  duration_str: string
  upload_date: string
  url: string
  tags: string[]
}

interface AnalysisData {
  summary: {
    one_line: string
    keywords: string[]
    points: string[]
  }
  checklist: {
    today: Array<{ task: string; difficulty: string; time: string; tools: string; priority: string }>
    this_week: Array<{ task: string; difficulty: string; time: string; tools: string; priority: string }>
    long_term: Array<{ task: string; difficulty: string; time: string; tools: string; priority: string }>
  }
  business_app: Record<string, string>
  business_ideas: Array<{
    name: string
    one_line: string
    target_customer: string
    problem_solved: string
    revenue_model: string
    initial_steps: string
    required_tech: string
    difficulty: string
    profitability: string
    suitability: string
  }>
  business_analysis: {
    marketability: number
    feasibility: number
    profitability: number
    risk: number
    suitability: number
    priority: string
    reasoning: string
    swot: {
      strengths: string[]
      weaknesses: string[]
      opportunities: string[]
      threats: string[]
    }
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Helper Component: Collapsible Text
// ─────────────────────────────────────────────────────────────────────────────
function CollapsibleText({ text, limit = 150 }: { text: string; limit?: number }) {
  const [isExpanded, setIsExpanded] = useState(false)
  if (!text) return null
  if (text.length <= limit) return <span>{text}</span>

  return (
    <span>
      {isExpanded ? text : `${text.slice(0, limit)}...`}
      <button
        className="collapse-toggle-btn"
        onClick={() => setIsExpanded(!isExpanded)}
        style={{
          background: 'none',
          border: 'none',
          color: 'var(--mint)',
          cursor: 'pointer',
          fontWeight: '600',
          fontSize: '0.8rem',
          marginLeft: '6px',
          padding: '0',
          textDecoration: 'underline',
        }}
      >
        {isExpanded ? '접기' : '더 보기'}
      </button>
    </span>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// Sub-tab Components
// ─────────────────────────────────────────────────────────────────────────────
function SummaryTab({ data }: { data: any }) {
  if (!data) return null
  return (
    <div className="summary-tab-content">
      <h2 className="section-title" style={{ color: 'var(--mint)' }}>핵심 요약</h2>

      {data.one_line && (
        <div className="one-liner-card">
          <div className="one-liner-label">한 줄 결론</div>
          <div className="one-liner-text">"{data.one_line}"</div>
        </div>
      )}

      {data.keywords?.length > 0 && (
        <div className="keywords-row">
          {data.keywords.map((kw: string, i: number) => (
            <span key={i} className="keyword-chip">#{kw}</span>
          ))}
        </div>
      )}

      <p className="sub-section-title">핵심 포인트 5가지</p>
      <div className="points-grid">
        {data.points?.map((pt: string, i: number) => (
          <div key={i} className="point-card">
            <div className="point-card-num">{i + 1}</div>
            <div className="point-card-text">
              <CollapsibleText text={pt} limit={120} />
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

function ChecklistTab({ data }: { data: any }) {
  if (!data) return null

  const renderList = (title: string, list: any[]) => {
    return (
      <div className="checklist-column">
        <h3 className="checklist-column-title">{title}</h3>
        {!list || list.length === 0 ? (
          <div className="empty-checklist">해당 항목 없음</div>
        ) : (
          <div className="checklist-items">
            {list.map((item: any, i: number) => (
              <div key={i} className={`checklist-item-card priority-${item.priority || '중'}`}>
                <div className="checklist-item-main">
                  <div className="checklist-item-text">{item.task}</div>
                </div>
                <div className="checklist-item-meta">
                  <span className={`meta-badge diff-${item.difficulty || '중'}`}>난이도: {item.difficulty}</span>
                  <span className="meta-badge time-badge">시간: {item.time}</span>
                  <span className={`meta-badge priority-badge-${item.priority || '중'}`}>우선순위: {item.priority}</span>
                  {item.tools && <span className="meta-badge tools-badge">도구: {item.tools}</span>}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    )
  }

  return (
    <div>
      <h2 className="section-title" style={{ color: 'var(--tab-impl)' }}>실행 체크리스트</h2>
      <div className="checklist-grid">
        {renderList('오늘 할 일', data.today)}
        {renderList('이번 주 할 일', data.this_week)}
        {renderList('장기 과제', data.long_term)}
      </div>
    </div>
  )
}

const BUSINESS_APP_FIELDS = [
  { key: 'elec_safety_marketing', label: '전기안전관리대행 마케팅' },
  { key: 'naver_blog_auto',       label: '네이버 블로그 자동발행' },
  { key: 'wp_blogger_auto',       label: '워드프레스/구글블로거 자동발행' },
  { key: 'yt_shorts_content',     label: '유튜브/쇼츠 콘텐츠화' },
  { key: 'landing_page_improve',  label: '랜딩페이지 개선' },
  { key: 'powerlink_ad_improve',  label: '파워링크 광고 개선' },
  { key: 'hermes_ai_agent',       label: 'Hermes AI 에이전트 시스템' },
  { key: 'crm_crawling_db',       label: 'CRM/크롤링 영업 DB' },
  { key: 'obsidian_biz_wiki',     label: 'Obsidian 사업 위키' },
  { key: 'new_auto_revenue',      label: '신규 자동화 수익모델' },
]

function BusinessAppTab({ data }: { data: any }) {
  if (!data) return null
  return (
    <div>
      <h2 className="section-title" style={{ color: 'var(--tab-app)' }}>내 사업 적용 방안</h2>
      <div className="business-app-grid">
        {BUSINESS_APP_FIELDS.map((f) => {
          const content = data[f.key] || '관련 아이디어가 생성되지 않았습니다.'
          return (
            <div key={f.key} className="biz-app-card">
              <div className="biz-app-card-title">{f.label}</div>
              <div className="biz-app-card-content">
                <CollapsibleText text={content} limit={160} />
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}

function IdeasTab({ data }: { data: any }) {
  if (!data || !Array.isArray(data)) return null

  const [expandedIndex, setExpandedIndex] = useState<number | null>(0)

  return (
    <div>
      <h2 className="section-title" style={{ color: 'var(--tab-biz)' }}>사업 아이디어 발굴</h2>
      <div className="ideas-list">
        {data.map((idea: any, idx: number) => {
          const isExpanded = expandedIndex === idx
          return (
            <div key={idx} className="idea-collapsible-card">
              <div
                className="idea-card-header"
                onClick={() => setExpandedIndex(isExpanded ? null : idx)}
              >
                <div className="idea-card-header-left">
                  <span className="idea-idx-badge">{idx + 1}</span>
                  <div className="idea-title-group">
                    <h3 className="idea-name-text">{idea.name}</h3>
                    <p className="idea-one-line-text">{idea.one_line}</p>
                  </div>
                </div>
                <button className="idea-expand-arrow">
                  {isExpanded ? '▲' : '▼'}
                </button>
              </div>

              {isExpanded && (
                <div className="idea-card-body">
                  <div className="idea-detail-grid">
                    <div className="idea-detail-item">
                      <span className="idea-detail-label">타깃 고객</span>
                      <span className="idea-detail-val">{idea.target_customer}</span>
                    </div>
                    <div className="idea-detail-item">
                      <span className="idea-detail-label">해결 문제</span>
                      <span className="idea-detail-val">{idea.problem_solved}</span>
                    </div>
                    <div className="idea-detail-item">
                      <span className="idea-detail-label">수익 모델</span>
                      <span className="idea-detail-val">{idea.revenue_model}</span>
                    </div>
                    <div className="idea-detail-item">
                      <span className="idea-detail-label">초기 실행 방법</span>
                      <span className="idea-detail-val">{idea.initial_steps}</span>
                    </div>
                    <div className="idea-detail-item">
                      <span className="idea-detail-label">필요 기술</span>
                      <span className="idea-detail-val">{idea.required_tech}</span>
                    </div>
                  </div>

                  <div className="idea-ratings-row">
                    <div className="idea-rating-chip">
                      난이도: <strong className={`val-badge diff-${idea.difficulty}`}>{idea.difficulty}</strong>
                    </div>
                    <div className="idea-rating-chip">
                      예상 수익성: <strong className={`val-badge prof-${idea.profitability}`}>{idea.profitability}</strong>
                    </div>
                    <div className="idea-rating-chip">
                      대표님 적합도: <strong className={`val-badge suit-${idea.suitability}`}>{idea.suitability}</strong>
                    </div>
                  </div>
                </div>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}

function AnalysisTab({ data }: { data: any }) {
  if (!data) return null

  const scoreKeys = [
    { key: 'marketability', label: '시장성' },
    { key: 'feasibility',   label: '실행 가능성' },
    { key: 'profitability', label: '수익성' },
    { key: 'risk',          label: '리스크' },
    { key: 'suitability',   label: '대표님 적합도' },
  ]

  const priority = data.priority || 'B'

  return (
    <div>
      <h2 className="section-title" style={{ color: 'var(--tab-critical)' }}>사업성 종합 분석</h2>

      <div className="analysis-summary-layout">
        {/* 대형 우선순위 등급 뱃지 */}
        <div className="priority-badge-large-wrapper">
          <div className="priority-badge-large-circle">
            <span className="priority-letter">{priority}</span>
          </div>
          <div className="priority-badge-label">종합 우선순위 등급</div>
        </div>

        {/* 점수바 차트 */}
        <div className="scores-bars-container">
          {scoreKeys.map((s) => {
            const scoreVal = data[s.key] || 50
            const isRisk = s.key === 'risk'
            const barColor = isRisk
              ? (scoreVal >= 70 ? 'var(--red)' : scoreVal >= 40 ? 'var(--orange)' : 'var(--green)')
              : (scoreVal >= 75 ? 'var(--green)' : scoreVal >= 55 ? 'var(--orange)' : 'var(--red)')

            return (
              <div key={s.key} className="score-bar-row">
                <div className="score-bar-header">
                  <span className="score-bar-label">{s.label}</span>
                  <span className="score-bar-value" style={{ color: barColor }}>{scoreVal} / 100</span>
                </div>
                <div className="score-bar-track">
                  <div
                    className="score-bar-fill"
                    style={{
                      width: `${scoreVal}%`,
                      backgroundColor: barColor,
                    }}
                  />
                </div>
              </div>
            )
          })}
        </div>
      </div>

      {data.reasoning && (
        <div className="reasoning-box">
          <div className="reasoning-title">등급 책정 사유</div>
          <div className="reasoning-content">{data.reasoning}</div>
        </div>
      )}

      {/* SWOT 분석 */}
      {data.swot && (
        <div className="swot-grid" style={{ marginTop: '24px' }}>
          <div className="swot-card swot-strengths">
            <div className="swot-header">Strengths (강점)</div>
            <ul className="swot-list">
              {data.swot.strengths?.map((s: string, i: number) => <li key={i}>{s}</li>)}
            </ul>
          </div>
          <div className="swot-card swot-weaknesses">
            <div className="swot-header">Weaknesses (약점)</div>
            <ul className="swot-list">
              {data.swot.weaknesses?.map((w: string, i: number) => <li key={i}>{w}</li>)}
            </ul>
          </div>
          <div className="swot-card swot-opportunities">
            <div className="swot-header">Opportunities (기회)</div>
            <ul className="swot-list">
              {data.swot.opportunities?.map((o: string, i: number) => <li key={i}>{o}</li>)}
            </ul>
          </div>
          <div className="swot-card swot-threats">
            <div className="swot-header">Threats (위협)</div>
            <ul className="swot-list">
              {data.swot.threats?.map((t: string, i: number) => <li key={i}>{t}</li>)}
            </ul>
          </div>
        </div>
      )}
    </div>
  )
}

function ObsidianTab({
  markdownContent,
  obsidianPath,
  setObsidianPath,
  onSaveToObsidian,
  saveStatus,
}: {
  markdownContent: string
  obsidianPath: string
  setObsidianPath: (path: string) => void
  onSaveToObsidian: () => void
  saveStatus: string
}) {
  const handleSaveClick = () => {
    if (!obsidianPath.trim()) return
    onSaveToObsidian()
  }

  return (
    <div>
      <h2 className="section-title" style={{ color: 'var(--text-primary)' }}>Obsidian 저장 설정</h2>

      <div className="obsidian-settings-card">
        <p className="obsidian-settings-desc">
          로컬에 유튜브 AI 분석기 서버가 구동 중인 경우, Obsidian Vault 절대 경로를 입력하여 마크다운 노트를 즉시 생성해 저장할 수 있습니다.
        </p>
        <div className="obsidian-path-form">
          <input
            className="obsidian-path-input"
            type="text"
            placeholder="예: C:\Users\YourName\Documents\ObsidianVault"
            value={obsidianPath}
            onChange={(e) => setObsidianPath(e.target.value)}
          />
          <button
            className="obsidian-save-btn"
            onClick={handleSaveClick}
            disabled={!obsidianPath.trim()}
          >
            Vault에 직접 저장
          </button>
        </div>
        {saveStatus && (
          <div className={`obsidian-save-status-msg ${saveStatus.includes('성공') ? 'success' : 'error'}`}>
            {saveStatus}
          </div>
        )}
      </div>

      <div className="obsidian-preview-section">
        <div className="obsidian-preview-header">
          <span>마크다운 미리보기</span>
        </div>
        <textarea
          className="obsidian-preview-textarea"
          readOnly
          value={markdownContent}
        />
      </div>
    </div>
  )
}

function RawDataTab({
  analysis,
  modelUsed,
  transcriptText,
  costEstimate,
}: {
  analysis: any
  modelUsed: string
  transcriptText: string
  costEstimate: number
}) {
  const [showTranscript, setShowTranscript] = useState(false)
  const [showJson, setShowJson] = useState(false)

  return (
    <div>
      <h2 className="section-title" style={{ color: 'var(--text-secondary)' }}>원문 데이터 및 진단 정보</h2>

      <div className="raw-info-grid">
        <div className="raw-info-card">
          <div className="raw-info-label">사용 모델</div>
          <div className="raw-info-value">{modelUsed || 'google-genai SDK'}</div>
        </div>
        <div className="raw-info-card">
          <div className="raw-info-label">분석 일시</div>
          <div className="raw-info-value">{new Date().toLocaleString('ko-KR')}</div>
        </div>
        <div className="raw-info-card">
          <div className="raw-info-label">자막 글자수</div>
          <div className="raw-info-value">{(transcriptText || '').length.toLocaleString()} 자</div>
        </div>
        <div className="raw-info-card">
          <div className="raw-info-label">비용 추정치 (Gemini 기준)</div>
          <div className="raw-info-value" style={{ color: 'var(--orange)' }}>
            약 {costEstimate.toFixed(2)} 원
          </div>
        </div>
      </div>

      <div className="collapsible-section" style={{ marginTop: '20px' }}>
        <button
          className="collapsible-section-toggle"
          onClick={() => setShowTranscript(!showTranscript)}
        >
          <span>원문 자막 {showTranscript ? '접기' : '펼치기'}</span>
          <span>{showTranscript ? '▲' : '▼'}</span>
        </button>
        {showTranscript && (
          <div className="collapsible-section-content">
            <div className="transcript-box-raw">
              {transcriptText || '자막 데이터가 없습니다.'}
            </div>
          </div>
        )}
      </div>

      <div className="collapsible-section" style={{ marginTop: '14px' }}>
        <button
          className="collapsible-section-toggle"
          onClick={() => setShowJson(!showJson)}
        >
          <span>분석 원본 JSON {showJson ? '접기' : '펼치기'}</span>
          <span>{showJson ? '▲' : '▼'}</span>
        </button>
        {showJson && (
          <div className="collapsible-section-content">
            <pre className="json-box-raw">
              {JSON.stringify(analysis, null, 2)}
            </pre>
          </div>
        )}
      </div>
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// Transform Modal Component
// ─────────────────────────────────────────────────────────────────────────────
function TransformModal({
  isOpen,
  title,
  content,
  isLoading,
  onClose,
  onSaveToObsidian,
  obsidianPath,
  saveStatus,
}: {
  isOpen: boolean
  title: string
  content: string
  isLoading: boolean
  onClose: () => void
  onSaveToObsidian: (fileName: string, text: string) => void
  obsidianPath: string
  saveStatus: string
}) {
  if (!isOpen) return null

  const handleCopy = () => {
    navigator.clipboard.writeText(content)
    alert('클립보드에 복사되었습니다!')
  }

  const handleDownload = () => {
    const blob = new Blob([content], { type: 'text/markdown;charset=utf-8' })
    const a = document.createElement('a')
    a.href = URL.createObjectURL(blob)
    const cleanTitle = title.replace(/\s+/g, '_')
    a.download = `${cleanTitle}_${new Date().toISOString().slice(0, 10)}.md`
    a.click()
  }

  const handleSaveVault = () => {
    const cleanTitle = title.replace(/\s+/g, '_')
    const fileName = `${cleanTitle}_${new Date().toISOString().slice(0, 10)}.md`
    onSaveToObsidian(fileName, content)
  }

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-card" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h3 className="modal-title">{title}</h3>
          <button className="modal-close-btn" onClick={onClose}>×</button>
        </div>
        <div className="modal-body">
          {isLoading ? (
            <div className="modal-loading-container">
              <div className="loading-spinner" />
              <p>AI가 분석 결과를 비즈니스 문서로 심층 변환 중입니다...</p>
            </div>
          ) : (
            <textarea className="modal-textarea-preview" readOnly value={content} />
          )}
        </div>
        <div className="modal-footer">
          {!isLoading && (
            <>
              <button className="modal-action-btn" onClick={handleCopy}>클립보드 복사</button>
              <button className="modal-action-btn" onClick={handleDownload}>마크다운 다운로드</button>
              {obsidianPath && (
                <button className="modal-action-btn accent" onClick={handleSaveVault}>
                  Vault에 직접 저장
                </button>
              )}
            </>
          )}
          <button className="modal-action-btn close" onClick={onClose}>닫기</button>
        </div>
        {saveStatus && (
          <div className={`modal-save-status-msg ${saveStatus.includes('성공') ? 'success' : 'error'}`}>
            {saveStatus}
          </div>
        )}
      </div>
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// Markdown Helpers
// ─────────────────────────────────────────────────────────────────────────────
function generateObsidianMarkdown(videoMeta: any, analysis: any, modelUsed: string) {
  if (!videoMeta || !analysis) return ''

  const todayStr = new Date().toISOString().slice(0, 10)
  const score = analysis.business_analysis?.overall_score || analysis.business_analysis?.suitability || 70
  const priority = analysis.business_analysis?.priority || 'B'

  const frontmatter = [
    `---`,
    `type: youtube-analysis`,
    `source: "${videoMeta.url}"`,
    `title: "${videoMeta.title.replace(/"/g, '\\"')}"`,
    `channel: "${videoMeta.channel.replace(/"/g, '\\"')}"`,
    `url: "${videoMeta.url}"`,
    `created: ${todayStr}`,
    `tags:`,
    ...(videoMeta.tags || []).map((t: string) => `  - "${t}"`),
    `  - "youtube-ai"`,
    `score: ${score}`,
    `priority: "${priority}"`,
    `status: "inbox"`,
    `related_business:`,
    `  - "[[전기안전관리 블로그 자동화]]"`,
    `  - "[[Hermes 에이전트 시스템]]"`,
    `  - "[[사업 아이디어 창고]]"`,
    `---`,
    ``,
  ].join('\n')

  const linkify = (text: string) => {
    if (!text) return ''
    return text
      .replace(/AI\s*루프/g, '[[AI 루프]]')
      .replace(/Hermes/gi, '[[Hermes 에이전트 시스템]]')
      .replace(/전기안전관리/g, '[[전기안전관리 블로그 자동화]]')
      .replace(/사업\s*아이디어/g, '[[사업 아이디어 창고]]')
  }

  const summarySec = [
    `## 핵심 요약`,
    ``,
    `> ${linkify(analysis.summary?.one_line)}`,
    ``,
    `### 핵심 키워드`,
    (analysis.summary?.keywords || []).map((k: string) => `\`#${k}\``).join(' '),
    ``,
    `### 핵심 포인트 5가지`,
    ...(analysis.summary?.points || []).map((p: string, i: number) => `${i + 1}. ${linkify(p)}`),
    ``,
  ].join('\n')

  const checklistSec = [
    `## 실행 체크리스트`,
    ``,
    `### 오늘 할 일`,
    ...(analysis.checklist?.today || []).map((item: any) =>
      `- [ ] **${linkify(item.task)}** (난이도: ${item.difficulty} | 소요시간: ${item.time} | 우선순위: ${item.priority} | 도구: ${item.tools})`
    ),
    ``,
    `### 이번 주 할 일`,
    ...(analysis.checklist?.this_week || []).map((item: any) =>
      `- [ ] **${linkify(item.task)}** (난이도: ${item.difficulty} | 소요시간: ${item.time} | 우선순위: ${item.priority} | 도구: ${item.tools})`
    ),
    ``,
    `### 장기 과제`,
    ...(analysis.checklist?.long_term || []).map((item: any) =>
      `- [ ] **${linkify(item.task)}** (난이도: ${item.difficulty} | 소요시간: ${item.time} | 우선순위: ${item.priority} | 도구: ${item.tools})`
    ),
    ``,
  ].join('\n')

  const appSec = [
    `## 내 사업 적용`,
    ``,
    `- **전기안전관리대행 마케팅**: ${linkify(analysis.business_app?.elec_safety_marketing)}`,
    `- **네이버 블로그 자동발행**: ${linkify(analysis.business_app?.naver_blog_auto)}`,
    `- **워드프레스/구글블로거 자동발행**: ${linkify(analysis.business_app?.wp_blogger_auto)}`,
    `- **유튜브/쇼츠 콘텐츠화**: ${linkify(analysis.business_app?.yt_shorts_content)}`,
    `- **랜딩페이지 개선**: ${linkify(analysis.business_app?.landing_page_improve)}`,
    `- **파워링크 광고 개선**: ${linkify(analysis.business_app?.powerlink_ad_improve)}`,
    `- **Hermes AI 에이전트 시스템**: ${linkify(analysis.business_app?.hermes_ai_agent)}`,
    `- **CRM/크롤링 영업 DB**: ${linkify(analysis.business_app?.crm_crawling_db)}`,
    `- **Obsidian 사업 위키**: ${linkify(analysis.business_app?.obsidian_biz_wiki)}`,
    `- **신규 자동화 수익모델**: ${linkify(analysis.business_app?.new_auto_revenue)}`,
    ``,
  ].join('\n')

  const ideasSec = [
    `## 사업 아이디어 발굴`,
    ``,
    ...(analysis.business_ideas || []).map((idea: any, i: number) => {
      return [
        `### ${i + 1}. ${linkify(idea.name)}`,
        `- **한 줄 설명**: ${linkify(idea.one_line)}`,
        `- **타깃 고객**: ${idea.target_customer}`,
        `- **해결 문제**: ${linkify(idea.problem_solved)}`,
        `- **수익 모델**: ${idea.revenue_model}`,
        `- **초기 실행 방법**: ${linkify(idea.initial_steps)}`,
        `- **필요한 기술/도구**: ${idea.required_tech}`,
        `- **난이도**: ${idea.difficulty} | **예상 수익성**: ${idea.profitability} | **대표님 사업 적합도**: ${idea.suitability}`,
        ``,
      ].join('\n')
    }),
  ].join('\n')

  const analysisSec = [
    `## 사업성 분석`,
    ``,
    `- **시장성 점수**: ${analysis.business_analysis?.marketability}/100`,
    `- **실행 가능성 점수**: ${analysis.business_analysis?.feasibility}/100`,
    `- **수익성 점수**: ${analysis.business_analysis?.profitability}/100`,
    `- **리스크 점수**: ${analysis.business_analysis?.risk}/100`,
    `- **대표님 적합도 점수**: ${analysis.business_analysis?.suitability}/100`,
    `- **종합 우선순위**: **${priority} 등급**`,
    ``,
    `### 우선순위 판단 사유`,
    `> ${linkify(analysis.business_analysis?.reasoning)}`,
    ``,
    `### SWOT 분석`,
    `- **Strengths (강점)**:`,
    ...(analysis.business_analysis?.swot?.strengths || []).map((s: string) => `  - ${s}`),
    `- **Weaknesses (약점)**:`,
    ...(analysis.business_analysis?.swot?.weaknesses || []).map((w: string) => `  - ${w}`),
    `- **Opportunities (기회)**:`,
    ...(analysis.business_analysis?.swot?.opportunities || []).map((o: string) => `  - ${o}`),
    `- **Threats (위협)**:`,
    ...(analysis.business_analysis?.swot?.threats || []).map((t: string) => `  - ${t}`),
    ``,
  ].join('\n')

  const footerSec = [
    `---`,
    `*본 문서는 유튜브 AI 분석기 v2.1에 의해 자동 생성되었습니다.*`,
    `*분석 모델: ${modelUsed}*`,
    `*분석 일시: ${new Date().toLocaleString('ko-KR')}*`,
  ].join('\n')

  return [
    frontmatter,
    `# ${videoMeta.title}`,
    ``,
    `**채널**: ${videoMeta.channel}`,
    `**링크**: ${videoMeta.url}`,
    `**영상 길이**: ${videoMeta.duration_str}`,
    ``,
    `---`,
    ``,
    summarySec,
    `---`,
    ``,
    checklistSec,
    `---`,
    ``,
    appSec,
    `---`,
    ``,
    ideasSec,
    `---`,
    ``,
    analysisSec,
    `---`,
    ``,
    footerSec,
  ].join('\n')
}

function generateChecklistMarkdown(videoMeta: any, analysis: any) {
  if (!analysis) return ''
  return [
    `# [실행 체크리스트] ${videoMeta?.title || '유튜브 분석'}`,
    ``,
    `## 오늘 할 일`,
    ...(analysis.checklist?.today || []).map((item: any) =>
      `- [ ] **${item.task}** (난이도: ${item.difficulty} | 소요시간: ${item.time} | 우선순위: ${item.priority} | 도구: ${item.tools})`
    ),
    ``,
    `## 이번 주 할 일`,
    ...(analysis.checklist?.this_week || []).map((item: any) =>
      `- [ ] **${item.task}** (난이도: ${item.difficulty} | 소요시간: ${item.time} | 우선순위: ${item.priority} | 도구: ${item.tools})`
    ),
    ``,
    `## 장기 과제`,
    ...(analysis.checklist?.long_term || []).map((item: any) =>
      `- [ ] **${item.task}** (난이도: ${item.difficulty} | 소요시간: ${item.time} | 우선순위: ${item.priority} | 도구: ${item.tools})`
    ),
  ].join('\n')
}

function generateIdeasMarkdown(videoMeta: any, analysis: any) {
  if (!analysis) return ''
  return [
    `# [사업 아이디어 발굴] ${videoMeta?.title || '유튜브 분석'}`,
    ``,
    ...(analysis.business_ideas || []).map((idea: any, i: number) => {
      return [
        `## ${i + 1}. ${idea.name}`,
        `- **한 줄 설명**: ${idea.one_line}`,
        `- **타깃 고객**: ${idea.target_customer}`,
        `- **해결 문제**: ${idea.problem_solved}`,
        `- **수익 모델**: ${idea.revenue_model}`,
        `- **초기 실행 방법**: ${idea.initial_steps}`,
        `- **필요한 기술/도구**: ${idea.required_tech}`,
        `- **난이도**: ${idea.difficulty} | 예상 수익성: ${idea.profitability} | 대표님 적합도: ${idea.suitability}`,
        ``,
      ].join('\n')
    }),
  ].join('\n')
}

// ─────────────────────────────────────────────────────────────────────────────
// Main Application Component
// ─────────────────────────────────────────────────────────────────────────────
export default function App() {
  const [url, setUrl] = useState('')
  const [apiKey, setApiKey] = useState('')
  const [showApiKey, setShowApiKey] = useState(false)
  const [provider, setProvider] = useState<'gemini' | 'openrouter'>('gemini')
  const [selectedModel, setSelectedModel] = useState('google/gemini-2.5-flash')
  const [analysisMode, setAnalysisMode] = useState('summary')
  const [obsidianPath, setObsidianPath] = useState('')
  
  const [loadingStep, setLoadingStep] = useState<LoadingStep>('idle')
  const [videoMeta, setVideoMeta] = useState<VideoMeta | null>(null)
  const [analysis, setAnalysis] = useState<AnalysisData | null>(null)
  const [activeTab, setActiveTab] = useState('summary')
  const [error, setError] = useState('')
  
  const [keySaved, setKeySaved] = useState(false)
  const [saveToast, setSaveToast] = useState('')
  
  // Obsidian save states
  const [obsidianSaveStatus, setObsidianSaveStatus] = useState('')
  const [modalSaveStatus, setModalSaveStatus] = useState('')

  // Sub-data from API response
  const [fullTranscript, setFullTranscript] = useState('')
  const [modelUsed, setModelUsed] = useState('gemini-2.0-flash')

  // Transform Modal states
  const [transformModal, setTransformModal] = useState({
    isOpen: false,
    title: '',
    content: '',
    isLoading: false,
  })

  const analysisRef = useRef<HTMLDivElement>(null)

  // Load saved keys & paths on start
  useEffect(() => {
    const savedKey = localStorage.getItem(STORAGE_KEYS[provider])
    if (savedKey) {
      setApiKey(savedKey)
      setKeySaved(true)
    } else {
      setApiKey('')
      setKeySaved(false)
    }
  }, [provider])

  useEffect(() => {
    const savedPath = localStorage.getItem(STORAGE_KEYS.obsidianPath)
    if (savedPath) {
      setObsidianPath(savedPath)
    }
  }, [])

  const handleSaveKey = () => {
    if (!apiKey.trim()) return
    localStorage.setItem(STORAGE_KEYS[provider], apiKey.trim())
    setKeySaved(true)
    setSaveToast('API 키가 저장되었습니다.')
    setTimeout(() => setSaveToast(''), 2500)
  }

  const handleDeleteKey = () => {
    localStorage.removeItem(STORAGE_KEYS[provider])
    setApiKey('')
    setKeySaved(false)
    setSaveToast('저장된 API 키가 삭제되었습니다.')
    setTimeout(() => setSaveToast(''), 2500)
  }

  const handleSaveObsidianPath = (path: string) => {
    setObsidianPath(path)
    localStorage.setItem(STORAGE_KEYS.obsidianPath, path.trim())
  }

  const isLoading = loadingStep !== 'idle' && loadingStep !== 'done'

  const handleAnalyze = async (forcedMode?: string) => {
    if (!url.trim()) return
    setError('')
    setAnalysis(null)
    setVideoMeta(null)
    setFullTranscript('')

    const modeToUse = forcedMode || analysisMode

    // Step 1: Fetch video info
    setLoadingStep('fetching-info')
    try {
      const infoRes = await fetch(`${API_BASE}/api/video-info`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url }),
      })
      if (!infoRes.ok) {
        const err = await infoRes.json()
        throw new Error(err.detail || '영상 정보를 가져올 수 없습니다.')
      }
      const infoData = await infoRes.json()
      setVideoMeta(infoData)
    } catch (e: any) {
      setError(e.message)
      setLoadingStep('idle')
      return
    }

    // Step 2: Full analysis
    setLoadingStep('analyzing')
    try {
      const analyzeRes = await fetch(`${API_BASE}/api/analyze`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          url,
          api_key: apiKey || undefined,
          api_provider: provider,
          model: provider === 'openrouter' ? selectedModel : undefined,
          analysis_mode: modeToUse,
        }),
      })
      if (!analyzeRes.ok) {
        const err = await analyzeRes.json()
        throw new Error(err.detail || 'AI 분석에 실패했습니다.')
      }
      const analyzeData = await analyzeRes.json()
      setAnalysis(analyzeData.analysis)
      
      // Save transcript entries text
      if (analyzeData.transcript_entries) {
        const tText = analyzeData.transcript_entries.map((e: any) => e.text).join(' ')
        setFullTranscript(tText)
      }
      
      setModelUsed(analyzeData.model_used || (provider === 'openrouter' ? selectedModel : 'gemini-2.0-flash'))
      setActiveTab('summary')
      setLoadingStep('done')
      
      setTimeout(() => {
        analysisRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' })
      }, 200)
    } catch (e: any) {
      setError(e.message)
      setLoadingStep('idle')
    }
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') handleAnalyze()
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // Action Handlers
  // ─────────────────────────────────────────────────────────────────────────────
  const obsidianMarkdown = analysis && videoMeta 
    ? generateObsidianMarkdown(videoMeta, analysis, modelUsed) 
    : ''

  const handleSaveToObsidianLocal = async (fileName: string, text: string) => {
    if (!obsidianPath.trim()) return
    setModalSaveStatus('저장 중...')
    setObsidianSaveStatus('저장 중...')
    try {
      const res = await fetch(`${API_BASE}/api/save-obsidian`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          vault_path: obsidianPath.trim(),
          file_name: fileName,
          content: text,
        }),
      })
      if (!res.ok) {
        const err = await res.json()
        throw new Error(err.detail || '파일 저장에 실패했습니다.')
      }
      setModalSaveStatus('Obsidian Vault에 성공적으로 저장되었습니다!')
      setObsidianSaveStatus('Obsidian Vault에 성공적으로 저장되었습니다!')
      setTimeout(() => {
        setModalSaveStatus('')
        setObsidianSaveStatus('')
      }, 3000)
    } catch (e: any) {
      setModalSaveStatus(`저장 실패: ${e.message}`)
      setObsidianSaveStatus(`저장 실패: ${e.message}`)
      setTimeout(() => {
        setModalSaveStatus('')
        setObsidianSaveStatus('')
      }, 4000)
    }
  }

  const handleDownloadFullMarkdown = () => {
    if (!obsidianMarkdown) return
    const blob = new Blob([obsidianMarkdown], { type: 'text/markdown;charset=utf-8' })
    const a = document.createElement('a')
    a.href = URL.createObjectURL(blob)
    a.download = `유튜브분석_${new Date().toISOString().slice(0, 10)}.md`
    a.click()
  }

  const handleDownloadIdeasOnly = () => {
    if (!analysis) return
    const content = generateIdeasMarkdown(videoMeta, analysis)
    const blob = new Blob([content], { type: 'text/markdown;charset=utf-8' })
    const a = document.createElement('a')
    a.href = URL.createObjectURL(blob)
    a.download = `사업아이디어_${new Date().toISOString().slice(0, 10)}.md`
    a.click()
  }

  const handleDownloadChecklistOnly = () => {
    if (!analysis) return
    const content = generateChecklistMarkdown(videoMeta, analysis)
    const blob = new Blob([content], { type: 'text/markdown;charset=utf-8' })
    const a = document.createElement('a')
    a.href = URL.createObjectURL(blob)
    a.download = `실행체크리스트_${new Date().toISOString().slice(0, 10)}.md`
    a.click()
  }

  const handleTransform = async (type: string, typeLabel: string) => {
    if (!analysis || !videoMeta) return
    setTransformModal({
      isOpen: true,
      title: typeLabel,
      content: '',
      isLoading: true,
    })
    setModalSaveStatus('')

    try {
      const res = await fetch(`${API_BASE}/api/transform`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: videoMeta.title,
          channel: videoMeta.channel,
          analysis_data: analysis,
          transcript: fullTranscript || '',
          transform_type: type,
          api_key: apiKey || undefined,
          api_provider: provider,
          model: provider === 'openrouter' ? selectedModel : undefined,
        }),
      })
      if (!res.ok) {
        const err = await res.json()
        throw new Error(err.detail || 'AI 변환에 실패했습니다.')
      }
      const data = await res.json()
      setTransformModal(prev => ({
        ...prev,
        content: data.result,
        isLoading: false,
      }))
    } catch (e: any) {
      setTransformModal(prev => ({
        ...prev,
        content: `오류가 발생했습니다: ${e.message}`,
        isLoading: false,
      }))
    }
  }

  const handleReanalyzeNormal = () => {
    handleAnalyze()
  }

  const handleReanalyzeSkeptical = () => {
    setAnalysisMode('investor')
    handleAnalyze('investor')
  }

  // Cost calculation based on length (1 char = approx 0.3-0.5 tokens in Korean, Gemini 2.0 Flash pricing)
  const costEstimate = analysis ? (
    ((fullTranscript || '').length / 2.5) * 0.000000075 + 
    (JSON.stringify(analysis).length / 2.5) * 0.00000030
  ) * 1400 : 0 // KRW Exchange rate approx 1400

  const loadingStepsList = [
    { id: 'fetching-info', label: '영상 정보 수집' },
    { id: 'analyzing',     label: 'AI 심층 분석 및 비즈니스 모델링' },
  ]

  const getStepStatus = (stepId: string) => {
    const order = ['fetching-info', 'analyzing', 'done']
    const current = order.indexOf(loadingStep)
    const target = order.indexOf(stepId)
    if (current > target) return 'done'
    if (current === target) return 'active'
    return 'idle'
  }

  return (
    <>
      {/* Background grain & radial gradients */}
      <div className="app-background" />

      <div className="app-container">
        {/* Header */}
        <header className="app-header">
          <div className="logo-wrapper">
            <div className="logo-icon">YT</div>
            <h1 className="app-title">유튜브 <span>AI</span> 사업 아이디어 창고</h1>
          </div>
          <p className="app-subtitle">유튜브 영상 1개로부터 마케팅 기획, 실행 체크리스트, Obsidian 저장까지 완벽 지원</p>
        </header>

        {/* Input Section */}
        <section className="input-section">
          <p className="input-section-title">유튜브 URL 입력 및 분석 설정</p>
          <div className="url-input-wrapper">
            <input
              id="youtube-url"
              className="url-input"
              type="url"
              placeholder="https://www.youtube.com/watch?v=..."
              value={url}
              onChange={e => setUrl(e.target.value)}
              onKeyDown={handleKeyDown}
              disabled={isLoading}
            />
            <button
              id="analyze-btn"
              className="analyze-btn"
              onClick={() => handleAnalyze()}
              disabled={isLoading || !url.trim()}
            >
              {isLoading ? '분석 중...' : '분석 시작'}
            </button>
          </div>

          <div className="settings-row-grid">
            {/* Provider Selection */}
            <div className="settings-col">
              <span className="api-key-label">AI 공급자</span>
              <div className="provider-toggle">
                <button
                  id="provider-gemini"
                  className={`provider-btn ${provider === 'gemini' ? 'active' : ''}`}
                  onClick={() => setProvider('gemini')}
                >
                  Google Gemini
                </button>
                <button
                  id="provider-openrouter"
                  className={`provider-btn ${provider === 'openrouter' ? 'active' : ''}`}
                  onClick={() => setProvider('openrouter')}
                >
                  OpenRouter
                </button>
              </div>
            </div>

            {/* Analysis Mode */}
            <div className="settings-col">
              <span className="api-key-label">분석 모드</span>
              <select
                id="analysis-mode-select"
                className="model-select"
                value={analysisMode}
                onChange={e => setAnalysisMode(e.target.value)}
              >
                {ANALYSIS_MODES.map(m => (
                  <option key={m.id} value={m.id}>{m.label}</option>
                ))}
              </select>
            </div>
          </div>

          {/* Model Selection (OpenRouter only) */}
          {provider === 'openrouter' && (
            <div className="model-section" style={{ borderTop: '1px solid var(--border)', paddingTop: '14px' }}>
              <span className="api-key-label">모델 선택</span>
              <select
                id="model-select"
                className="model-select"
                value={selectedModel}
                onChange={e => setSelectedModel(e.target.value)}
              >
                {Object.entries(OPENROUTER_MODELS).map(([value, label]) => (
                  <option key={value} value={value}>{label}</option>
                ))}
              </select>
            </div>
          )}

          {/* API Key */}
          <div className="api-key-section" style={{ borderTop: '1px solid var(--border)', paddingTop: '14px', marginTop: '14px' }}>
            <div className="api-key-label-row">
              <span className="api-key-label">
                {provider === 'gemini' ? 'Gemini' : 'OpenRouter'} API 키
              </span>
              {keySaved && <span className="key-saved-badge">저장됨</span>}
            </div>
            <div className="api-key-input-wrapper">
              <input
                id="api-key-input"
                className="api-key-input"
                type={showApiKey ? 'text' : 'password'}
                placeholder={provider === 'gemini' ? 'AIza... (입력하지 않으면 서버 .env 파일 키 사용)' : 'sk-or-... (OpenRouter API 키)'}
                value={apiKey}
                onChange={e => { setApiKey(e.target.value); setKeySaved(false) }}
              />
              <button
                className="icon-btn"
                onClick={() => setShowApiKey(v => !v)}
                title={showApiKey ? '숨기기' : '표시'}
              >
                {showApiKey ? '●' : '○'}
              </button>
              <button
                id="save-key-btn"
                className="icon-btn save-key-btn"
                onClick={handleSaveKey}
                disabled={!apiKey.trim() || keySaved}
                title="브라우저에 키 저장"
              >
                저장
              </button>
              {keySaved && (
                <button
                  id="delete-key-btn"
                  className="icon-btn delete-key-btn"
                  onClick={handleDeleteKey}
                  title="저장된 키 삭제"
                >
                  삭제
                </button>
              )}
            </div>
            <div className="api-key-footer">
              <a
                className="api-key-link"
                href={provider === 'gemini' ? 'https://aistudio.google.com/apikey' : 'https://openrouter.ai/keys'}
                target="_blank"
                rel="noopener noreferrer"
              >
                {provider === 'gemini' ? '무료 발급받기' : 'OpenRouter 키 발급받기'} →
              </a>
              <span className="api-key-hint">API 키는 브라우저 로컬 저장소에 안전하게 유지됩니다.</span>
            </div>
            {saveToast && <div className="save-toast">{saveToast}</div>}
          </div>
        </section>

        {/* Error Box */}
        {error && (
          <div className="error-box">
            <span className="error-icon">!</span>
            <div>
              <strong>분석 오류 발생</strong>
              <p style={{ marginTop: '4px' }}>{error}</p>
            </div>
          </div>
        )}

        {/* Loading Indicator */}
        {isLoading && (
          <div className="loading-section">
            <div className="loading-spinner" />
            <p style={{ color: 'var(--text-secondary)', marginBottom: '4px', fontSize: '0.95rem', fontWeight: 600 }}>
              AI 비즈니스 분석기가 자막을 파싱하고 모델링을 설계하는 중입니다.
            </p>
            <p style={{ color: 'var(--text-muted)', marginBottom: '20px', fontSize: '0.8rem' }}>
              서버 준비 상태에 따라 최대 1분 내외가 소요될 수 있습니다.
            </p>
            <div className="loading-steps">
              {loadingStepsList.map(s => {
                const status = getStepStatus(s.id)
                return (
                  <div key={s.id} className={`loading-step ${status}`}>
                    {status === 'done' ? '완료' : status === 'active' ? <div className="loading-dot" /> : '대기'}
                    {s.label}
                  </div>
                )
              })}
            </div>
          </div>
        )}

        {/* Video Preview */}
        {videoMeta && (
          <div className="video-preview">
            {videoMeta.thumbnail && (
              <img className="video-thumbnail" src={videoMeta.thumbnail} alt="동영상 썸네일" />
            )}
            <div className="video-info">
              <div className="video-title">{videoMeta.title}</div>
              <div className="video-channel">{videoMeta.channel}</div>
              <div className="video-stats">
                <div className="video-stat">조회수 <span>{videoMeta.view_count_str}</span></div>
                <div className="video-stat">좋아요 <span>{videoMeta.like_count_str}</span></div>
                <div className="video-stat">길이 <span>{videoMeta.duration_str}</span></div>
              </div>
            </div>
          </div>
        )}

        {/* Analysis Result Panels */}
        {analysis && (
          <div ref={analysisRef} className="tabs-wrapper">
            
            {/* 10 Action Buttons Section */}
            <div className="action-control-panel">
              <div className="action-panel-title">액션 컨트롤 타워</div>
              
              <div className="action-buttons-group">
                <div className="action-subgroup">
                  <span className="group-label">노트 저장 및 다운로드</span>
                  <div className="btn-row">
                    <button className="control-action-btn" onClick={handleDownloadFullMarkdown}>
                      Markdown 저장
                    </button>
                    <button 
                      className="control-action-btn" 
                      onClick={() => handleSaveToObsidianLocal(`유튜브분석_${new Date().toISOString().slice(0, 10)}.md`, obsidianMarkdown)}
                      disabled={!obsidianPath.trim()}
                      title={!obsidianPath.trim() ? "Obsidian 탭에서 Vault 경로를 먼저 입력하세요." : "Obsidian에 즉시 저장"}
                    >
                      Obsidian 저장
                    </button>
                    <button className="control-action-btn" onClick={handleDownloadIdeasOnly}>
                      사업 아이디어만 저장
                    </button>
                    <button className="control-action-btn" onClick={handleDownloadChecklistOnly}>
                      실행 체크리스트만 저장
                    </button>
                  </div>
                </div>

                <div className="action-subgroup">
                  <span className="group-label">AI 심층 비즈니스 문서 변환</span>
                  <div className="btn-row">
                    <button className="control-action-btn transform-btn" onClick={() => handleTransform('elec_safety_plan', '전기안전관리 사업 적용 구체화 방안')}>
                      전기안전관리 적용안 생성
                    </button>
                    <button className="control-action-btn transform-btn" onClick={() => handleTransform('blog_post', 'SEO 최적화 블로그 원고')}>
                      블로그 글로 변환
                    </button>
                    <button className="control-action-btn transform-btn" onClick={() => handleTransform('landing_page', '고전환율 랜딩페이지 기획안')}>
                      랜딩페이지 기획으로 변환
                    </button>
                    <button className="control-action-btn transform-btn" onClick={() => handleTransform('hermes_brief', 'Hermes AI 에이전트 작업지시서')}>
                      Hermes 작업지시서로 변환
                    </button>
                  </div>
                </div>

                <div className="action-subgroup">
                  <span className="group-label">AI 재요청 및 제어</span>
                  <div className="btn-row">
                    <button className="control-action-btn reanalyze-btn" onClick={handleReanalyzeNormal}>
                      다시 분석
                    </button>
                    <button className="control-action-btn critical-reanalyze-btn" onClick={handleReanalyzeSkeptical}>
                      더 냉철하게 분석
                    </button>
                  </div>
                </div>
              </div>
            </div>

            {/* Tab Navigation */}
            <div className="tabs-header" role="tablist">
              {TABS.map(tab => (
                <button
                  key={tab.id}
                  id={`tab-${tab.id}`}
                  role="tab"
                  className={`tab-btn ${activeTab === tab.id ? 'active' : ''}`}
                  data-tab={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                >
                  {tab.label}
                </button>
              ))}
            </div>

            {/* Tab Panels */}
            <div className="tab-content" role="tabpanel">
              {activeTab === 'summary' && (
                <SummaryTab data={analysis.summary} />
              )}
              {activeTab === 'checklist' && (
                <ChecklistTab data={analysis.checklist} />
              )}
              {activeTab === 'business_app' && (
                <BusinessAppTab data={analysis.business_app} />
              )}
              {activeTab === 'ideas' && (
                <IdeasTab data={analysis.business_ideas} />
              )}
              {activeTab === 'analysis' && (
                <AnalysisTab data={analysis.business_analysis} />
              )}
              {activeTab === 'obsidian' && (
                <ObsidianTab
                  markdownContent={obsidianMarkdown}
                  obsidianPath={obsidianPath}
                  setObsidianPath={handleSaveObsidianPath}
                  onSaveToObsidian={() => handleSaveToObsidianLocal(`유튜브분석_${new Date().toISOString().slice(0, 10)}.md`, obsidianMarkdown)}
                  saveStatus={obsidianSaveStatus}
                />
              )}
              {activeTab === 'raw_data' && (
                <RawDataTab
                  analysis={analysis}
                  modelUsed={modelUsed}
                  transcriptText={fullTranscript}
                  costEstimate={costEstimate}
                />
              )}
            </div>
          </div>
        )}
      </div>

      {/* Transform modal popup */}
      <TransformModal
        isOpen={transformModal.isOpen}
        title={transformModal.title}
        content={transformModal.content}
        isLoading={transformModal.isLoading}
        onClose={() => setTransformModal(prev => ({ ...prev, isOpen: false }))}
        onSaveToObsidian={handleSaveToObsidianLocal}
        obsidianPath={obsidianPath}
        saveStatus={modalSaveStatus}
      />
    </>
  )
}
