"use client"

import type React from "react"

import { useState, useRef } from "react"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import Image from "next/image"

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

export default function ImageTranslator() {
  const [image, setImage] = useState<string | null>(null)
  const [extractedText, setExtractedText] = useState("")
  const [translatedText, setTranslatedText] = useState("")
  const [targetLang, setTargetLang] = useState("es")
  const [loading, setLoading] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    // Display image
    const reader = new FileReader()
    reader.onload = (event) => {
      setImage(event.target?.result as string)
    }
    reader.readAsDataURL(file)

    // Process image
    setLoading(true)
    try {
      const formData = new FormData()
      formData.append("image", file)

      const response = await fetch("/api/ocr", {
        method: "POST",
        body: formData,
      })

      const data = await response.json()
      setExtractedText(data.text || "")

      // Translate extracted text
      if (data.text) {
        const translateResponse = await fetch("/api/translate", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            text: data.text,
            sourceLang: "en",
            targetLang,
          }),
        })

        const translateData = await translateResponse.json()
        setTranslatedText(translateData.translatedText || "")
      }
    } catch (error) {
      console.error("Image processing error:", error)
      setExtractedText("Error processing image")
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="space-y-6">
      {/* Upload Section */}
      <Card className="p-8 bg-gradient-to-br from-card to-card/50 border-border border-dashed">
        <div className="text-center cursor-pointer" onClick={() => fileInputRef.current?.click()}>
          <div className="mb-4 text-5xl">🖼️</div>
          <h3 className="text-xl font-semibold mb-2">Upload an Image</h3>
          <p className="text-muted-foreground mb-4">Click to select an image or drag and drop</p>
          <Button className="bg-gradient-to-r from-primary to-secondary hover:from-primary/90 hover:to-secondary/90 text-primary-foreground">
            Choose Image
          </Button>
        </div>

        <input ref={fileInputRef} type="file" accept="image/*" onChange={handleImageUpload} className="hidden" />
      </Card>

      {/* Results */}
      {image && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Original Image */}
          <Card className="p-4 bg-card border-border">
            <h4 className="font-semibold mb-3 text-foreground">Original Image</h4>
            <div className="relative w-full h-64 bg-input rounded-lg overflow-hidden">
              <Image src={image || "/placeholder.svg"} alt="Original" fill className="object-cover" />
            </div>
          </Card>

          {/* Extracted Text */}
          <Card className="p-4 bg-card border-border">
            <h4 className="font-semibold mb-3 text-foreground">Extracted Text</h4>
            <div className="p-4 bg-input border border-border rounded-lg text-foreground min-h-64 overflow-y-auto">
              {loading ? "Processing..." : extractedText || "No text found"}
            </div>
          </Card>

          {/* Translated Text */}
          <Card className="p-4 bg-card border-border">
            <div className="mb-3">
              <label className="block text-sm font-medium text-foreground mb-2">Translate to:</label>
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
            <div className="p-4 bg-input border border-border rounded-lg text-foreground min-h-64 overflow-y-auto">
              {loading ? "Translating..." : translatedText || "Translation will appear here"}
            </div>
          </Card>
        </div>
      )}
    </div>
  )
}
