import { useState, useRef, useEffect } from 'react'
import './index.css'

const STORAGE_KEYS = {
  gemini: 'yt_analyzer_gemini_key',
  openrouter: 'yt_analyzer_openrouter_key',
}

// 로컬: localhost:8001, Vercel 배포: 같은 도메인 /api
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
  { id: 'summary',        label: '핵심 내용' },
  { id: 'implementation', label: '실행 방법' },
  { id: 'applications',   label: '응용 분야' },
  { id: 'business',       label: '사업 기획' },
  { id: 'critical',       label: '냉철한 분석' },
]

type LoadingStep = 'idle' | 'fetching-info' | 'fetching-transcript' | 'analyzing' | 'done'

interface VideoMeta {
  title: string
  channel: string
  thumbnail: string
  view_count_str: string
  like_count_str: string
  duration_str: string
  upload_date: string
}

interface AnalysisData {
  summary: any
  implementation: any
  applications: any
  business_plan: any
  critical_analysis: any
}

function ScoreRing({ score }: { score: number }) {
  const r = 38
  const circumference = 2 * Math.PI * r
  const offset = circumference - (score / 100) * circumference

  const color =
    score >= 75 ? '#4A8A5E' : score >= 55 ? '#C47A45' : '#C45050'

  return (
    <div className="score-ring-wrapper">
      <svg className="score-ring-svg" viewBox="0 0 100 100">
        <circle className="score-ring-track" cx="50" cy="50" r={r} />
        <circle
          className="score-ring-fill"
          cx="50"
          cy="50"
          r={r}
          stroke={color}
          strokeDasharray={circumference}
          strokeDashoffset={offset}
        />
      </svg>
      <div className="score-text">
        <div className="score-num" style={{ color }}>{score}</div>
        <div className="score-label">/ 100</div>
      </div>
    </div>
  )
}

function SummaryTab({ data }: { data: any }) {
  if (!data) return null
  return (
    <div>
      <h2 className="section-title" style={{ color: 'var(--tab-summary)' }}>
        핵심 내용 요약
      </h2>

      {data.one_line && (
        <div className="one-liner">"{data.one_line}"</div>
      )}

      {data.keywords?.length > 0 && (
        <div className="keywords-row">
          {data.keywords.map((kw: string, i: number) => (
            <span key={i} className="keyword-chip"># {kw}</span>
          ))}
        </div>
      )}

      <p className="sub-section-title">핵심 포인트</p>
      <ul className="points-list">
        {data.points?.map((pt: string, i: number) => (
          <li key={i} className="point-item">
            <span className="point-num">{i + 1}</span>
            <span className="point-text">{pt}</span>
          </li>
        ))}
      </ul>
    </div>
  )
}

function ImplementationTab({ data }: { data: any }) {
  if (!data) return null
  return (
    <div>
      <h2 className="section-title" style={{ color: 'var(--tab-impl)' }}>
        실행 방법
      </h2>

      {data.overview && (
        <div className="overview-box">{data.overview}</div>
      )}

      <p className="sub-section-title">단계별 실행 계획</p>
      <div className="steps-list">
        {data.steps?.map((s: any, i: number) => (
          <div key={i} className="step-card">
            <div className="step-num-badge">{s.step || i + 1}</div>
            <div className="step-content">
              <div className="step-title">{s.title}</div>
              <div className="step-desc">{s.description}</div>
              {s.tips && (
                <div className="step-tip"><span>{s.tips}</span></div>
              )}
            </div>
          </div>
        ))}
      </div>

      {data.requirements?.length > 0 && (
        <>
          <p className="sub-section-title">필요한 것들</p>
          <div className="requirements-grid">
            {data.requirements.map((r: string, i: number) => (
              <div key={i} className="req-item">+ {r}</div>
            ))}
          </div>
        </>
      )}

      {data.timeline && (
        <div className="timeline-box">
          예상 기간: {data.timeline}
        </div>
      )}
    </div>
  )
}

