"use client"

import { useState } from "react"
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

export default function TextTranslator() {
  const [sourceText, setSourceText] = useState("")
  const [translatedText, setTranslatedText] = useState("")
  const [sourceLang, setSourceLang] = useState("en")
  const [targetLang, setTargetLang] = useState("es")
  const [loading, setLoading] = useState(false)

  const handleTranslate = async () => {
    if (!sourceText.trim()) return

    setLoading(true)
    try {
      const response = await fetch("/api/translate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          text: sourceText,
          sourceLang,
          targetLang,
        }),
      })

      const data = await response.json()
      setTranslatedText(data.translatedText || "")
    } catch (error) {
      console.error("Translation error:", error)
      setTranslatedText("Error translating text")
    } finally {
      setLoading(false)
    }
  }

  const handleSwapLanguages = () => {
    setSourceLang(targetLang)
    setTargetLang(sourceLang)
    setSourceText(translatedText)
    setTranslatedText(sourceText)
  }

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
      {/* Source */}
      <Card className="p-6 bg-card border-border hover:border-primary/50 transition-colors">
        <div className="mb-4">
          <label className="block text-sm font-medium text-foreground mb-2">From</label>
          <select
            value={sourceLang}
            onChange={(e) => setSourceLang(e.target.value)}
            className="w-full px-3 py-2 bg-input border border-border rounded-lg text-foreground focus:outline-none focus:ring-2 focus:ring-primary"
          >
            {LANGUAGES.map((lang) => (
              <option key={lang.code} value={lang.code}>
                {lang.name}
              </option>
            ))}
          </select>
        </div>

        <textarea
          value={sourceText}
          onChange={(e) => setSourceText(e.target.value)}
          placeholder="Enter text to translate..."
          className="w-full h-48 px-4 py-3 bg-input border border-border rounded-lg text-foreground placeholder-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary resize-none"
        />

        <div className="mt-4 text-sm text-muted-foreground">{sourceText.length} characters</div>
      </Card>

      {/* Target */}
      <Card className="p-6 bg-card border-border hover:border-secondary/50 transition-colors">
        <div className="mb-4">
          <label className="block text-sm font-medium text-foreground mb-2">To</label>
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

        <textarea
          value={translatedText}
          readOnly
          placeholder="Translation will appear here..."
          className="w-full h-48 px-4 py-3 bg-input border border-border rounded-lg text-foreground placeholder-muted-foreground focus:outline-none resize-none"
        />

        <div className="mt-4 text-sm text-muted-foreground">{translatedText.length} characters</div>
      </Card>

      {/* Controls */}
      <div className="lg:col-span-2 flex gap-3 justify-center">
        <Button
          onClick={handleSwapLanguages}
          variant="outline"
          className="px-6 border-border hover:border-primary hover:text-primary bg-transparent"
        >
          ⇄ Swap Languages
        </Button>

        <Button
          onClick={handleTranslate}
          disabled={loading || !sourceText.trim()}
          className="px-8 bg-gradient-to-r from-primary to-secondary hover:from-primary/90 hover:to-secondary/90 text-primary-foreground"
        >
          {loading ? "Translating..." : "Translate"}
        </Button>
      </div>
    </div>
  )
}
