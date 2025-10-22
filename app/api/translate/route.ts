import { generateText } from "ai"

export async function POST(request: Request) {
  try {
    const { text, sourceLang, targetLang } = await request.json()

    const { text: translatedText } = await generateText({
      model: "openai/gpt-4o-mini",
      prompt: `Translate the following text from ${sourceLang} to ${targetLang}. Only provide the translation, nothing else.\n\nText: ${text}`,
    })

    return Response.json({ translatedText })
  } catch (error) {
    console.error("Translation error:", error)
    return Response.json({ error: "Translation failed" }, { status: 500 })
  }
}
