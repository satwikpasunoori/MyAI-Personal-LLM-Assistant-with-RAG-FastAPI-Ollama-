# 🤖 MyAI — Personal LLM Assistant with RAG

A fully local, private, free AI chat assistant that runs entirely on your machine. No API keys. No data sent to the cloud. Powered by **Ollama**, **FastAPI**, and **React**.

![MyAI](https://img.shields.io/badge/Local-100%25_Private-7c6fcd?style=for-the-badge)
![Docker](https://img.shields.io/badge/Docker-Ready-2496ED?style=for-the-badge&logo=docker)
![FastAPI](https://img.shields.io/badge/FastAPI-Backend-009688?style=for-the-badge&logo=fastapi)
![React](https://img.shields.io/badge/React-Frontend-61DAFB?style=for-the-badge&logo=react)

---

## ✨ Features

- 💬 **Chat with any Ollama model** — mistral, llama3, phi3, gemma2, and more
- 📂 **Upload documents** — PDF, DOCX, TXT, CSV, XLSX, JSON, MD, PNG, JPG (OCR)
- 🧠 **RAG (Retrieval-Augmented Generation)** — AI answers questions based on your documents
- ⚡ **Streaming responses** — token-by-token output, just like ChatGPT
- 💾 **Persistent memory** — FAISS index survives container restarts
- ⬇️ **Pull models from the UI** — no terminal needed after setup
- 🔒 **100% local** — nothing leaves your machine

---

## 🚀 Quick Start

### Prerequisites
- [Docker Desktop](https://www.docker.com/products/docker-desktop/) installed and running

### 1. Clone the repo
```bash
git clone https://github.com/satwikpasunoori/MyAI-Personal-LLM-Assistant-with-RAG-FastAPI-Ollama-.git
cd MyAI-Personal-LLM-Assistant-with-RAG-FastAPI-Ollama-
```

### 2. Start the app
```bash
docker-compose up --build
```
> First run takes a few minutes to build the containers. Subsequent runs are fast.

### 3. Open in browser
```
http://localhost:3000
```

### 4. Pull an AI model (one time)
- Click **⚙️ Settings** in the top right
- Choose a model (e.g. `mistral` or `phi3` for lower RAM usage)
- Click **⬇️ Pull Model** and wait for download to complete
- Go back to **💬 Chat** and start talking!

> No terminal commands needed — everything is done from the UI.

---

## 🧩 Architecture

```
Browser (localhost:3000)
      │
      ▼
 React Frontend  (Nginx, port 3000)
      │  /api/*
      ▼
 FastAPI Backend  (Python, port 8000)
      │   ├── FAISS Vector Store (persistent)
      │   ├── Sentence Transformers (embeddings)
      │   └── Document Parsers (PDF, DOCX, OCR...)
      ▼
 Ollama  (port 11434)
      └── LLM Models (mistral, llama3, phi3, gemma2...)
```

---

## 📁 Project Structure

```
├── backend/
│   ├── main.py           # FastAPI app — chat, upload, RAG, model pull
│   ├── requirements.txt  # Python dependencies
│   └── Dockerfile
├── frontend/
│   ├── src/
│   │   └── App.jsx       # React UI — chat, settings, document sidebar
│   ├── index.html
│   ├── package.json
│   ├── vite.config.js
│   ├── nginx.conf        # Reverse proxy /api → backend
│   └── Dockerfile
├── docker-compose.yml    # Orchestrates all 3 services
└── data/                 # Auto-created — stores FAISS index & uploads
```

---

## 🖥️ Recommended Models

| Model | RAM Required | Speed | Best For |
|-------|-------------|-------|----------|
| `phi3` | ~4 GB | ⚡ Fast | Low-spec machines, quick answers |
| `mistral` | ~5 GB | ⚡ Fast | General purpose, great quality |
| `llama3` | ~6 GB | 🔄 Medium | Best quality responses |
| `gemma2` | ~6 GB | 🔄 Medium | Google's open model |

---

## 📄 Supported File Types

| Type | Extensions |
|------|-----------|
| PDF | `.pdf` |
| Word | `.docx` |
| Spreadsheet | `.csv`, `.xlsx`, `.xls` |
| Text | `.txt`, `.md`, `.json` |
| Images (OCR) | `.png`, `.jpg`, `.jpeg` |

---

## 🛑 Stopping the App

```bash
docker-compose down
```

Your uploaded documents and FAISS index are saved in the `data/` folder and will persist when you restart.

---

## 🐛 Troubleshooting

**App won't start?**
- Make sure Docker Desktop is running
- Try `docker-compose down && docker-compose up --build`

**Model pull fails?**
- Check your internet connection
- Try a smaller model like `phi3`

**Slow responses?**
- Use a smaller model (`phi3` or `mistral`)
- Make sure no other heavy apps are running

---

## 🙌 Built With

- [Ollama](https://ollama.com) — Local LLM runner
- [FastAPI](https://fastapi.tiangolo.com) — Python backend
- [FAISS](https://github.com/facebookresearch/faiss) — Vector similarity search
- [Sentence Transformers](https://www.sbert.net) — Document embeddings
- [React](https://react.dev) + [Vite](https://vitejs.dev) — Frontend
- [Docker](https://docker.com) — Containerization

---

> Made with ❤️ by [satwikpasunoori](https://github.com/satwikpasunoori)
