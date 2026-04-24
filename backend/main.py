import os, io, json, hashlib, httpx, faiss, numpy as np, pandas as pd
from fastapi import FastAPI, UploadFile, File, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import StreamingResponse
from pydantic import BaseModel
from sentence_transformers import SentenceTransformer
from pypdf import PdfReader
from docx import Document
from PIL import Image
import pytesseract
from typing import List

app = FastAPI(title="MyAI - Personal ChatGPT")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

OLLAMA_URL = os.getenv("OLLAMA_URL", "http://localhost:11434")
DATA_DIR = "/app/data"
UPLOAD_DIR = f"{DATA_DIR}/uploads"
INDEX_PATH = f"{DATA_DIR}/index.faiss"
CHUNKS_PATH = f"{DATA_DIR}/chunks.json"
EMBED_CACHE_PATH = f"{DATA_DIR}/embed_cache.json"

os.makedirs(UPLOAD_DIR, exist_ok=True)

embedder = SentenceTransformer("all-MiniLM-L6-v2")
DIM = 384

if os.path.exists(INDEX_PATH) and os.path.exists(CHUNKS_PATH):
    index = faiss.read_index(INDEX_PATH)
    with open(CHUNKS_PATH) as f:
        chunk_store: List[dict] = json.load(f)
    print(f"Loaded existing index: {index.ntotal} vectors")
else:
    index = faiss.IndexFlatL2(DIM)
    chunk_store: List[dict] = []
    print("Created fresh index")

if os.path.exists(EMBED_CACHE_PATH):
    with open(EMBED_CACHE_PATH) as f:
        embed_cache: dict = json.load(f)
else:
    embed_cache: dict = {}

def save_index():
    faiss.write_index(index, INDEX_PATH)
    with open(CHUNKS_PATH, "w") as f:
        json.dump(chunk_store, f)

def save_embed_cache():
    with open(EMBED_CACHE_PATH, "w") as f:
        json.dump(embed_cache, f)

def file_hash(content: bytes) -> str:
    return hashlib.md5(content).hexdigest()

def split_text(text: str, size: int = 400, overlap: int = 60) -> List[str]:
    words = text.split()
    result, i = [], 0
    while i < len(words):
        result.append(" ".join(words[i:i+size]))
        i += size - overlap
    return [c for c in result if len(c.strip()) > 20]

def add_to_index(texts: List[str], source: str, fhash: str):
    global index, chunk_store, embed_cache
    if not texts:
        return 0
    if fhash in embed_cache:
        vecs = np.array(embed_cache[fhash], dtype="float32")
    else:
        vecs = embedder.encode(texts, show_progress_bar=False).astype("float32")
        embed_cache[fhash] = vecs.tolist()
        save_embed_cache()
    index.add(vecs)
    for t in texts:
        chunk_store.append({"text": t, "source": source})
    save_index()
    return len(texts)

def search_index(query: str, k: int = 5) -> List[dict]:
    if index.ntotal == 0:
        return []
    vec = embedder.encode([query]).astype("float32")
    dists, ids = index.search(vec, min(k, index.ntotal))
    results = []
    for i, dist in zip(ids[0], dists[0]):
        if i < len(chunk_store):
            results.append({**chunk_store[i], "score": float(dist)})
    return results

def extract_text(filename: str, content: bytes) -> str:
    ext = filename.rsplit(".", 1)[-1].lower()
    if ext == "pdf":
        reader = PdfReader(io.BytesIO(content))
        return "\n".join(p.extract_text() or "" for p in reader.pages)
    elif ext == "docx":
        doc = Document(io.BytesIO(content))
        return "\n".join(p.text for p in doc.paragraphs)
    elif ext == "csv":
        df = pd.read_csv(io.BytesIO(content))
        return df.to_string(index=False)
    elif ext in ("xlsx", "xls"):
        df = pd.read_excel(io.BytesIO(content))
        return df.to_string(index=False)
    elif ext in ("txt", "md", "json"):
        return content.decode("utf-8", errors="ignore")
    elif ext in ("png", "jpg", "jpeg", "bmp", "tiff", "webp"):
        img = Image.open(io.BytesIO(content))
        return pytesseract.image_to_string(img)
    else:
        return content.decode("utf-8", errors="ignore")


@app.get("/")
def root():
    return {"status": "MyAI backend running", "indexed_chunks": len(chunk_store)}


@app.get("/models")
async def list_models():
    async with httpx.AsyncClient(timeout=30) as client:
        try:
            r = await client.get(f"{OLLAMA_URL}/api/tags")
            return r.json()
        except Exception as e:
            raise HTTPException(status_code=503, detail=str(e))


