const state = {
  image: null,
  imageName: "",
  preset: "drift",
  duration: 6,
  aspect: "16:9",
  animationId: 0,
  objectUrl: "",
};

const canvas = document.querySelector("#previewCanvas");
const ctx = canvas.getContext("2d");
const imageInput = document.querySelector("#imageInput");
const dropzone = document.querySelector("#dropzone");
const emptyState = document.querySelector("#emptyState");
const imageMeta = document.querySelector("#imageMeta");
const promptInput = document.querySelector("#promptInput");
const generateButton = document.querySelector("#generateButton");
const sampleButton = document.querySelector("#sampleButton");
const clearButton = document.querySelector("#clearButton");
const presetName = document.querySelector("#presetName");
const presetList = document.querySelector("#presetList");
const statusText = document.querySelector("#statusText");
const resultVideo = document.querySelector("#resultVideo");
const renderMeta = document.querySelector("#renderMeta");
const downloadLink = document.querySelector("#downloadLink");
const resultPlaceholder = document.querySelector("#resultPlaceholder");
const previewMotionButton = document.querySelector("#previewMotionButton");
const canvasWrap = document.querySelector("#canvasWrap");

const presetLabels = {
  drift: "Cinematic Drift",
  speed: "Speed Ramp",
  orbit: "Soft Orbit",
  zoom: "Impact Zoom",
};

const promptPalettes = [
  ["#101113", "#14d7c6", "#ff5c25", "#f4f4f1"],
  ["#090a0b", "#d7ff00", "#ff2f92", "#f7b938"],
  ["#14120f", "#f7b938", "#14d7c6", "#e7e7e0"],
  ["#0b0c0d", "#ef476f", "#06d6a0", "#ffd166"],
];

function setStatus(message) {
  statusText.textContent = message;
}

function resizeCanvasForAspect() {
  if (state.aspect === "9:16") {
    canvas.width = 720;
    canvas.height = 1280;
    canvasWrap.style.aspectRatio = "9 / 16";
  } else {
    canvas.width = 1280;
    canvas.height = 720;
    canvasWrap.style.aspectRatio = "16 / 9";
  }
}

function drawCoverImage(image, frame) {
  const scale = Math.max(canvas.width / image.width, canvas.height / image.height);
  const width = image.width * scale;
  const height = image.height * scale;
  const x = (canvas.width - width) / 2;
  const y = (canvas.height - height) / 2;
  ctx.drawImage(image, x + frame.x, y + frame.y, width * frame.scale, height * frame.scale);
}

function frameForPreset(progress) {
  const wave = Math.sin(progress * Math.PI * 2);
  const ease = 0.5 - Math.cos(progress * Math.PI) / 2;

  if (state.preset === "speed") {
    return {
      x: -90 + ease * 180,
      y: wave * 10,
      scale: 1.05,
      rotate: wave * 0.01,
    };
  }

  if (state.preset === "orbit") {
    return {
      x: Math.cos(progress * Math.PI * 2) * 38,
      y: Math.sin(progress * Math.PI * 2) * 26,
      scale: 1.08,
      rotate: wave * 0.018,
    };
  }

  if (state.preset === "zoom") {
    return {
      x: 0,
      y: 0,
      scale: 1 + ease * 0.18,
      rotate: 0,
    };
  }

  return {
    x: -28 + ease * 56,
    y: -12 + ease * 24,
    scale: 1.04 + ease * 0.04,
    rotate: wave * 0.006,
  };
}

function drawOverlay(progress) {
  const gradient = ctx.createLinearGradient(0, 0, canvas.width, canvas.height);
  gradient.addColorStop(0, "rgba(0, 0, 0, 0.14)");
  gradient.addColorStop(0.48, "rgba(0, 0, 0, 0)");
  gradient.addColorStop(1, "rgba(0, 0, 0, 0.34)");
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  if (state.preset === "speed") {
    ctx.save();
    ctx.globalAlpha = 0.28;
    ctx.strokeStyle = "#f4f4f1";
    ctx.lineWidth = 3;
    for (let i = 0; i < 14; i += 1) {
      const y = (i / 14) * canvas.height + Math.sin(progress * 8 + i) * 18;
      ctx.beginPath();
      ctx.moveTo(-40, y);
      ctx.lineTo(canvas.width * 0.7, y - 120);
      ctx.stroke();
    }
    ctx.restore();
  }

  if (state.preset === "zoom") {
    ctx.save();
    ctx.globalAlpha = 0.34;
    ctx.strokeStyle = "#f7b938";
    ctx.lineWidth = 7;
    const radius = Math.min(canvas.width, canvas.height) * (0.18 + progress * 0.46);
    ctx.beginPath();
    ctx.arc(canvas.width / 2, canvas.height / 2, radius, 0, Math.PI * 2);
    ctx.stroke();
    ctx.restore();
  }
}

