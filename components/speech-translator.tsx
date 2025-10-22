"use client"

import { useState, useRef } from "react"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"

const LANGUAGES = [
  { code: "en", name: "English" },
  { code: "es", name: "Spanish" },
  { code: "fr", name: "French" },
  { code: "de", name: "German" },
  { code: "it", name: "Italian" },
  { code: "pt", name: "Portuguese" },
  { code: "ru", name: "Russian" },
  { code: "ja", name: "Japanese" },
  { code: "ko", name: "Korean" },
  { code: "zh", name: "Chinese" },
  { code: "ar", name: "Arabic" },
  { code: "hi", name: "Hindi" },
]

export default function SpeechTranslator() {
  const [isRecording, setIsRecording] = useState(false)
  const [recognizedText, setRecognizedText] = useState("")
  const [translatedText, setTranslatedText] = useState("")
  const [detectedLang, setDetectedLang] = useState("en")
  const [targetLang, setTargetLang] = useState("es")
  const [loading, setLoading] = useState(false)
  const mediaRecorderRef = useRef<MediaRecorder | null>(null)
  const audioChunksRef = useRef<Blob[]>([])

  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
      const mediaRecorder = new MediaRecorder(stream)
      mediaRecorderRef.current = mediaRecorder
      audioChunksRef.current = []

      mediaRecorder.ondataavailable = (event) => {
        audioChunksRef.current.push(event.data)
      }

      mediaRecorder.onstop = async () => {
        const audioBlob = new Blob(audioChunksRef.current, { type: "audio/wav" })
        await processAudio(audioBlob)
        stream.getTracks().forEach((track) => track.stop())
      }

      mediaRecorder.start()
      setIsRecording(true)
    } catch (error) {
      console.error("Microphone access error:", error)
      alert("Please allow microphone access")
    }
  }

  const stopRecording = () => {
    if (mediaRecorderRef.current) {
      mediaRecorderRef.current.stop()
      setIsRecording(false)
    }
  }

  const processAudio = async (audioBlob: Blob) => {
    setLoading(true)
    try {
      const formData = new FormData()
      formData.append("audio", audioBlob)

      const response = await fetch("/api/speech-to-text", {
        method: "POST",
        body: formData,
      })

      const data = await response.json()
      setRecognizedText(data.text || "")
      setDetectedLang(data.detectedLang || "en")

      // Translate the recognized text
      if (data.text) {
        const translateResponse = await fetch("/api/translate", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            text: data.text,
            sourceLang: data.detectedLang || "en",
            targetLang,
          }),
        })

        const translateData = await translateResponse.json()
        setTranslatedText(translateData.translatedText || "")

        // Generate speech for translated text
        await generateSpeech(translateData.translatedText, targetLang)
      }
    } catch (error) {
      console.error("Audio processing error:", error)
      setRecognizedText("Error processing audio")
    } finally {
      setLoading(false)
    }
  }

  const generateSpeech = async (text: string, lang: string) => {
    try {
      const response = await fetch("/api/text-to-speech", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text, lang }),
      })

      const data = await response.json()
      if (data.audioUrl) {
        const audio = new Audio(data.audioUrl)
        audio.play()
      }
    } catch (error) {
      console.error("Speech generation error:", error)
    }
  }

  return (
    <div className="space-y-6">
      {/* Recording Section */}
      <Card className="p-8 bg-gradient-to-br from-card to-card/50 border-border">
        <div className="text-center">
          <div className="mb-6">
            <div
              className={`w-24 h-24 mx-auto rounded-full flex items-center justify-center transition-all ${
                isRecording
                  ? "bg-gradient-to-r from-primary to-secondary animate-pulse"
                  : "bg-card border-2 border-border"
              }`}
            >
              <span className="text-4xl">{isRecording ? "🎙️" : "🎤"}</span>
            </div>
          </div>

          <h3 className="text-xl font-semibold mb-2">{isRecording ? "Recording..." : "Ready to Record"}</h3>
          <p className="text-muted-foreground mb-6">
            {isRecording ? "Speak now..." : "Click the button to start recording"}
          </p>

          <div className="flex gap-3 justify-center">
            {!isRecording ? (
              <Button
                onClick={startRecording}
                className="px-8 py-6 bg-gradient-to-r from-primary to-secondary hover:from-primary/90 hover:to-secondary/90 text-primary-foreground text-lg"
              >
                Start Recording
              </Button>
            ) : (
              <Button
                onClick={stopRecording}
                className="px-8 py-6 bg-destructive hover:bg-destructive/90 text-destructive-foreground text-lg"
              >
                Stop Recording
              </Button>
            )}
          </div>
        </div>
      </Card>

      {/* Results */}
      {recognizedText && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Recognized Text */}
          <Card className="p-6 bg-card border-border">
            <div className="mb-4">
              <label className="block text-sm font-medium text-foreground mb-2">
                Detected Language: {LANGUAGES.find((l) => l.code === detectedLang)?.name}
              </label>
            </div>
            <div className="p-4 bg-input border border-border rounded-lg text-foreground min-h-32">
              {recognizedText}
            </div>
          </Card>

          {/* Translated Text */}
          <Card className="p-6 bg-card border-border">
            <div className="mb-4">
              <label className="block text-sm font-medium text-foreground mb-2">
                Translated to: {LANGUAGES.find((l) => l.code === targetLang)?.name}
              </label>
              <select
                value={targetLang}
                onChange={(e) => setTargetLang(e.target.value)}
                className="w-full px-3 py-2 bg-input border border-border rounded-lg text-foreground focus:outline-none focus:ring-2 focus:ring-secondary"
              >
                {LANGUAGES.map((lang) => (
                  <option key={lang.code} value={lang.code}>
                    {lang.name}
                  </option>
                ))}
              </select>
            </div>
            <div className="p-4 bg-input border border-border rounded-lg text-foreground min-h-32">
              {loading ? "Translating..." : translatedText}
            </div>
          </Card>
        </div>
      )}
    </div>
  )
}