@app.post("/pull-model")
async def pull_model(model: str = "mistral"):
    async def stream_pull():
        async with httpx.AsyncClient(timeout=3600) as client:
            try:
                async with client.stream("POST", f"{OLLAMA_URL}/api/pull",
                                         json={"name": model, "stream": True}) as resp:
                    async for line in resp.aiter_lines():
                        if line.strip():
                            yield ("data: " + line + "\n")
                yield 'data: {"status":"done"}\n'
            except Exception as e:
                yield ('data: {"error": "' + str(e) + '"}\n')
    return StreamingResponse(stream_pull(), media_type="text/event-stream")


@app.post("/upload")
async def upload_file(file: UploadFile = File(...)):
    content = await file.read()
    fhash = file_hash(content)
    existing_sources = {c["source"] for c in chunk_store}
    if file.filename in existing_sources:
        return {"message": f"Already indexed: {file.filename}. Delete first to re-index.", "chunks": 0}
    text = extract_text(file.filename, content)
    if not text.strip():
        return {"message": f"No text extracted from {file.filename}"}
    texts = split_text(text)
    count = add_to_index(texts, file.filename, fhash)
    with open(os.path.join(UPLOAD_DIR, file.filename), "wb") as f:
        f.write(content)
    return {"message": f"{file.filename} indexed!", "chunks": count, "total_indexed": index.ntotal}


@app.delete("/document/{filename}")
async def delete_document(filename: str):
    global index, chunk_store
    before = len(chunk_store)
    chunk_store = [c for c in chunk_store if c["source"] != filename]
    removed = before - len(chunk_store)
    if removed == 0:
        raise HTTPException(status_code=404, detail="Document not found")
    index = faiss.IndexFlatL2(DIM)
    if chunk_store:
        texts = [c["text"] for c in chunk_store]
        vecs = embedder.encode(texts, show_progress_bar=False).astype("float32")
        index.add(vecs)
    save_index()
    return {"message": f"Deleted {filename} ({removed} chunks)", "remaining": len(chunk_store)}


@app.get("/documents")
def list_documents():
    sources = {}
    for c in chunk_store:
        sources[c["source"]] = sources.get(c["source"], 0) + 1
    return {"documents": [{"name": k, "chunks": v} for k, v in sources.items()],
            "total_chunks": len(chunk_store)}


class ChatRequest(BaseModel):
    message: str
    model: str = "mistral"
    history: list = []
    stream: bool = True


@app.post("/chat")
async def chat(req: ChatRequest):
    hits = search_index(req.message, k=5)

    if hits:
        context_text = "\n\n---\n\n".join(h["text"] for h in hits)
        sources = list(dict.fromkeys(h["source"] for h in hits))
        system_prompt = (
            "You are an expert AI assistant with access to the user's documents.\n\n"
            "INSTRUCTIONS:\n"
            "- Answer using ONLY the context below when it is relevant.\n"
            "- If the context does not contain the answer, say so honestly.\n"
            "- Be concise, accurate, and helpful.\n\n"
            "CONTEXT FROM DOCUMENTS:\n" + context_text
        )
    else:
        sources = []
        system_prompt = (
            "You are a helpful and knowledgeable AI assistant. "
            "Answer questions clearly and accurately. If unsure, say so."
        )

    messages = []
    for turn in req.history[-12:]:
        messages.append({"role": turn["role"], "content": turn["content"]})
    messages.append({"role": "user", "content": req.message})

    payload = {
        "model": req.model,
        "messages": [{"role": "system", "content": system_prompt}] + messages,
        "stream": True,
    }

    async def generate():
        meta = json.dumps({"sources": sources, "used_docs": bool(hits)})
        yield ("data: " + meta + "\n")
        async with httpx.AsyncClient(timeout=3600) as client:
            try:
                async with client.stream("POST", f"{OLLAMA_URL}/api/chat", json=payload) as resp:
                    async for line in resp.aiter_lines():
                        if line.strip():
                            try:
                                data = json.loads(line)
                                token = data.get("message", {}).get("content", "")
                                if token:
                                    yield ("data: " + json.dumps({"token": token}) + "\n")
                                if data.get("done"):
                                    yield "data: [DONE]\n"
                            except Exception:
                                pass
            except Exception as e:
                yield ("data: " + json.dumps({"error": str(e)}) + "\n")

    return StreamingResponse(generate(), media_type="text/event-stream")