function drawFrame(progress = 0) {
  resizeCanvasForAspect();
  ctx.clearRect(0, 0, canvas.width, canvas.height);

  if (!state.image) {
    ctx.fillStyle = "#0b0c0d";
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    return;
  }

  const frame = frameForPreset(progress);
  ctx.save();
  ctx.translate(canvas.width / 2, canvas.height / 2);
  ctx.rotate(frame.rotate);
  ctx.translate(-canvas.width / 2, -canvas.height / 2);
  drawCoverImage(state.image, frame);
  ctx.restore();
  drawOverlay(progress);
}

function showImageReady(name) {
  state.imageName = name;
  imageMeta.textContent = name;
  emptyState.classList.add("hidden");
  setStatus("이미지가 준비되었습니다. 프리셋을 고른 뒤 생성하세요.");
  drawFrame(0);
}

function loadImageFromFile(file) {
  if (!file || !file.type.startsWith("image/")) {
    setStatus("이미지 파일만 사용할 수 있습니다.");
    return;
  }

  const reader = new FileReader();
  reader.onload = () => {
    const image = new Image();
    image.onload = () => {
      state.image = image;
      showImageReady(file.name);
    };
    image.src = reader.result;
  };
  reader.readAsDataURL(file);
}

function createSampleImage() {
  const text = promptInput.value.trim() || "Neon city chase cinematic motion";
  const palette = promptPalettes[text.length % promptPalettes.length];
  const sample = document.createElement("canvas");
  sample.width = 1280;
  sample.height = 720;
  const sampleCtx = sample.getContext("2d");
  const bg = sampleCtx.createLinearGradient(0, 0, sample.width, sample.height);
  bg.addColorStop(0, palette[0]);
  bg.addColorStop(0.48, palette[1]);
  bg.addColorStop(1, palette[2]);
  sampleCtx.fillStyle = bg;
  sampleCtx.fillRect(0, 0, sample.width, sample.height);

  for (let i = 0; i < 80; i += 1) {
    const x = (Math.sin(i * 42.7) * 0.5 + 0.5) * sample.width;
    const y = (Math.cos(i * 19.3) * 0.5 + 0.5) * sample.height;
    const size = 18 + ((i * 13) % 90);
    sampleCtx.globalAlpha = 0.08 + ((i % 5) * 0.035);
    sampleCtx.fillStyle = i % 2 ? palette[3] : palette[1];
    sampleCtx.fillRect(x, y, size * 2.8, Math.max(3, size / 10));
  }

  sampleCtx.globalAlpha = 1;
  sampleCtx.fillStyle = "rgba(0,0,0,0.3)";
  sampleCtx.fillRect(0, 0, sample.width, sample.height);
  sampleCtx.fillStyle = "#f4f4f1";
  sampleCtx.font = "800 56px Arial, sans-serif";
  sampleCtx.textBaseline = "top";
  sampleCtx.fillText("MOVIE MAKER", 72, 72);
  sampleCtx.font = "400 28px Arial, sans-serif";
  wrapText(sampleCtx, text, 72, 150, 860, 38);

  const image = new Image();
  image.onload = () => {
    state.image = image;
    showImageReady("prompt-sample.png");
  };
  image.src = sample.toDataURL("image/png");
}

function wrapText(context, text, x, y, maxWidth, lineHeight) {
  const words = text.split(/\s+/);
  let line = "";
  let currentY = y;

  words.forEach((word) => {
    const testLine = line ? `${line} ${word}` : word;
    if (context.measureText(testLine).width > maxWidth && line) {
      context.fillText(line, x, currentY);
      line = word;
      currentY += lineHeight;
    } else {
      line = testLine;
    }
  });

  context.fillText(line, x, currentY);
}

function previewMotion() {
  if (!state.image) {
    createSampleImage();
  }

  cancelAnimationFrame(state.animationId);
  const startedAt = performance.now();
  const loop = (time) => {
    const progress = ((time - startedAt) % 2400) / 2400;
    drawFrame(progress);
    state.animationId = requestAnimationFrame(loop);
  };
  state.animationId = requestAnimationFrame(loop);
  setStatus(`${presetLabels[state.preset]} 프리뷰 재생 중입니다.`);
}

