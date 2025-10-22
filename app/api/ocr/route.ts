import { generateText } from "ai"

export async function POST(request: Request) {
  try {
    const formData = await request.formData()
    const imageFile = formData.get("image") as File

    if (!imageFile) {
      return Response.json({ error: "No image file provided" }, { status: 400 })
    }

    // Convert image to base64
    const buffer = await imageFile.arrayBuffer()
    const base64Image = Buffer.from(buffer).toString("base64")

    const { text } = await generateText({
      model: "openai/gpt-4o-mini",
      messages: [
        {
          role: "user",
          content: [
            {
              type: "image",
              image: base64Image,
            },
            {
              type: "text",
              text: "Extract all text from this image. Return only the extracted text, nothing else.",
            },
          ],
        },
      ],
    })

    return Response.json({ text })
  } catch (error) {
    console.error("OCR error:", error)
    return Response.json({ error: "OCR processing failed" }, { status: 500 })
  }
}
