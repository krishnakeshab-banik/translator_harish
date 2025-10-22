'use client'
import React, { useEffect, useRef, useState } from 'react'

export default function TranslatorClient(): JSX.Element {
  const [status, setStatus] = useState('Ready')
  const [detectedLang, setDetectedLang] = useState('—')
  const [translation, setTranslation] = useState('—')
  const inputRef = useRef<HTMLTextAreaElement | null>(null)
  const fileRef = useRef<HTMLInputElement | null>(null)
  const [recognizing, setRecognizing] = useState(false)
  const recogRef = useRef<any>(null)

  useEffect(() => {
    // prepare SpeechRecognition if available
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
          const res = evt.results[i]
          if (res.isFinal) final += res[0].transcript
          else interim += res[0].transcript
        }
        if (inputRef.current) {
          inputRef.current.value = (inputRef.current.value && inputRef.current.value.length > 0 ? inputRef.current.value + ' ' : '') + final + (interim ? ' ' + interim : '')
        }
      }
      recogRef.current = r
    }
  }, [])

  async function detectLanguage(text: string) {
    if (!text || !text.trim()) return null
    setStatus('Detecting language...')
    try {
      const res = await fetch('https://libretranslate.de/detect', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ q: text }),
      })
      const data = await res.json()
      if (Array.isArray(data) && data[0]) return data[0].language
    } catch (e) { console.error(e) }
    return null
  }

  async function translate(text: string, source: string | null, target: string) {
    setStatus('Translating...')
    try {
      const res = await fetch('https://libretranslate.de/translate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ q: text, source: source || 'auto', target, format: 'text' }),
      })
      const data = await res.json()
      return data && data.translatedText ? data.translatedText : null
    } catch (e) { console.error(e); return null }
  }

  function speak(text: string, lang?: string) {
    if (!('speechSynthesis' in window)) { setStatus('TTS not supported'); return }
    const utter = new SpeechSynthesisUtterance(text)
    if (lang) utter.lang = lang
    utter.rate = 1
    (window.speechSynthesis).cancel()
    (window.speechSynthesis).speak(utter)
  }

  function startSpeech() {
    const r = recogRef.current
    if (r && !recognizing) {
      try { r.start() } catch (e) { console.warn(e) }
    } else setStatus('Speech recognition not available')
  }
  function stopSpeech() {
    const r = recogRef.current
    if (r && recognizing) try { r.stop() } catch (e) { console.warn(e) }
  }

  async function onDetect() {
    const txt = inputRef.current?.value || ''
    const lang = await detectLanguage(txt)
    setDetectedLang(lang || 'unknown')
    setStatus('Language detection done')
  }

  async function onTranslate(target = 'en') {
    const txt = inputRef.current?.value || ''
    const detected = await detectLanguage(txt)
    setDetectedLang(detected || 'unknown')
    const translated = await translate(txt, detected || 'auto', target)
    setTranslation(translated || 'Translation failed')
    setStatus('Translation complete')
  }

  async function onSpeak() {
    const out = translation && translation !== '—' ? translation : (inputRef.current?.value || '')
    const lang = detectedLang && detectedLang !== '—' ? detectedLang : undefined
    speak(out, lang)
    setStatus('Speaking...')
  }

  async function loadTesseract() {
    // load Tesseract from CDN if not present
    if (!(window as any).Tesseract) {
      setStatus('Loading OCR engine...')
      await new Promise<void>((resolve, reject) => {
        const s = document.createElement('script')
        s.src = 'https://unpkg.com/tesseract.js@2.1.5/dist/tesseract.min.js'
        s.onload = () => resolve()
        s.onerror = () => reject()
        document.body.appendChild(s)
      })
    }
    return (window as any).Tesseract
  }

  async function onOCRAndTranslate(target = 'en') {
    const file = fileRef.current?.files?.[0]
    if (!file) { setStatus('Please select an image first'); return }
    setStatus('Recognizing text from image (OCR)...')
    try {
      const Tesseract = await loadTesseract()
      const worker = Tesseract.createWorker()
      await worker.load()
      await worker.loadLanguage('eng')
      await worker.initialize('eng')
      const { data: { text } } = await worker.recognize(file)
      await worker.terminate()
      if (inputRef.current) inputRef.current.value = text
      setStatus('OCR done. Detecting language...')
      const lang = await detectLanguage(text)
      setDetectedLang(lang || 'unknown')
      const translated = await translate(text, lang || 'auto', target)
      setTranslation(translated || 'Translation failed')
      setStatus('OCR + Translation complete')
    } catch (e) { console.error(e); setStatus('OCR failed') }
  }

  return (
    <section id="translator" className="card">
      <div className="row">
        <textarea ref={inputRef} id="inputText" placeholder="Type or speak here..." rows={4} />
        <div className="controls">
          <button type="button" onClick={startSpeech} disabled={!recogRef.current}>Start Speech</button>
          <button type="button" onClick={stopSpeech} disabled={!recogRef.current}>Stop</button>
          <button type="button" onClick={onDetect}>Detect Language</button>
          <select id="targetLang" defaultValue="en" aria-label="Target language">
            <option value="en">English</option>
            <option value="es">Spanish</option>
            <option value="fr">French</option>
            <option value="de">German</option>
            <option value="zh">Chinese (Simplified)</option>
            <option value="hi">Hindi</option>
          </select>
          <button type="button" onClick={() => onTranslate((document.getElementById('targetLang') as HTMLSelectElement).value)}>Translate</button>
          <button type="button" onClick={onSpeak}>Speak</button>
        </div>
      </div>

      <div style={{ marginTop: 12 }}>
        <label className="file-label">
          Upload image for OCR:
          <input ref={fileRef} id="imageInput" type="file" accept="image/*" />
        </label>
        <button type="button" onClick={() => onOCRAndTranslate((document.getElementById('targetLang') as HTMLSelectElement).value)}>Extract & Translate</button>
      </div>

      <div className="result">
        <h3>Detected Language: <span>{detectedLang}</span></h3>
        <h3>Translation:</h3>
        <pre className="output">{translation}</pre>
      </div>

      <div className="status">{status}</div>
    </section>
  )
}
