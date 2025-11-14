Anand Upscaler - Full package (Frontend + Backend) - CPU mode


This repository contains a Render-deployable app that provides:
- Frontend UI with animated stickman, blobs, progress, dark/light toggle
- FastAPI backend with /upload, /status/{job_id}, /download/{job_id}
- Upscaling uses Python Real-ESRGAN if installed (very slow on CPU), otherwise FFmpeg Lanczos scaling as fallback

To deploy:
1. Create a GitHub repo and upload these files (render.yaml, Dockerfile, requirements.txt, app/)
2. On Render, create a new Web Service and connect the GitHub repo
3. Deploy and open the public URL

Notes:
- CPU upscaling is slow. For faster/better results use a GPU worker later.
- Outputs are stored on instance disk (ephemeral on free Render).
