const AUTO_RENDER_DELAY = 1200;
const MIN_PROMPT_LENGTH = 3;

const state = {
  image: null,
  imageName: "",
  preset: "drift",
  duration: 6,
  aspect: "16:9",
  animationId: 0,
  objectUrl: "",
  renderTimer: 0,
  isRendering: false,
  pendingRender: false,
  lastAutoSignature: "",
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
const resultFrame = document.querySelector(".result-frame");

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

function getPrompt() {
  return promptInput.value.trim();
}

function getRenderSignature() {
  return [
    state.imageName,
    getPrompt(),
    state.preset,
    state.duration,
    state.aspect,
  ].join("|");
}

function clearAutoRenderTimer() {
  window.clearTimeout(state.renderTimer);
  state.renderTimer = 0;
}

function updateGenerateButton() {
  const label = generateButton.querySelector("span");
  if (state.isRendering) {
    label.textContent = "Generating";
    generateButton.disabled = true;
    return;
  }

  label.textContent = "Generate";
  generateButton.disabled = false;
}

function resizeCanvasForAspect() {
  if (state.aspect === "9:16") {
    canvas.width = 720;
    canvas.height = 1280;
    canvasWrap.style.aspectRatio = "9 / 16";
    resultFrame.style.aspectRatio = "9 / 16";
  } else {
    canvas.width = 1280;
    canvas.height = 720;
    canvasWrap.style.aspectRatio = "16 / 9";
    resultFrame.style.aspectRatio = "16 / 9";
  }
}

function drawCoverImage(image, frame) {
  const scale = Math.max(canvas.width / image.width, canvas.height / image.height) * frame.scale;
  const width = image.width * scale;
  const height = image.height * scale;
  const x = (canvas.width - width) / 2 + frame.x;
  const y = (canvas.height - height) / 2 + frame.y;
  ctx.drawImage(image, x, y, width, height);
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

function promptHas(text, terms) {
  return terms.some((term) => text.includes(term));
}

function promptProfile() {
  const text = getPrompt().toLowerCase();
  const profile = {
    accent: "#14d7c6",
    secondary: "#ff2f92",
    bars: false,
    haze: false,
    streaks: false,
    pulse: false,
    vignette: 0.34,
  };

  if (promptHas(text, ["neon", "cyber", "city", "night", "네온", "사이버", "도시", "밤"])) {
    profile.accent = "#14d7c6";
    profile.secondary = "#ff2f92";
    profile.streaks = true;
  }

  if (promptHas(text, ["warm", "sunset", "gold", "노을", "석양", "따뜻", "황금"])) {
    profile.accent = "#f7b938";
    profile.secondary = "#ff6b35";
    profile.haze = true;
  }

  if (promptHas(text, ["dream", "soft", "fog", "몽환", "부드러운", "안개"])) {
    profile.accent = "#b8c7ff";
    profile.secondary = "#ffd6e8";
    profile.haze = true;
    profile.vignette = 0.22;
  }

  if (promptHas(text, ["cinematic", "film", "movie", "시네마틱", "영화", "필름"])) {
    profile.bars = true;
    profile.vignette = 0.42;
  }

  if (promptHas(text, ["fast", "speed", "racing", "chase", "빠른", "질주", "속도", "추격", "달리는"])) {
    profile.streaks = true;
    profile.pulse = true;
  }

  return profile;
}

function presetFromPrompt(text) {
  const lower = text.toLowerCase();

  if (promptHas(lower, ["fast", "speed", "racing", "chase", "빠른", "질주", "속도", "추격", "달리는"])) {
    return "speed";
  }

  if (promptHas(lower, ["orbit", "circle", "rotate", "360", "회전", "돌아", "원형"])) {
    return "orbit";
  }

  if (promptHas(lower, ["zoom", "impact", "close", "dramatic", "줌", "확대", "강렬", "임팩트"])) {
    return "zoom";
  }

  return "drift";
}

function setPreset(preset, shouldDraw = true) {
  state.preset = preset;
  presetName.textContent = presetLabels[preset];
  document.querySelectorAll(".preset-card").forEach((button) => {
    button.classList.toggle("active", button.dataset.preset === preset);
  });

  if (shouldDraw) {
    drawFrame(0.35);
  }
}

function applyPromptPreset() {
  const prompt = getPrompt();
  if (!prompt) {
    return;
  }

  setPreset(presetFromPrompt(prompt), false);
}

function drawPromptEffects(progress) {
  const prompt = getPrompt();
  if (!prompt) {
    return;
  }

  const profile = promptProfile();
  const wash = ctx.createLinearGradient(0, 0, canvas.width, canvas.height);
  wash.addColorStop(0, hexToRgba(profile.accent, 0.18));
  wash.addColorStop(0.52, "rgba(0, 0, 0, 0)");
  wash.addColorStop(1, hexToRgba(profile.secondary, 0.2));

  ctx.save();
  ctx.globalCompositeOperation = "screen";
  ctx.fillStyle = wash;
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.restore();

  if (profile.haze) {
    ctx.save();
    ctx.globalAlpha = 0.16 + Math.sin(progress * Math.PI * 2) * 0.04;
    ctx.fillStyle = profile.accent;
    for (let i = 0; i < 5; i += 1) {
      const radius = canvas.width * (0.18 + i * 0.04);
      const x = canvas.width * (0.18 + i * 0.18);
      const y = canvas.height * (0.28 + Math.sin(progress * 3 + i) * 0.18);
      ctx.beginPath();
      ctx.arc(x, y, radius, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.restore();
  }

  if (profile.streaks) {
    ctx.save();
    ctx.globalAlpha = 0.26;
    ctx.strokeStyle = profile.accent;
    ctx.lineWidth = Math.max(3, canvas.width * 0.004);
    for (let i = 0; i < 11; i += 1) {
      const y = (i / 10) * canvas.height + Math.sin(progress * 9 + i) * 22;
      const start = -canvas.width * 0.1 + progress * canvas.width * 0.22;
      ctx.beginPath();
      ctx.moveTo(start, y);
      ctx.lineTo(canvas.width * 0.72, y - canvas.height * 0.18);
      ctx.stroke();
    }
    ctx.restore();
  }

  if (profile.pulse) {
    ctx.save();
    ctx.globalAlpha = 0.18;
    ctx.strokeStyle = profile.secondary;
    ctx.lineWidth = Math.max(5, canvas.width * 0.006);
    ctx.beginPath();
    ctx.arc(
      canvas.width / 2,
      canvas.height / 2,
      Math.min(canvas.width, canvas.height) * (0.2 + progress * 0.38),
      0,
      Math.PI * 2,
    );
    ctx.stroke();
    ctx.restore();
  }

  if (profile.bars) {
    const barHeight = Math.max(36, canvas.height * 0.075);
    ctx.fillStyle = "rgba(0, 0, 0, 0.76)";
    ctx.fillRect(0, 0, canvas.width, barHeight);
    ctx.fillRect(0, canvas.height - barHeight, canvas.width, barHeight);
  }
}

function drawOverlay(progress) {
  const profile = promptProfile();
  const gradient = ctx.createLinearGradient(0, 0, canvas.width, canvas.height);
  gradient.addColorStop(0, "rgba(0, 0, 0, 0.14)");
  gradient.addColorStop(0.48, "rgba(0, 0, 0, 0)");
  gradient.addColorStop(1, `rgba(0, 0, 0, ${profile.vignette})`);
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
    ctx.strokeStyle = profile.secondary;
    ctx.lineWidth = 7;
    const radius = Math.min(canvas.width, canvas.height) * (0.18 + progress * 0.46);
    ctx.beginPath();
    ctx.arc(canvas.width / 2, canvas.height / 2, radius, 0, Math.PI * 2);
    ctx.stroke();
    ctx.restore();
  }

  drawPromptEffects(progress);
}

function hexToRgba(hex, alpha) {
  const value = hex.replace("#", "");
  const r = parseInt(value.slice(0, 2), 16);
  const g = parseInt(value.slice(2, 4), 16);
  const b = parseInt(value.slice(4, 6), 16);
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
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
  state.lastAutoSignature = "";
  imageMeta.textContent = name;
  emptyState.classList.add("hidden");
  drawFrame(0);
  scheduleAutoRender("image-ready");
}

function loadImageFromFile(file) {
  if (!file || !file.type.startsWith("image/")) {
    setStatus("이미지 파일만 사용할 수 있습니다.");
    return;
  }

  clearAutoRenderTimer();
  setStatus("이미지를 불러오는 중입니다.");

  const reader = new FileReader();
  reader.onerror = () => {
    setStatus("이미지를 읽는 중 오류가 발생했습니다. 다른 파일로 다시 시도해 주세요.");
  };
  reader.onload = () => {
    const image = new Image();
    image.onerror = () => {
      setStatus("이미지를 표시할 수 없습니다. JPG 또는 PNG 파일로 다시 시도해 주세요.");
    };
    image.onload = () => {
      state.image = image;
      showImageReady(file.name);
    };
    image.src = reader.result;
  };
  reader.readAsDataURL(file);
}

function createSampleImage() {
  const text = getPrompt() || "Neon city chase cinematic motion";
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

function scheduleAutoRender(reason) {
  clearAutoRenderTimer();

  const prompt = getPrompt();
  if (!state.image && prompt.length >= MIN_PROMPT_LENGTH) {
    setStatus("이미지를 업로드하면 프롬프트에 맞춰 자동으로 영상이 생성됩니다.");
    return;
  }

  if (state.image && prompt.length < MIN_PROMPT_LENGTH) {
    setStatus("프롬프트를 3글자 이상 입력하면 자동으로 영상이 생성됩니다.");
    return;
  }

  if (!state.image) {
    setStatus("이미지를 업로드하고 프롬프트를 입력하면 자동으로 영상이 생성됩니다.");
    return;
  }

  if (state.isRendering) {
    state.pendingRender = true;
    setStatus("현재 렌더가 끝나면 새 입력으로 다시 생성합니다.");
    return;
  }

  applyPromptPreset();
  drawFrame(0.25);
  setStatus(reason === "prompt" ? "입력이 멈추면 자동으로 생성합니다." : "영상 자동 생성 대기 중입니다.");
  state.renderTimer = window.setTimeout(() => {
    renderVideo({ auto: true });
  }, AUTO_RENDER_DELAY);
}

function previewMotion() {
  if (!state.image) {
    createSampleImage();
  }

  applyPromptPreset();
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

async function renderVideo(options = {}) {
  clearAutoRenderTimer();

  const prompt = getPrompt();
  if (prompt.length < MIN_PROMPT_LENGTH) {
    setStatus("프롬프트를 3글자 이상 입력해야 영상을 생성할 수 있습니다.");
    return;
  }

  if (!state.image) {
    if (options.auto) {
      setStatus("이미지를 업로드하면 자동으로 영상이 생성됩니다.");
      return;
    }
    createSampleImage();
    await waitForImage();
  }

  if (!canvas.captureStream || typeof MediaRecorder === "undefined") {
    setStatus("현재 브라우저가 영상 녹화를 지원하지 않습니다. 최신 Chrome 또는 Edge에서 열어 주세요.");
    return;
  }

  if (state.isRendering) {
    state.pendingRender = true;
    setStatus("현재 렌더가 끝나면 새 입력으로 다시 생성합니다.");
    return;
  }

  applyPromptPreset();
  const signature = getRenderSignature();
  if (options.auto && signature === state.lastAutoSignature) {
    return;
  }

  let stream = null;
  let recorder = null;
  const chunks = [];

  try {
    state.isRendering = true;
    state.pendingRender = false;
    updateGenerateButton();
    cancelAnimationFrame(state.animationId);
    renderMeta.textContent = "렌더링 중";
    resultPlaceholder.classList.add("hidden");
    setStatus("프롬프트를 분석해 영상을 자동 생성하고 있습니다.");

    const fps = 30;
    const totalFrames = state.duration * fps;
    stream = canvas.captureStream(fps);
    recorder = createMediaRecorder(stream);

    const finished = new Promise((resolve, reject) => {
      recorder.ondataavailable = (event) => {
        if (event.data && event.data.size) {
          chunks.push(event.data);
        }
      };
      recorder.onerror = (event) => {
        reject(event.error || new Error("영상 녹화 중 오류가 발생했습니다."));
      };
      recorder.onstop = resolve;
    });

    recorder.start(250);

    for (let frame = 0; frame <= totalFrames; frame += 1) {
      drawFrame(frame / totalFrames);
      renderMeta.textContent = `${Math.round((frame / totalFrames) * 100)}%`;
      await delay(1000 / fps);
    }

    recorder.stop();
    await finished;

    if (!chunks.length) {
      throw new Error("영상 데이터를 만들지 못했습니다.");
    }

    const mimeType = chunks[0].type || bestMimeType() || "video/webm";
    const blob = new Blob(chunks, { type: mimeType });
    if (state.objectUrl) {
      URL.revokeObjectURL(state.objectUrl);
    }

    state.objectUrl = URL.createObjectURL(blob);
    resultVideo.src = state.objectUrl;
    resultVideo.load();
    downloadLink.href = state.objectUrl;
    downloadLink.classList.remove("disabled");
    renderMeta.textContent = `${state.duration}s webm`;
    state.lastAutoSignature = signature;
    setStatus("영상이 자동 생성되었습니다. 오른쪽에서 재생하거나 다운로드할 수 있습니다.");
  } catch (error) {
    const message = error && error.message ? error.message : String(error);
    renderMeta.textContent = "오류";
    resultPlaceholder.classList.remove("hidden");
    setStatus(`영상 생성 오류: ${message}`);
  } finally {
    if (recorder && recorder.state !== "inactive") {
      recorder.stop();
    }
    if (stream) {
      stream.getTracks().forEach((track) => track.stop());
    }
    state.isRendering = false;
    updateGenerateButton();

    if (state.pendingRender) {
      state.pendingRender = false;
      scheduleAutoRender("pending");
    }
  }
}

function createMediaRecorder(stream) {
  const mimeType = bestMimeType();
  if (mimeType) {
    try {
      return new MediaRecorder(stream, { mimeType });
    } catch (error) {
      console.warn("Falling back to default MediaRecorder settings.", error);
    }
  }

  return new MediaRecorder(stream);
}

function bestMimeType() {
  if (typeof MediaRecorder === "undefined" || typeof MediaRecorder.isTypeSupported !== "function") {
    return "";
  }

  const options = ["video/webm;codecs=vp9", "video/webm;codecs=vp8", "video/webm"];
  return options.find((type) => MediaRecorder.isTypeSupported(type)) || "";
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

function resetStudio() {
  clearAutoRenderTimer();
  cancelAnimationFrame(state.animationId);
  state.image = null;
  state.imageName = "";
  state.isRendering = false;
  state.pendingRender = false;
  state.lastAutoSignature = "";
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
  updateGenerateButton();
  drawFrame(0);
  setStatus("초기화되었습니다. 이미지를 업로드하고 프롬프트를 입력하면 자동 생성됩니다.");
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

promptInput.addEventListener("input", () => {
  state.lastAutoSignature = "";
  applyPromptPreset();
  if (state.image) {
    drawFrame(0.25);
  }
  scheduleAutoRender("prompt");
});

presetList.addEventListener("click", (event) => {
  const card = event.target.closest(".preset-card");
  if (!card) {
    return;
  }

  state.lastAutoSignature = "";
  setPreset(card.dataset.preset);
  scheduleAutoRender("preset");
});

document.querySelectorAll("[data-duration]").forEach((button) => {
  button.addEventListener("click", () => {
    document.querySelectorAll("[data-duration]").forEach((item) => {
      item.classList.toggle("active", item === button);
    });
    state.duration = Number(button.dataset.duration);
    state.lastAutoSignature = "";
    scheduleAutoRender("duration");
  });
});

document.querySelectorAll("[data-aspect]").forEach((button) => {
  button.addEventListener("click", () => {
    document.querySelectorAll("[data-aspect]").forEach((item) => {
      item.classList.toggle("active", item === button);
    });
    state.aspect = button.dataset.aspect;
    state.lastAutoSignature = "";
    drawFrame(0);
    scheduleAutoRender("aspect");
  });
});

sampleButton.addEventListener("click", createSampleImage);
clearButton.addEventListener("click", resetStudio);
generateButton.addEventListener("click", () => renderVideo({ auto: false }));
previewMotionButton.addEventListener("click", previewMotion);

setStatus("이미지를 업로드하고 프롬프트를 입력하면 자동으로 영상이 생성됩니다.");
updateGenerateButton();
drawFrame(0);
