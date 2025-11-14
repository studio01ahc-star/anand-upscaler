const dropzone = document.getElementById('dropzone');
const fileInput = document.getElementById('fileInput');
const uploadBtn = document.getElementById('uploadBtn') || document.getElementById('uploadBtn');
const uploadBar = document.getElementById('uploadBar');
const uploadBarCont = document.getElementById('uploadBarCont');
const statusMeta = document.getElementById('statusMeta');
const resultArea = document.getElementById('resultArea');
const preview = document.getElementById('preview');
const overlay = document.getElementById('overlay');
const overlayBar = document.getElementById('overlayBar');
const overlayText = document.getElementById('overlayText');
const doneSound = document.getElementById('doneSound');

let currentFile=null;

dropzone.addEventListener('click', ()=> fileInput.click());
fileInput.addEventListener('change', ()=> selectFile(fileInput.files[0]));
dropzone.addEventListener('dragover', e=>{ e.preventDefault(); dropzone.classList.add('dragover'); });
dropzone.addEventListener('dragleave', e=> dropzone.classList.remove('dragover'));
dropzone.addEventListener('drop', e=>{ e.preventDefault(); dropzone.classList.remove('dragover'); selectFile(e.dataTransfer.files[0]); });

function selectFile(f){ currentFile=f; dropzone.innerText='Selected: '+f.name; preview.src = URL.createObjectURL(f); preview.style.display='block'; }

document.querySelectorAll('.btn.primary').forEach(b=>b.addEventListener('click', ()=>{ if(!currentFile) return alert('Select a file'); startUpload(currentFile); }));

function startUpload(file){
  uploadBar.style.width='0%'; uploadBar.parentElement.style.display='block';
  overlay.classList.add('show'); overlayBar.style.width='2%'; overlayText.innerText='Uploading...';
  const fd = new FormData(); fd.append('file', file);
  const xhr = new XMLHttpRequest(); xhr.open('POST','/upload');
  xhr.upload.onprogress = e=>{ if(e.lengthComputable) uploadBar.style.width = ((e.loaded/e.total)*100)+'%'; };
  xhr.onload = ()=>{ if(xhr.status===200){ const job = JSON.parse(xhr.responseText).job_id; overlayText.innerText='Processing...'; poll(job); } else { alert('Upload failed'); overlay.classList.remove('show'); } };
  xhr.send(fd);
}

function poll(job_id){
  overlayBar.style.width='6%';
  const circleWrap = document.getElementById('circle'); circleWrap.style.display='block';
  const iv = setInterval(async ()=>{
    try{
      const res = await fetch('/status/'+job_id);
      if(res.status!==200){ clearInterval(iv); overlay.classList.remove('show'); return; }
      const data = await res.json();
      const p = data.progress || 0; overlayBar.style.width = Math.max(6, p*0.9)+'%';
      circleWrap.innerHTML = createCircle(p);
      // update stickman speed variable if available
      window.__processing_progress = p;
      if(data.status==='DONE'){ clearInterval(iv); overlay.classList.remove('show'); document.getElementById('resultArea').innerHTML = `<a class='download-link' href='/download/${job_id}'>Download Upscaled Video</a>`; try{ doneSound.play(); }catch(e){} }
      if(data.status==='ERROR'){ clearInterval(iv); overlay.classList.remove('show'); alert('Processing error: '+(data.error||'unknown')); }
    }catch(e){ clearInterval(iv); overlay.classList.remove('show'); console.error(e); }
  }, 1800);
}

function createCircle(percent){
  const svg = `<svg width="64" height="64" viewBox="0 0 100 100"><circle cx="50" cy="50" r="45" stroke="rgba(255,255,255,0.06)" stroke-width="10" fill="none"/><circle cx="50" cy="50" r="45" stroke="url(#g)" stroke-width="10" stroke-dasharray="282.743" stroke-dashoffset="${282.743*(1-percent/100)}" stroke-linecap="round"><defs><linearGradient id="g" x1="0" x2="1"><stop offset="0" stop-color="#00e6a8"/><stop offset="1" stop-color="#4a90e2"/></linearGradient></defs></circle></svg>`;
  return svg;
}

// Stickman animation (sync speed to window.__processing_progress)
const stickCanvas = document.getElementById('stickCanvas'); const sctx = stickCanvas.getContext('2d');
let animT=0; function drawStick(x,y,phase,flip){ sctx.save(); sctx.translate(x,y); if(flip) sctx.scale(-1,1); sctx.lineWidth=3; sctx.strokeStyle='rgba(255,255,255,0.9)'; sctx.beginPath(); sctx.arc(0,-20,10,0,Math.PI*2); sctx.stroke(); sctx.beginPath(); sctx.moveTo(0,-10); sctx.lineTo(0,22); sctx.stroke(); sctx.beginPath(); let arm = Math.sin(phase)*18; sctx.moveTo(0,0); sctx.lineTo(arm,8); sctx.moveTo(0,0); sctx.lineTo(-arm,8); sctx.stroke(); sctx.beginPath(); let leg = Math.cos(phase)*12; sctx.moveTo(0,22); sctx.lineTo(leg,44); sctx.moveTo(0,22); sctx.lineTo(-leg,44); sctx.stroke(); sctx.restore(); }
function animateStick(){ sctx.clearRect(0,0,stickCanvas.width,stickCanvas.height); animT += 0.12 + ((window.__processing_progress||0)/100)*0.12; let phase = animT; drawStick(70,100,phase,false); drawStick(190,100,phase+Math.PI,true); requestAnimationFrame(animateStick); } animateStick();

// theme toggle
let dark=true; function toggleTheme(){ dark=!dark; if(!dark){ document.documentElement.style.setProperty('--bg','#ffffff'); document.documentElement.style.setProperty('--card','rgba(0,0,0,0.04)'); document.documentElement.style.setProperty('--muted','#55606b'); } else { document.documentElement.style.setProperty('--bg','#071124'); document.documentElement.style.setProperty('--card','rgba(255,255,255,0.04)'); document.documentElement.style.setProperty('--muted','#94a3b8'); } }
