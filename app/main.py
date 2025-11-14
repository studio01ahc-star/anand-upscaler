from fastapi import FastAPI, UploadFile, File
from fastapi.responses import HTMLResponse
import shutil, os

app = FastAPI()

@app.get("/", response_class=HTMLResponse)
def home():
    with open("app/ui/index.html") as f:
        return f.read()

@app.post("/upload")
async def upload_video(file: UploadFile = File(...)):
    os.makedirs("uploads", exist_ok=True)
    out_path = f"uploads/{file.filename}"
    with open(out_path, "wb") as buffer:
        shutil.copyfileobj(file.file, buffer)
    return {"status": "uploaded", "file": file.filename}
