# TravelAI

## Run locally

1. Set your API keys in environment variables or copy `.env.example` and fill them in.
2. Start the static site:

```powershell
python -m http.server 8080 --bind 127.0.0.1 --directory "C:\Users\Cc\Desktop\AI Based Tourism Website"
```

3. Start the API server:

```powershell
python api_server.py
```

4. Open:

- Site: http://127.0.0.1:8080/
- Admin: http://127.0.0.1:8080/admin.html

## Environment variables

- `GROQ_KEY`
- `GEMINI_KEY` (optional alias for compatibility)
- `OTM_KEY`
- `GROQ_URL`
- `GROQ_MODEL`