function ApplicationsTab({ data }: { data: any }) {
  if (!data) return null
  return (
    <div>
      <h2 className="section-title" style={{ color: 'var(--tab-app)' }}>
        응용 분야
      </h2>

      <p className="sub-section-title">산업별 활용 사례</p>
      <div className="industries-grid">
        {data.industries?.map((ind: any, i: number) => (
          <div key={i} className="industry-card">
            <div className="industry-header">
              <span className="industry-name">{ind.name}</span>
              <span className={`potential-badge potential-${ind.potential}`}>
                {ind.potential}
              </span>
            </div>
            <div className="industry-usecase">{ind.use_case}</div>
          </div>
        ))}
      </div>

      {data.target_users?.length > 0 && (
        <>
          <p className="sub-section-title">주요 대상 사용자</p>
          <div className="keywords-row" style={{ marginBottom: '20px' }}>
            {data.target_users.map((u: string, i: number) => (
              <span key={i} className="keyword-chip">{u}</span>
            ))}
          </div>
        </>
      )}

      {data.trend_connection && (
        <>
          <p className="sub-section-title">트렌드 연결</p>
          <div className="trend-box">{data.trend_connection}</div>
        </>
      )}
    </div>
  )
}

function BusinessPlanTab({ data }: { data: any }) {
  if (!data) return null
  return (
    <div>
      <h2 className="section-title" style={{ color: 'var(--tab-biz)' }}>
        사업 기획
      </h2>

      <div className="biz-concept">
        <div className="biz-concept-label">사업 컨셉</div>
        <div className="biz-concept-text">{data.concept}</div>
      </div>

      <div className="biz-grid">
        <div className="biz-card">
          <div className="biz-card-label">핵심 가치 제안</div>
          <div className="biz-card-value">{data.value_proposition}</div>
        </div>
        <div className="biz-card">
          <div className="biz-card-label">목표 시장</div>
          <div className="biz-card-value">{data.target_market}</div>
        </div>
        <div className="biz-card">
          <div className="biz-card-label">수익 모델</div>
          <ul className="biz-list">
            {data.revenue_model?.map((r: string, i: number) => (
              <li key={i}>{r}</li>
            ))}
          </ul>
        </div>
        <div className="biz-card">
          <div className="biz-card-label">핵심 활동</div>
          <ul className="biz-list">
            {data.key_activities?.map((a: string, i: number) => (
              <li key={i}>{a}</li>
            ))}
          </ul>
        </div>
      </div>

      <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap', alignItems: 'center' }}>
        {data.initial_investment && (
          <div className="investment-box">
            초기 투자: {data.initial_investment}
          </div>
        )}
      </div>

      {data.go_to_market && (
        <>
          <p className="sub-section-title" style={{ marginTop: '20px' }}>시장 진입 전략</p>
          <div className="overview-box" style={{
            background: 'var(--mint-dim)',
            borderColor: 'var(--mint-border)',
            borderLeftColor: 'var(--mint)'
          }}>
            {data.go_to_market}
          </div>
        </>
      )}
    </div>
  )
}

function CriticalTab({ data }: { data: any }) {
  if (!data) return null
  const score = data.overall_score || 50

  return (
    <div>
      <h2 className="section-title" style={{ color: 'var(--tab-critical)' }}>
        냉철한 사업 분석
      </h2>

      <div className="score-section">
        <ScoreRing score={score} />
        <div className="score-verdict">
          <strong>종합 점수: {score}점</strong>
          {data.verdict}
        </div>
      </div>

      <p className="sub-section-title">SWOT 분석</p>
      <div className="swot-grid">
        <div className="swot-card swot-strengths">
          <div className="swot-header">강점</div>
          <ul className="swot-list">
            {data.strengths?.map((s: string, i: number) => <li key={i}>{s}</li>)}
          </ul>
        </div>
        <div className="swot-card swot-weaknesses">
          <div className="swot-header">약점</div>
          <ul className="swot-list">
            {data.weaknesses?.map((s: string, i: number) => <li key={i}>{s}</li>)}
          </ul>
        </div>
        <div className="swot-card swot-opportunities">
          <div className="swot-header">기회</div>
          <ul className="swot-list">
            {data.opportunities?.map((s: string, i: number) => <li key={i}>{s}</li>)}
          </ul>
        </div>
        <div className="swot-card swot-threats">
          <div className="swot-header">위협</div>
          <ul className="swot-list">
            {data.threats?.map((s: string, i: number) => <li key={i}>{s}</li>)}
          </ul>
        </div>
      </div>

      {data.competition && (
        <>
          <p className="sub-section-title">경쟁 환경</p>
          <div className="overview-box" style={{
            background: 'var(--orange-dim)',
            borderColor: 'var(--orange-border)',
            borderLeftColor: 'var(--orange)'
          }}>{data.competition}</div>
        </>
      )}

      {data.profitability && (
        <>
          <p className="sub-section-title">수익성 분석</p>
          <div className="overview-box" style={{
            background: 'var(--orange-dim)',
            borderColor: 'var(--orange-border)',
            borderLeftColor: 'var(--orange)'
          }}>{data.profitability}</div>
        </>
      )}

      {data.risks?.length > 0 && (
        <>
          <p className="sub-section-title">주요 리스크</p>
          <div className="risks-list">
            {data.risks.map((r: any, i: number) => (
              <div key={i} className="risk-card">
                <span className={`risk-severity severity-${r.severity}`}>{r.severity}</span>
                <div className="risk-info">
                  <div className="risk-name">{r.risk}</div>
                  <div className="risk-mitigation">대응: {r.mitigation}</div>
                </div>
              </div>
            ))}
          </div>
        </>
      )}

      {data.recommendation && (
        <div className="recommendation-box">
          <div className="rec-label">최종 권고사항</div>
          <div className="rec-text">{data.recommendation}</div>
        </div>
      )}
    </div>
  )
}

