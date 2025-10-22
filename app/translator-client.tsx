'use client'
import React, { useEffect, useRef, useState } from 'react'
import { Button } from '@/components/ui/button'

// Constants outside component
const PORTS = [5002, 5003, 5004];
const BASE_URL = 'http://127.0.0.1';

export default function TranslatorClient(): JSX.Element {
  // Move useState inside component
  const [apiPort, setApiPort] = useState(PORTS[0]);
  const [status, setStatus] = useState('Ready')
  const [detectedLang, setDetectedLang] = useState<string>('—')
  const [translation, setTranslation] = useState<string>('—')
  const [history, setHistory] = useState<Array<{ src: string; dst: string }>>([])
  const inputRef = useRef<HTMLTextAreaElement | null>(null)
  const fileRef = useRef<HTMLInputElement | null>(null)
  const [recognizing, setRecognizing] = useState(false)
  const recogRef = useRef<any>(null)
  const [uploadProgress, setUploadProgress] = useState(0);

  // API URL derived from port
  const API_URL = `${BASE_URL}:${apiPort}`;

  async function findWorkingPort() {
    for (const port of PORTS) {
      try {
        const res = await fetch(`${BASE_URL}:${port}/`);
        if (res.ok) {
          setApiPort(port);
          return true;
        }
      } catch (e) {
        console.log(`Port ${port} not responding`);
      }
    }
    return false;
  }

  // Add port discovery effect
  useEffect(() => {
    findWorkingPort().then(found => {
      if (!found) {
        setStatus('Could not find running Python server');
      }
    });
  }, []);

  async function fetchWithTimeout(url: string, options: RequestInit = {}, timeout = 5000) {
    const controller = new AbortController();
    const id = setTimeout(() => controller.abort(), timeout);
    try {
      const response = await fetch(url, {
        ...options,
        signal: controller.signal,
      });
      clearTimeout(id);
      return response;
    } catch (error) {
      clearTimeout(id);
      throw error;
    }
  }

  async function fetchWithRetry(url: string, options: RequestInit = {}, retries = 3) {
    for (let i = 0; i < retries; i++) {
      try {
        const response = await fetchWithTimeout(url, {
          ...options,
          headers: {
            'Content-Type': 'application/json',
            ...options.headers,
          },
        });
        return response;
      } catch (error) {
        if (error.name === 'AbortError') {
          console.log(`Request timeout, attempt ${i + 1} of ${retries}`);
        }
        if (i === retries - 1) throw error;
        // Exponential backoff
        await new Promise(r => setTimeout(r, Math.min(1000 * Math.pow(2, i), 10000)));
      }
    }
    // should not reach here
    throw new Error('fetchWithRetry: exhausted retries')
  }

  useEffect(() => {
    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition
    if (SpeechRecognition) {
      const r = new SpeechRecognition()
      r.continuous = true
      r.interimResults = true
      r.onstart = () => { setRecognizing(true); setStatus('Listening...') }
      r.onend = () => { setRecognizing(false); setStatus('Stopped listening') }
      r.onerror = (e: any) => { console.error(e); setStatus('Speech recognition error') }
      r.onresult = (evt: any) => {
        let interim = ''
        let final = ''
        for (let i = evt.resultIndex; i < evt.results.length; i++) {
          const rr = evt.results[i]
          if (rr.isFinal) final += rr[0].transcript
          else interim += rr[0].transcript
        }
        if (inputRef.current) {
          inputRef.current.value =
            final +
            (interim ? ' ' + interim : '')
        }
      }
      recogRef.current = r
    }
    return () => { if (recogRef.current && recogRef.current.stop) recogRef.current.stop() }
  }, [])

  // add: network helper with retries/backoff
  async function fetchWithRetry(url: string, options: RequestInit = {}, retries = 3, backoff = 500) {
    for (let i = 0; i < retries; i++) {
      try {
        const res = await fetch(url, options)
        if (!res.ok) {
          // Non-network error (HTTP 4xx/5xx) - return as-is so caller can handle
          return res
        }
        return res
      } catch (err) {
        // network error, retry unless last attempt
        if (i === retries - 1) throw err
        await new Promise((r) => setTimeout(r, backoff * Math.pow(2, i)))
      }
    }
    // should not reach here
    throw new Error('fetchWithRetry: exhausted retries')
  }

  // add: online/offline detection
  useEffect(() => {
    function updateOnline() { setStatus(navigator.onLine ? 'Ready' : 'Offline — check network'); }
    window.addEventListener('online', updateOnline)
    window.addEventListener('offline', updateOnline)
    updateOnline()
    return () => {
      window.removeEventListener('online', updateOnline)
      window.removeEventListener('offline', updateOnline)
    }
  }, [])

  // updated detectLanguage to use fetchWithRetry and clearer errors
  async function detectLanguage(text: string) {
    if (!text || text.trim().length === 0) return null
    if (!navigator.onLine) { setStatus('Offline — please check your network'); return null }
    setStatus('Detecting language...')
    try {
      const res = await fetchWithRetry(`${API_URL}/detect`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ q: text }),
      }, 3, 400)
      
      if (!res?.ok) {
        const errorData = await res.json().catch(() => ({}))
        setStatus(`Detection failed: ${errorData.detail || 'Unknown error'}`)
        return null
      }
      
      const data = await res.json()
      if (Array.isArray(data) && data[0]) return data[0].language
    } catch (e) {
      console.error('detect exception', e)
      setStatus('Cannot reach language service (port 5001) — check Python server')
    }
    return null
  }

  // updated translateText to use fetchWithRetry and clearer errors
  async function translateText(text: string, source: string | null, target: string) {
    if (!text.trim()) return null;
    setStatus('Connecting to translation service...');
    
    try {
      const res = await fetchWithRetry(`${API_URL}/translate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          q: text, 
          source: source || 'auto', 
          target 
        }),
      });

      const data = await res.json();
      
      if (data.error) {
        setStatus(`Translation failed: ${data.error}`);
        return null;
      }

      if (!data.translatedText) {
        setStatus('Translation returned empty result');
        return null;
      }

      setStatus('Translation complete');
      return data.translatedText;
    } catch (e) {
      console.error('Translation error:', e);
      setStatus('Translation service error - check if Python server is running');
      return null;
    }
  }

  // add: quick backend connectivity test
  async function testBackend() {
    setStatus('Testing backend connectivity...')
    try {
      if (!navigator.onLine) { 
        setStatus('Offline — check your network'); 
        return; 
      }
      
      const portFound = await findWorkingPort();
      if (!portFound) {
        setStatus('Could not find running Python server on any port');
        return;
      }

      const res = await fetchWithRetry(`${API_URL}/`, { method: 'GET' }, 2, 300)
      if (!res) { setStatus('No response from backend'); return }
      if (!res.ok) {
        setStatus('Backend responded with error')
        console.error('backend test error', res.status, await res.text().catch(()=>null))
        return
      }
      const data = await res.json().catch(()=>null)
      setStatus(data?.status === 'ok' ? 'Backend reachable' : 'Backend reachable (unexpected response)')
    } catch (e) {
      console.error('backend test exception', e)
      setStatus('Backend unreachable — start Python server and ensure firewall allows localhost:5000')
    }
  }

  function speak(text: string, lang?: string | null) {
    if (!('speechSynthesis' in window)) { setStatus('TTS not supported'); return }
    const utter = new SpeechSynthesisUtterance(text)
    if (lang) utter.lang = lang
    utter.rate = 1
    window.speechSynthesis.cancel()
    window.speechSynthesis.speak(utter)
  }

  async function loadTesseract() {
    if ((window as any).Tesseract) return (window as any).Tesseract
    return new Promise<any>((resolve) => {
      const s = document.createElement('script')
      s.src = 'https://unpkg.com/tesseract.js@2.1.5/dist/tesseract.min.js'
      s.async = true
      s.onload = () => resolve((window as any).Tesseract)
      s.onerror = () => resolve(null)
      document.body.appendChild(s)
    })
  }

  async function handleDetect() {
    const txt = inputRef.current?.value || ''
    const lang = await detectLanguage(txt)
    setDetectedLang(lang || 'unknown')
    setStatus('Language detection done')
  }

  async function handleTranslate() {
    const txt = inputRef.current?.value || ''
    if (!txt.trim()) {
      setStatus('Please enter text to translate')
      return
    }

    const target = (document.getElementById('targetLang') as HTMLSelectElement).value
    setStatus('Detecting language...')
    
    try {
      const detected = await detectLanguage(txt)
      setDetectedLang(detected || 'unknown')
      
      const translated = await translateText(txt, detected || 'auto', target)
      if (translated) {
        setTranslation(translated)
        setHistory(h => [{ src: txt, dst: translated }, ...h].slice(0, 10))
      } else {
        setTranslation('Translation failed')
      }
    } catch (e) {
      console.error('Translation flow error:', e)
      setStatus('Translation failed - please try again')
    }
  }

  function handleSpeak() {
    const out = translation && translation !== '—' ? translation : (inputRef.current?.value || '')
    const lang = detectedLang && detectedLang !== '—' ? detectedLang : (document.getElementById('targetLang') as HTMLSelectElement).value
    speak(out, lang)
    setStatus('Speaking...')
  }

  function startSpeech() {
    if (recogRef.current && !recognizing) {
      try { recogRef.current.start() } catch (e) { /* ignore */ }
    } else setStatus('Speech recognition not available')
  }
  function stopSpeech() {
    if (recogRef.current && recognizing) {
      try { recogRef.current.stop() } catch (e) { /* ignore */ }
    }
  }

  async function handleOCRAndTranslate() {
    const file = fileRef.current?.files && fileRef.current.files[0]
    if (!file) { setStatus('Please select an image first'); return }
    setStatus('Recognizing text from image (OCR)...')
    try {
      const Tesseract = await loadTesseract()
      if (!Tesseract) { setStatus('Failed to load OCR engine'); return }
      const { createWorker } = Tesseract
      const worker = createWorker({ logger: () => {} })
      await worker.load()
      await worker.loadLanguage('eng')
      await worker.initialize('eng')
      const { data: { text } } = await worker.recognize(file)
      await worker.terminate()
      if (inputRef.current) inputRef.current.value = text
      setStatus('OCR done. Detecting language...')
      const lang = await detectLanguage(text)
      setDetectedLang(lang || 'unknown')
      const target = (document.getElementById('targetLang') as HTMLSelectElement).value
      const translated = await translateText(text, lang || 'auto', target)
      setTranslation(translated || 'Translation failed')
      if (translated) setHistory(h => [{ src: text, dst: translated }, ...h].slice(0, 10))
      setStatus('OCR + Translation complete')
    } catch (e) {
      console.error(e)
      setStatus('OCR failed')
    }
  }

  function clearInput() {
    if (inputRef.current) inputRef.current.value = ''
    setTranslation('—')
    setDetectedLang('—')
    setStatus('Ready')
  }

  // minimal UI change: add Test Backend button near controls
  return (
    <div className="translator">
      <div className="toolbar">
        <div className="left">
          <Button variant="ghost" onClick={clearInput}>Clear</Button>
          <Button variant="ghost" onClick={testBackend}>Test Backend</Button>
          <span className="status muted">{status}</span>
        </div>
        <div className="right">
          <span className="muted">Detected: <strong>{detectedLang}</strong></span>
        </div>
      </div>

      <div className="content-grid">
        <div className="panel">
          <textarea 
            ref={inputRef}
            id="inputText"
            className="input-text"
            placeholder="Type or speak here..."
            rows={6}
          />

          <div className="controls-row">
            <div className="controls">
              <Button onClick={startSpeech} disabled={recognizing} variant="outline">Start</Button>
              <Button onClick={stopSpeech} disabled={!recognizing} variant="outline">Stop</Button>
              <Button onClick={handleDetect} variant="outline">Detect</Button>
              <select id="targetLang" className="select">
                <option value="en">English</option>
                <option value="es">Spanish</option>
                <option value="fr">French</option>
                <option value="de">German</option>
                <option value="zh">Chinese (Simplified)</option>
                <option value="hi">Hindi</option>
              </select>
              <Button 
                onClick={handleTranslate} 
                variant="default" 
                className="bg-gradient-to-r from-primary to-secondary hover:opacity-90 text-white font-semibold px-8"
                size="lg"
              >
                Translate →
              </Button>
              <Button onClick={handleSpeak} variant="outline">Speak</Button>
            </div>

            <div className="ocr">
              <label className="file-label">
                <input 
                  ref={fileRef}
                  id="imageInput"
                  type="file"
                  accept="image/*"
                  className="hidden"
                />
                <Button variant="outline" as="span">Upload Image</Button>
              </label>
              <Button onClick={handleOCRAndTranslate}>OCR → Translate</Button>
            </div>
          </div>
        </div>

        <div className="panel output-panel">
          <h4 className="panel-title">Translation</h4>
          <pre id="translationOutput" className="output">{translation}</pre>

          <h4 className="panel-title">History</h4>
          <ul className="history">
            {history.length === 0 && <li className="muted">No recent translations</li>}
            {history.map((h, i) => (
              <li key={i}>
                <div className="hist-src">{h.src}</div>
                <div className="hist-dst">{h.dst}</div>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </div>
  )
}