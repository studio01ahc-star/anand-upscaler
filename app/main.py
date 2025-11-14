import os
import uuid
import threading
import shutil
import subprocess
import tempfile

from fastapi import FastAPI, UploadFile, File, HTTPException
from fastapi.responses import HTMLResponse, FileResponse, JSONResponse
from fastapi.staticfiles import StaticFiles

app = FastAPI(title='Anand Upscaler - CPU mode (ESRGAN-lite fallback)')

# Serve static files (CSS, JS) from app/ui folder under /static URL path
app.mount('/static', StaticFiles(directory='app/ui'), name='static')

UPLOAD_DIR = 'inputs'
OUTPUT_DIR = 'outputs'

os.makedirs(UPLOAD_DIR, exist_ok=True)
os.makedirs(OUTPUT_DIR, exist_ok=True)

JOBS = {}

def ffmpeg_upscale(in_path, out_path, scale=2):
    cmd = [
        'ffmpeg', '-y', '-i', in_path,
        '-vf', f'scale=iw*{scale}:ih*{scale}:flags=lanczos',
        '-c:v', 'libx264', '-preset', 'fast', '-crf', '22',
        out_path
    ]
    subprocess.run(cmd, stdout=subprocess.PIPE, stderr=subprocess.PIPE, check=True)

def try_realesrgan_python(in_path, out_path, scale=2):
    try:
        from realesrgan import RealESRGAN
        from PIL import Image
    except Exception as e:
        raise RuntimeError('realesrgan python not available') from e

    tmp = tempfile.mkdtemp(prefix='frames_')
    try:
        subprocess.run(['ffmpeg', '-y', '-i', in_path, os.path.join(tmp, 'frame_%06d.png')], check=True)
        model = RealESRGAN(device='cpu', scale=scale)
        model.load_weights('RealESRGAN_x2.pth', download=True)
        frames = sorted([f for f in os.listdir(tmp) if f.endswith('.png')])
        for f in frames:
            p = os.path.join(tmp, f)
            img = Image.open(p).convert('RGB')
            out = model.predict(img)
            out.save(p)
        subprocess.run(
            ['ffmpeg', '-y', '-framerate', '25', '-i', os.path.join(tmp, 'frame_%06d.png'),
             '-c:v', 'libx264', '-pix_fmt', 'yuv420p', out_path], check=True
        )
    finally:
        shutil.rmtree(tmp)

def upscale_worker(job_id, in_path, out_path):
    JOBS[job_id]['status'] = 'IN_PROGRESS'
    JOBS[job_id]['progress'] = 0
    try:
        try:
            try_realesrgan_python(in_path, out_path, scale=2)
        except Exception:
            JOBS[job_id]['progress'] = 10
            ffmpeg_upscale(in_path, out_path, scale=2)
        JOBS[job_id]['status'] = 'DONE'
        JOBS[job_id]['progress'] = 100
        JOBS[job_id]['outfile'] = out_path
    except subprocess.CalledProcessError as e:
        JOBS[job_id]['status'] = 'ERROR'
        JOBS[job_id]['error'] = str(e)
    except Exception as e:
        JOBS[job_id]['status'] = 'ERROR'
        JOBS[job_id]['error'] = str(e)

@app.get('/', response_class=HTMLResponse)
def index():
    with open('app/ui/index.html', 'r', encoding='utf-8') as f:
        return f.read()

@app.post('/upload')
async def upload(file: UploadFile = File(...)):
    filename = f"{uuid.uuid4().hex}_{file.filename}"
    in_path = os.path.join(UPLOAD_DIR, filename)
    with open(in_path, 'wb') as out:
        content = await file.read()
        out.write(content)
    job_id = uuid.uuid4().hex
    out_name = f"{job_id}_upscaled_{file.filename}"
    out_path = os.path.join(OUTPUT_DIR, out_name)
    JOBS[job_id] = {'status':'PENDING','progress':0,'outfile':None}
    t = threading.Thread(target=upscale_worker, args=(job_id, in_path, out_path), daemon=True)
    t.start()
    return JSONResponse({'job_id': job_id})

@app.get('/status/{job_id}')
def status(job_id: str):
    job = JOBS.get(job_id)
    if not job:
        raise HTTPException(status_code=404, detail='Job not found')
    return JSONResponse(job)

@app.get('/download/{job_id}')
def download(job_id: str):
    job = JOBS.get(job_id)
    if not job or job.get('status') != 'DONE' or not job.get('outfile'):
        raise HTTPException(status_code=404, detail='Result not ready')
    return FileResponse(job['outfile'], media_type='video/mp4', filename=os.path.basename(job['outfile']))