export default function App() {
  const [url, setUrl] = useState('')
  const [apiKey, setApiKey] = useState('')
  const [showApiKey, setShowApiKey] = useState(false)
  const [provider, setProvider] = useState<'gemini' | 'openrouter'>('gemini')
  const [selectedModel, setSelectedModel] = useState('google/gemini-2.5-flash')
  const [loadingStep, setLoadingStep] = useState<LoadingStep>('idle')
  const [videoMeta, setVideoMeta] = useState<VideoMeta | null>(null)
  const [analysis, setAnalysis] = useState<AnalysisData | null>(null)
  const [activeTab, setActiveTab] = useState('summary')
  const [error, setError] = useState('')
  const [keySaved, setKeySaved] = useState(false)
  const [saveToast, setSaveToast] = useState('')
  const analysisRef = useRef<HTMLDivElement>(null)

  // 앱 시작 시 저장된 API 키 불러오기
  useEffect(() => {
    const saved = localStorage.getItem(STORAGE_KEYS[provider])
    if (saved) {
      setApiKey(saved)
      setKeySaved(true)
    } else {
      setApiKey('')
      setKeySaved(false)
    }
  }, [provider])

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

  const isLoading = loadingStep !== 'idle' && loadingStep !== 'done'

  const handleAnalyze = async () => {
    if (!url.trim()) return
    setError('')
    setAnalysis(null)
    setVideoMeta(null)

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
        }),
      })
      if (!analyzeRes.ok) {
        const err = await analyzeRes.json()
        throw new Error(err.detail || 'AI 분석에 실패했습니다.')
      }
      const analyzeData = await analyzeRes.json()
      setAnalysis(analyzeData.analysis)
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

  const handleExportMarkdown = () => {
    if (!analysis || !videoMeta) return
    const lines: string[] = [
      `# 유튜브 분석 결과`,
      ``,
      `**영상**: ${videoMeta.title}`,
      `**채널**: ${videoMeta.channel}`,
      `**분석일**: ${new Date().toLocaleDateString('ko-KR')}`,
      ``,
      `---`,
      ``,
      `## 핵심 내용`,
      ``,
      `> ${analysis.summary?.one_line}`,
      ``,
      `### 키워드`,
      (analysis.summary?.keywords || []).map((k: string) => `\`${k}\``).join(' '),
      ``,
      `### 핵심 포인트`,
      ...(analysis.summary?.points || []).map((p: string, i: number) => `${i + 1}. ${p}`),
      ``,
      `---`,
      ``,
      `## 실행 방법`,
      ``,
      analysis.implementation?.overview || '',
      ``,
      ...(analysis.implementation?.steps || []).map((s: any) =>
        `### ${s.step}단계: ${s.title}\n${s.description}\n${s.tips}\n`
      ),
      `---`,
      ``,
      `## 사업 기획`,
      ``,
      `**컨셉**: ${analysis.business_plan?.concept}`,
      `**가치 제안**: ${analysis.business_plan?.value_proposition}`,
      `**목표 시장**: ${analysis.business_plan?.target_market}`,
      ``,
      `---`,
      ``,
      `## 냉철한 사업 분석`,
      ``,
      `**종합 점수**: ${analysis.critical_analysis?.overall_score}/100`,
      `**평가**: ${analysis.critical_analysis?.verdict}`,
      ``,
      `**최종 권고**: ${analysis.critical_analysis?.recommendation}`,
    ]
    const content = lines.join('\n')
    const blob = new Blob([content], { type: 'text/markdown;charset=utf-8' })
    const a = document.createElement('a')
    a.href = URL.createObjectURL(blob)
    a.download = `유튜브분석_${new Date().toISOString().slice(0,10)}.md`
    a.click()
  }

  const loadingStepsList = [
    { id: 'fetching-info', label: '영상 정보 수집' },
    { id: 'analyzing',     label: 'AI 심층 분석' },
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
      {/* Background */}
      <div className="app-background">
        <div className="bg-orb bg-orb-1" />
        <div className="bg-orb bg-orb-2" />
        <div className="bg-orb bg-orb-3" />
      </div>

      <div className="app-container">
        {/* Header */}
        <header className="app-header">
          <div className="logo-wrapper">
            <div className="logo-icon">YT</div>
            <h1 className="app-title">유튜브 <span>AI</span> 분석기</h1>
          </div>
          <p className="app-subtitle">URL 하나로 핵심 내용 · 실행 방법 · 사업 기획까지 AI가 분석합니다</p>
        </header>

        {/* Input Section */}
        <section className="input-section">
          <p className="input-section-title">유튜브 URL 입력</p>
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
              onClick={handleAnalyze}
              disabled={isLoading || !url.trim()}
            >
              {isLoading ? '분석 중...' : '분석 시작'}
            </button>
          </div>

          {/* Provider Selection */}
          <div className="provider-section">
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

          {/* API Key */}
          <div className="api-key-section">
            <div className="api-key-label-row">
              <span className="api-key-label">
                {provider === 'gemini' ? 'Gemini' : 'OpenRouter'} API 키
              </span>
              {keySaved && (
                <span className="key-saved-badge">저장됨</span>
              )}
            </div>
            <div className="api-key-input-wrapper">
              <input
                id="api-key-input"
                className="api-key-input"
                type={showApiKey ? 'text' : 'password'}
                placeholder={provider === 'gemini' ? 'AIza... (없으면 .env 파일 사용)' : 'sk-or-... (OpenRouter API Key)'}
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
                {provider === 'gemini' ? '무료 발급' : 'OpenRouter 키 발급'} →
              </a>
              <span className="api-key-hint">키는 이 브라우저에만 저장됩니다</span>
            </div>
            {saveToast && (
              <div className="save-toast">{saveToast}</div>
            )}
          </div>

          {/* Model Selection (OpenRouter only) */}
          {provider === 'openrouter' && (
            <div className="model-section">
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
              <span className="model-hint">Gemini 2.5 Flash가 빠르고 저렴합니다</span>
            </div>
          )}
        </section>

        {/* Error */}
        {error && (
          <div className="error-box">
            <span className="error-icon">!</span>
            <div>
              <strong>오류 발생</strong><br />
              {error}
            </div>
          </div>
        )}

        {/* Loading */}
        {isLoading && (
          <div className="loading-section">
            <div className="loading-spinner" />
            <p style={{ color: 'var(--text-secondary)', marginBottom: '4px', fontSize: '0.9rem' }}>
              AI가 영상을 분석하고 있습니다...
            </p>
            <p style={{ color: 'var(--text-muted)', marginBottom: '8px', fontSize: '0.78rem' }}>
              첫 요청은 서버 준비로 30초~1분 소요될 수 있습니다
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
              <img className="video-thumbnail" src={videoMeta.thumbnail} alt="썸네일" />
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

        {/* Analysis Result */}
        {analysis && (
          <div ref={analysisRef} className="tabs-wrapper">
            <div className="export-bar">
              <button className="export-btn" onClick={handleExportMarkdown} id="export-md-btn">
                Markdown 저장
              </button>
            </div>
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

            <div className="tab-content" role="tabpanel">
              {activeTab === 'summary'        && <SummaryTab data={analysis.summary} />}
              {activeTab === 'implementation' && <ImplementationTab data={analysis.implementation} />}
              {activeTab === 'applications'   && <ApplicationsTab data={analysis.applications} />}
              {activeTab === 'business'       && <BusinessPlanTab data={analysis.business_plan} />}
              {activeTab === 'critical'       && <CriticalTab data={analysis.critical_analysis} />}
            </div>
          </div>
        )}
      </div>
    </>
  )
}
