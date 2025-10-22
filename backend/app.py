from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from deep_translator import GoogleTranslator
from langdetect import detect, LangDetectException

app = FastAPI(title="Translator Backend")

# CORS for local development
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

class TranslateRequest(BaseModel):
    q: str
    source: str = "auto"
    target: str = "en"
    format: str = "text"

class DetectRequest(BaseModel):
    q: str

@app.get("/")
async def root():
    return {"status": "ok", "service": "translator"}

@app.post("/detect")
async def detect_language(req: DetectRequest):
    if not req.q.strip():
        return []
    try:
        lang = detect(req.q)
        return [{"language": lang, "confidence": None}]
    except LangDetectException as e:
        raise HTTPException(status_code=400, detail=str(e))

@app.post("/translate")
async def translate_text(req: TranslateRequest):
    if not req.q.strip():
        return {"translatedText": ""}
    try:
        # Use source='auto' if not specified
        src = None if req.source == "auto" else req.source
        translated = GoogleTranslator(source=src or 'auto', target=req.target).translate(req.q)
        return {"translatedText": translated, "src": src or "auto", "dest": req.target}
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=5000)
