import { useState, useEffect, useRef } from 'react'

const API = '/api'

export default function App() {
  const [messages, setMessages] = useState([
    { role: 'assistant', content: '👋 Hi! I am your personal AI. Upload documents and ask me anything about them — I remember everything even after restart!' }
  ])
  const [input, setInput] = useState('')
  const [model, setModel] = useState('mistral')
  const [models, setModels] = useState([])
  const [docs, setDocs] = useState([])
  const [uploading, setUploading] = useState(false)
  const [loading, setLoading] = useState(false)
  const [tab, setTab] = useState('chat')
  const [pullModel, setPullModel] = useState('mistral')
  const [pulling, setPulling] = useState(false)
  const [pullStatus, setPullStatus] = useState('')
  const bottomRef = useRef()
  const streamRef = useRef('')

  useEffect(() => { fetchModels(); fetchDocs() }, [])
  useEffect(() => { bottomRef.current?.scrollIntoView({ behavior: 'smooth' }) }, [messages])

  async function fetchModels() {
    try {
      const r = await fetch(`${API}/models`)
      const data = await r.json()
      const list = (data.models || []).map(m => m.name)
      setModels(list)
      if (list.length > 0) setModel(list[0])
    } catch { setModels([]) }
  }

  async function fetchDocs() {
    try {
      const r = await fetch(`${API}/documents`)
      const data = await r.json()
      setDocs(data.documents || [])
    } catch {}
  }

  async function handleUpload(e) {
    const file = e.target.files[0]
    if (!file) return
    setUploading(true)
    const fd = new FormData()
    fd.append('file', file)
    try {
      const r = await fetch(`${API}/upload`, { method: 'POST', body: fd })
      const data = await r.json()
      alert(data.message)
      fetchDocs()
    } catch { alert('Upload failed') }
    setUploading(false)
    e.target.value = ''
  }

  async function handleDelete(name) {
    if (!confirm(`Delete "${name}" from index?`)) return
    try {
      const r = await fetch(`${API}/document/${encodeURIComponent(name)}`, { method: 'DELETE' })
      const data = await r.json()
      alert(data.message)
      fetchDocs()
    } catch { alert('Delete failed') }
  }

  async function handleSend() {
    if (!input.trim() || loading) return
    const userMsg = { role: 'user', content: input }
    const history = [...messages, userMsg]
    setMessages([...history, { role: 'assistant', content: '⏳', streaming: true }])
    setInput('')
    setLoading(true)
    streamRef.current = ''

    try {
      const resp = await fetch(`${API}/chat`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: input, model, history: messages.slice(-12), stream: true })
      })

      const reader = resp.body.getReader()
      const decoder = new TextDecoder()
      let sources = []
      let firstChunk = true

      while (true) {
        const { done, value } = await reader.read()
        if (done) break
        const text = decoder.decode(value)
        const lines = text.split('\n').filter(l => l.startsWith('data: '))

        for (const line of lines) {
          const raw = line.slice(6).trim()
          if (raw === '[DONE]') break
          try {
            const data = JSON.parse(raw)
            if (firstChunk && data.sources !== undefined) {
              sources = data.sources
              firstChunk = false
              continue
            }
            if (data.token) {
              streamRef.current += data.token
              setMessages(prev => {
                const updated = [...prev]
                updated[updated.length - 1] = {
                  role: 'assistant',
                  content: streamRef.current,
                  streaming: true,
                  sources
                }
                return updated
              })
            }
            if (data.error) {
              streamRef.current = '❌ ' + data.error
            }
          } catch {}
        }
      }

      setMessages(prev => {
        const updated = [...prev]
        updated[updated.length - 1] = {
          role: 'assistant',
          content: streamRef.current || '(empty response)',
          streaming: false,
          sources
        }
        return updated
      })
    } catch (e) {
      setMessages(prev => {
        const updated = [...prev]
        updated[updated.length - 1] = { role: 'assistant', content: '❌ Error: ' + e.message }
        return updated
      })
    }
    setLoading(false)
  }

  async function handlePull() {
    setPulling(true)
    setPullStatus('⏳ Starting download...')
    try {
      const resp = await fetch(`${API}/pull-model?model=${pullModel}`, { method: 'POST' })
      const reader = resp.body.getReader()
      const decoder = new TextDecoder()
      while (true) {
        const { done, value } = await reader.read()
        if (done) break
        const lines = decoder.decode(value).split('\n').filter(l => l.startsWith('data: '))
        for (const line of lines) {
          try {
            const data = JSON.parse(line.slice(6))
            if (data.error) { setPullStatus("❌ " + data.error); break }
            if (data.status === "done") { setPullStatus("✅ Done! Model ready."); fetchModels(); break }
            const pct = data.completed && data.total ? " " + Math.round(data.completed/data.total*100) + "%" : ""
            setPullStatus("⏳ " + (data.status || "downloading") + pct)
          } catch {}
        }
      }
    } catch(e) { setPullStatus("❌ " + e.message) }
    setPulling(false)
  }

  const s = {
    app: { fontFamily: 'system-ui,sans-serif', display: 'flex', flexDirection: 'column', height: '100vh', background: '#0f0f0f', color: '#e0e0e0' },
    header: { display: 'flex', alignItems: 'center', gap: 12, padding: '12px 20px', background: '#1a1a2e', borderBottom: '1px solid #333' },
    logo: { fontSize: 22, fontWeight: 700, color: '#7c6fcd' },
    tabs: { display: 'flex', gap: 6, marginLeft: 'auto' },
    tab: a => ({ padding: '6px 14px', borderRadius: 8, border: 'none', cursor: 'pointer', fontWeight: 600, background: a ? '#7c6fcd' : '#2a2a3e', color: a ? '#fff' : '#aaa' }),
    body: { display: 'flex', flex: 1, overflow: 'hidden' },
    sidebar: { width: 230, background: '#1a1a2e', borderRight: '1px solid #333', padding: 16, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 6 },
    sideTitle: { fontSize: 11, color: '#888', fontWeight: 700, textTransform: 'uppercase', letterSpacing: 1, marginBottom: 4 },
    uploadBtn: { width: '100%', padding: '9px', borderRadius: 8, background: '#7c6fcd', color: '#fff', border: 'none', cursor: 'pointer', fontWeight: 700, fontSize: 13 },
    docRow: { display: 'flex', alignItems: 'center', gap: 6, background: '#2a2a3e', borderRadius: 8, padding: '6px 8px' },
    docName: { fontSize: 12, flex: 1, wordBreak: 'break-all', color: '#ccc' },
    docChunks: { fontSize: 10, color: '#666', whiteSpace: 'nowrap' },
    delBtn: { background: 'none', border: 'none', cursor: 'pointer', color: '#f87171', fontSize: 14, lineHeight: 1, padding: '0 2px' },
    chat: { flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' },
    msgs: { flex: 1, overflowY: 'auto', padding: '20px 24px', display: 'flex', flexDirection: 'column', gap: 14 },
    bubble: role => ({ alignSelf: role === 'user' ? 'flex-end' : 'flex-start', maxWidth: '78%', padding: '11px 15px', borderRadius: role === 'user' ? '18px 18px 4px 18px' : '18px 18px 18px 4px', background: role === 'user' ? '#7c6fcd' : '#1e1e2e', lineHeight: 1.6, fontSize: 14, whiteSpace: 'pre-wrap' }),
    cursor: { display: 'inline-block', width: 8, height: 14, background: '#7c6fcd', marginLeft: 2, animation: 'blink 1s infinite', verticalAlign: 'text-bottom' },
    src: { fontSize: 11, color: '#7c6fcd', marginTop: 5, opacity: 0.8 },
    inputRow: { display: 'flex', gap: 8, padding: '12px 20px', background: '#1a1a2e', borderTop: '1px solid #333' },
    sel: { padding: '9px', borderRadius: 8, background: '#2a2a3e', color: '#e0e0e0', border: '1px solid #444', fontSize: 13 },
    inp: { flex: 1, padding: '10px 14px', borderRadius: 10, border: '1px solid #444', background: '#0f0f0f', color: '#e0e0e0', fontSize: 14, outline: 'none' },
    sendBtn: { padding: '10px 20px', borderRadius: 10, background: loading ? '#4a3a8c' : '#7c6fcd', color: '#fff', border: 'none', cursor: loading ? 'not-allowed' : 'pointer', fontWeight: 700 },
    settings: { flex: 1, padding: 30, overflowY: 'auto' },
    card: { background: '#1a1a2e', borderRadius: 14, padding: 22, marginBottom: 20, maxWidth: 520 },
    cardTitle: { fontWeight: 700, marginBottom: 12, color: '#7c6fcd', fontSize: 16 },
    sinp: { width: '100%', padding: '9px 12px', borderRadius: 8, background: '#0f0f0f', border: '1px solid #444', color: '#e0e0e0', fontSize: 14, boxSizing: 'border-box' },
    sbtn: { marginTop: 10, padding: '9px 20px', borderRadius: 8, background: '#7c6fcd', color: '#fff', border: 'none', cursor: 'pointer', fontWeight: 700 },
    badge: { display: 'inline-block', padding: '2px 8px', borderRadius: 20, background: '#2a2a3e', fontSize: 11, color: '#aaa', marginBottom: 8 },
  }

  return (
    <div style={s.app}>
      <style>{`@keyframes blink { 0%,100%{opacity:1} 50%{opacity:0} }`}</style>
      <div style={s.header}>
        <span style={s.logo}>🤖 MyAI</span>
        <span style={{ fontSize: 12, color: '#666' }}>Local · Private · Free</span>
        <div style={s.tabs}>
          <button style={s.tab(tab === 'chat')} onClick={() => setTab('chat')}>💬 Chat</button>
          <button style={s.tab(tab === 'settings')} onClick={() => setTab('settings')}>⚙️ Settings</button>
        </div>
      </div>

      <div style={s.body}>
        {tab === 'chat' && (<>
          <div style={s.sidebar}>
            <div style={s.sideTitle}>📂 Documents</div>
            <label>
              <input type="file" hidden onChange={handleUpload}
                accept=".pdf,.docx,.txt,.csv,.xlsx,.xls,.json,.md,.png,.jpg,.jpeg" />
              <div style={s.uploadBtn}>{uploading ? '⏳ Uploading...' : '+ Upload File'}</div>
            </label>
            {docs.length === 0
              ? <div style={{ fontSize: 12, color: '#555', marginTop: 8 }}>No documents yet.<br />Upload a file to get started!</div>
              : docs.map((d, i) => (
                <div key={i} style={s.docRow}>
                  <span style={{ fontSize: 13 }}>📄</span>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={s.docName}>{d.name}</div>
                    <div style={s.docChunks}>{d.chunks} chunks</div>
                  </div>
                  <button style={s.delBtn} title="Remove from index" onClick={() => handleDelete(d.name)}>✕</button>
                </div>
              ))
            }
          </div>

          <div style={s.chat}>
            <div style={s.msgs}>
              {messages.map((m, i) => (
                <div key={i} style={s.bubble(m.role)}>
                  {m.content}
                  {m.streaming && <span style={s.cursor} />}
                  {m.sources?.length > 0 && (
                    <div style={s.src}>📎 {m.sources.join(' · ')}</div>
                  )}
                </div>
              ))}
              <div ref={bottomRef} />
            </div>
            <div style={s.inputRow}>
              <select style={s.sel} value={model} onChange={e => setModel(e.target.value)}>
                {models.length === 0 && <option value="mistral">mistral (pull first)</option>}
                {models.map(m => <option key={m} value={m}>{m}</option>)}
              </select>
              <input style={s.inp} value={input} onChange={e => setInput(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && !e.shiftKey && handleSend()}
                placeholder="Ask anything... (Enter to send)" disabled={loading} />
              <button style={s.sendBtn} onClick={handleSend} disabled={loading}>
                {loading ? '⏳' : 'Send ➤'}
              </button>
            </div>
          </div>
        </>)}

        {tab === 'settings' && (
          <div style={s.settings}>
            <h2 style={{ color: '#7c6fcd', marginTop: 0 }}>⚙️ Settings</h2>

            <div style={s.card}>
              <div style={s.cardTitle}>📥 Download AI Model</div>
              <p style={{ fontSize: 13, color: '#999', margin: '0 0 12px' }}>
                Choose a model to download. Smaller = faster on CPU.
              </p>
              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 12 }}>
                {['phi3', 'mistral', 'llama3', 'gemma2'].map(m => (
                  <button key={m} style={{ ...s.sbtn, marginTop: 0, background: pullModel === m ? '#7c6fcd' : '#2a2a3e', fontSize: 12 }}
                    onClick={() => setPullModel(m)}>{m}</button>
                ))}
              </div>
              <input style={s.sinp} value={pullModel} onChange={e => setPullModel(e.target.value)} placeholder="or type custom model name" />
              <br />
              <button style={s.sbtn} onClick={handlePull} disabled={pulling}>
                {pulling ? '⏳ Downloading...' : '⬇️ Pull Model'}
              </button>
              {pullStatus && <div style={{ marginTop: 10, fontSize: 13, color: '#aaa' }}>{pullStatus}</div>}
            </div>

            <div style={s.card}>
              <div style={s.cardTitle}>🧠 Downloaded Models</div>
              {models.length === 0
                ? <div style={{ fontSize: 13, color: '#666' }}>None yet — pull one above!</div>
                : models.map(m => <div key={m} style={{ ...s.badge, display: 'block', marginBottom: 6 }}>🧠 {m}</div>)
              }
              <button style={{ ...s.sbtn }} onClick={fetchModels}>🔄 Refresh</button>
            </div>

            <div style={s.card}>
              <div style={s.cardTitle}>✅ What's Fixed vs v1</div>
              <div style={{ fontSize: 13, color: '#aaa', lineHeight: 2 }}>
                ✅ NumPy 2.x crash → fixed (pinned numpy 1.26)<br />
                ✅ FAISS index now <b>persists across restarts</b><br />
                ✅ Embedding cache (no recomputing same file)<br />
                ✅ <b>Streaming responses</b> (token by token, like ChatGPT)<br />
                ✅ Better prompt engineering (accurate answers)<br />
                ✅ Fixed source attribution (no duplicate bug)<br />
                ✅ Delete documents from index<br />
                ✅ Duplicate upload detection
              </div>
            </div>

            <div style={s.card}>
              <div style={s.cardTitle}>📋 Supported File Types</div>
              <div style={{ fontSize: 13, color: '#aaa', lineHeight: 2 }}>
                📄 PDF · 📝 DOCX · 📊 CSV / XLSX · 📃 TXT / MD / JSON · 🖼️ PNG / JPG (OCR)
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
