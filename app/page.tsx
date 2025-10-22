"use client"

import { useState } from "react"
import TextTranslator from "@/components/text-translator"
import SpeechTranslator from "@/components/speech-translator"
import ImageTranslator from "@/components/image-translator"
import { Toaster } from "@/components/ui/toaster"

export default function Home() {
  const [activeTab, setActiveTab] = useState<"text" | "speech" | "image">("text")

  return (
    <main className="min-h-screen bg-background text-foreground">
      {/* Header */}
      <header className="border-b border-border bg-gradient-to-b from-card to-background">
        <div className="max-w-6xl mx-auto px-4 py-8">
          <div className="flex items-center gap-3 mb-2">
            <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-primary to-secondary flex items-center justify-center">
              <span className="text-lg font-bold text-primary-foreground">T</span>
            </div>
            <h1 className="text-3xl font-bold bg-gradient-to-r from-primary via-secondary to-accent bg-clip-text text-transparent">
              NeoTranslate
            </h1>
          </div>
          <p className="text-muted-foreground">Translate anything, anywhere, instantly</p>
        </div>
      </header>

      {/* Navigation Tabs */}
      <div className="border-b border-border sticky top-0 bg-background/80 backdrop-blur-sm z-10">
        <div className="max-w-6xl mx-auto px-4">
          <div className="flex gap-1">
            {[
              { id: "text", label: "Text Translation", icon: "✎" },
              { id: "speech", label: "Speech Translation", icon: "🎤" },
              { id: "image", label: "Image Translation", icon: "🖼" },
            ].map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id as any)}
                className={`px-4 py-3 font-medium transition-all duration-300 border-b-2 ${
                  activeTab === tab.id
                    ? "border-primary text-primary"
                    : "border-transparent text-muted-foreground hover:text-foreground"
                }`}
              >
                <span className="mr-2">{tab.icon}</span>
                {tab.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="max-w-6xl mx-auto px-4 py-8">
        {activeTab === "text" && <TextTranslator />}
        {activeTab === "speech" && <SpeechTranslator />}
        {activeTab === "image" && <ImageTranslator />}
      </div>

      <Toaster />
    </main>
  )
}