async function renderVideo() {
  if (!state.image) {
    createSampleImage();
    await waitForImage();
  }

  if (!canvas.captureStream || typeof MediaRecorder === "undefined") {
    setStatus("현재 브라우저가 캔버스 녹화를 지원하지 않습니다.");
    return;
  }

  cancelAnimationFrame(state.animationId);
  generateButton.disabled = true;
  renderMeta.textContent = "렌더링 중";
  resultPlaceholder.classList.add("hidden");
  setStatus("프레임을 렌더링하고 있습니다.");

  const fps = 30;
  const totalFrames = state.duration * fps;
  const stream = canvas.captureStream(fps);
  const chunks = [];
  const recorder = new MediaRecorder(stream, { mimeType: bestMimeType() });

  recorder.ondataavailable = (event) => {
    if (event.data.size) {
      chunks.push(event.data);
    }
  };

  const finished = new Promise((resolve) => {
    recorder.onstop = resolve;
  });

  recorder.start();

  for (let frame = 0; frame <= totalFrames; frame += 1) {
    drawFrame(frame / totalFrames);
    renderMeta.textContent = `${Math.round((frame / totalFrames) * 100)}%`;
    await delay(1000 / fps);
  }

  recorder.stop();
  stream.getTracks().forEach((track) => track.stop());
  await finished;

  const blob = new Blob(chunks, { type: chunks[0]?.type || "video/webm" });
  if (state.objectUrl) {
    URL.revokeObjectURL(state.objectUrl);
  }

  state.objectUrl = URL.createObjectURL(blob);
  resultVideo.src = state.objectUrl;
  downloadLink.href = state.objectUrl;
  downloadLink.classList.remove("disabled");
  renderMeta.textContent = `${state.duration}s webm`;
  generateButton.disabled = false;
  setStatus("영상이 생성되었습니다. 오른쪽에서 재생하거나 다운로드할 수 있습니다.");
}

function waitForImage() {
  return new Promise((resolve) => {
    const check = () => {
      if (state.image) {
        resolve();
      } else {
        requestAnimationFrame(check);
      }
    };
    check();
  });
}

function delay(ms) {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}

function bestMimeType() {
  const options = ["video/webm;codecs=vp9", "video/webm;codecs=vp8", "video/webm"];
  return options.find((type) => MediaRecorder.isTypeSupported(type)) || "video/webm";
}

function resetStudio() {
  cancelAnimationFrame(state.animationId);
  state.image = null;
  state.imageName = "";
  imageInput.value = "";
  imageMeta.textContent = "대기 중";
  emptyState.classList.remove("hidden");
  resultPlaceholder.classList.remove("hidden");
  resultVideo.removeAttribute("src");
  resultVideo.load();
  downloadLink.classList.add("disabled");
  renderMeta.textContent = "미생성";
  if (state.objectUrl) {
    URL.revokeObjectURL(state.objectUrl);
    state.objectUrl = "";
  }
  drawFrame(0);
  setStatus("초기화되었습니다.");
}

imageInput.addEventListener("change", (event) => {
  loadImageFromFile(event.target.files[0]);
});

dropzone.addEventListener("dragover", (event) => {
  event.preventDefault();
  dropzone.classList.add("dragging");
});

dropzone.addEventListener("dragleave", () => {
  dropzone.classList.remove("dragging");
});

dropzone.addEventListener("drop", (event) => {
  event.preventDefault();
  dropzone.classList.remove("dragging");
  loadImageFromFile(event.dataTransfer.files[0]);
});

document.addEventListener("paste", (event) => {
  const file = [...event.clipboardData.files].find((item) => item.type.startsWith("image/"));
  if (file) {
    loadImageFromFile(file);
  }
});

presetList.addEventListener("click", (event) => {
  const card = event.target.closest(".preset-card");
  if (!card) {
    return;
  }

  document.querySelectorAll(".preset-card").forEach((button) => {
    button.classList.toggle("active", button === card);
  });
  state.preset = card.dataset.preset;
  presetName.textContent = presetLabels[state.preset];
  drawFrame(0.35);
});

document.querySelectorAll("[data-duration]").forEach((button) => {
  button.addEventListener("click", () => {
    document.querySelectorAll("[data-duration]").forEach((item) => {
      item.classList.toggle("active", item === button);
    });
    state.duration = Number(button.dataset.duration);
  });
});

document.querySelectorAll("[data-aspect]").forEach((button) => {
  button.addEventListener("click", () => {
    document.querySelectorAll("[data-aspect]").forEach((item) => {
      item.classList.toggle("active", item === button);
    });
    state.aspect = button.dataset.aspect;
    drawFrame(0);
  });
});

sampleButton.addEventListener("click", createSampleImage);
clearButton.addEventListener("click", resetStudio);
generateButton.addEventListener("click", renderVideo);
previewMotionButton.addEventListener("click", previewMotion);

drawFrame(0);
