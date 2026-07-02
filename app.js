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
const promptPlan = document.querySelector("#promptPlan");

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

function promptHas(text, terms) {
  return terms.some((term) => text.includes(term));
}

function analyzePrompt(rawPrompt = getPrompt()) {
  const text = rawPrompt.toLowerCase();
  const profile = {
    accent: "#14d7c6",
    secondary: "#ff2f92",
    preset: "drift",
    scene: "cinematic",
    camera: "slow push",
    mood: "balanced",
    subject: "center focus",
    particle: "dust",
    bars: false,
    fog: false,
    rain: false,
    snow: false,
    embers: false,
    stars: false,
    bubbles: false,
    streaks: false,
    pulse: false,
    rays: false,
    flare: false,
    shake: 0.15,
    depth: 0.55,
    saturation: 1.12,
    contrast: 1.08,
    brightness: 1,
    vignette: 0.34,
    focusX: 0.5,
    focusY: 0.5,
    seed: hashText(text || "movie-maker"),
    plan: [],
  };

  const addPlan = (label) => {
    if (!profile.plan.includes(label)) {
      profile.plan.push(label);
    }
  };

  if (promptHas(text, ["fast", "speed", "racing", "chase", "run", "빠른", "질주", "속도", "추격", "달리는", "레이싱"])) {
    profile.preset = "speed";
    profile.camera = "speed ramp";
    profile.streaks = true;
    profile.pulse = true;
    profile.shake = 0.72;
    profile.depth = 0.78;
    addPlan("speed ramp");
  }

  if (promptHas(text, ["orbit", "circle", "rotate", "360", "회전", "돌아", "원형", "오비트"])) {
    profile.preset = "orbit";
    profile.camera = "soft orbit";
    profile.depth = 0.82;
    addPlan("orbit camera");
  }

  if (promptHas(text, ["zoom", "impact", "close", "close-up", "dramatic", "줌", "확대", "클로즈업", "강렬", "임팩트"])) {
    profile.preset = "zoom";
    profile.camera = "impact zoom";
    profile.pulse = true;
    profile.depth = 0.72;
    addPlan("impact zoom");
  }

  if (promptHas(text, ["left", "왼쪽", "좌측"])) {
    profile.focusX = 0.34;
    addPlan("left focus");
  }

  if (promptHas(text, ["right", "오른쪽", "우측"])) {
    profile.focusX = 0.66;
    addPlan("right focus");
  }

  if (promptHas(text, ["top", "sky", "하늘", "위쪽", "상단"])) {
    profile.focusY = 0.38;
    addPlan("upper focus");
  }

  if (promptHas(text, ["bottom", "road", "street", "아래", "하단", "도로", "거리"])) {
    profile.focusY = 0.62;
    addPlan("lower focus");
  }

  if (promptHas(text, ["person", "portrait", "face", "woman", "man", "인물", "사람", "얼굴", "여자", "남자", "모델"])) {
    profile.subject = "portrait focus";
    profile.focusY = Math.min(profile.focusY, 0.46);
    profile.depth = Math.max(profile.depth, 0.72);
    addPlan("portrait depth");
  }

  if (promptHas(text, ["car", "vehicle", "bike", "train", "자동차", "차량", "바이크", "기차"])) {
    profile.subject = "vehicle motion";
    profile.focusY = Math.max(profile.focusY, 0.58);
    profile.streaks = true;
    addPlan("motion streaks");
  }

  if (promptHas(text, ["product", "luxury", "commercial", "제품", "상품", "명품", "광고"])) {
    profile.subject = "product hero";
    profile.preset = profile.preset === "drift" ? "zoom" : profile.preset;
    profile.rays = true;
    profile.flare = true;
    profile.saturation = 1.2;
    addPlan("hero lighting");
  }

  if (promptHas(text, ["neon", "cyber", "city", "night", "club", "네온", "사이버", "도시", "밤", "클럽"])) {
    profile.scene = "neon night";
    profile.mood = "electric";
    profile.accent = "#14d7c6";
    profile.secondary = "#ff2f92";
    profile.streaks = true;
    profile.flare = true;
    profile.saturation = 1.32;
    profile.contrast = 1.14;
    addPlan("neon grade");
  }

  if (promptHas(text, ["warm", "sunset", "gold", "sun", "노을", "석양", "따뜻", "황금", "햇살"])) {
    profile.scene = "golden hour";
    profile.mood = "warm";
    profile.accent = "#f7b938";
    profile.secondary = "#ff6b35";
    profile.rays = true;
    profile.fog = true;
    profile.brightness = 1.04;
    addPlan("golden rays");
  }

  if (promptHas(text, ["dream", "soft", "fog", "mist", "몽환", "부드러운", "안개", "미스트"])) {
    profile.scene = "dream haze";
    profile.mood = "soft";
    profile.accent = "#b8c7ff";
    profile.secondary = "#ffd6e8";
    profile.fog = true;
    profile.vignette = 0.22;
    profile.contrast = 0.96;
    addPlan("soft haze");
  }

  if (promptHas(text, ["rain", "wet", "storm", "비", "비오는", "폭풍", "젖은"])) {
    profile.rain = true;
    profile.particle = "rain";
    profile.accent = "#7fd5ff";
    profile.secondary = "#b8c7ff";
    profile.contrast = 1.12;
    addPlan("rain layer");
  }

  if (promptHas(text, ["snow", "winter", "ice", "눈", "겨울", "얼음"])) {
    profile.snow = true;
    profile.particle = "snow";
    profile.accent = "#d9f7ff";
    profile.secondary = "#9bbcff";
    profile.brightness = 1.06;
    addPlan("snow drift");
  }

  if (promptHas(text, ["fire", "ember", "explosion", "불", "화염", "불꽃", "폭발"])) {
    profile.embers = true;
    profile.particle = "embers";
    profile.accent = "#ff9d00";
    profile.secondary = "#ff2e00";
    profile.pulse = true;
    profile.contrast = 1.18;
    addPlan("ember energy");
  }

  if (promptHas(text, ["space", "galaxy", "stars", "우주", "은하", "별"])) {
    profile.stars = true;
    profile.particle = "stars";
    profile.accent = "#8aa7ff";
    profile.secondary = "#e6d6ff";
    profile.vignette = 0.48;
    addPlan("star field");
  }

  if (promptHas(text, ["underwater", "ocean", "sea", "water", "수중", "바다", "물속", "물"])) {
    profile.bubbles = true;
    profile.particle = "bubbles";
    profile.accent = "#23d7c8";
    profile.secondary = "#2d7dff";
    profile.fog = true;
    profile.depth = Math.max(profile.depth, 0.72);
    addPlan("water depth");
  }

  if (promptHas(text, ["cinematic", "film", "movie", "trailer", "시네마틱", "영화", "필름", "예고편"])) {
    profile.bars = true;
    profile.vignette = Math.max(profile.vignette, 0.42);
    profile.contrast = Math.max(profile.contrast, 1.14);
    addPlan("film bars");
  }

  if (promptHas(text, ["horror", "dark", "scary", "공포", "어두운", "무서운"])) {
    profile.mood = "dark";
    profile.accent = "#6cff9a";
    profile.secondary = "#a12bff";
    profile.vignette = 0.58;
    profile.contrast = 1.24;
    profile.brightness = 0.86;
    profile.shake = Math.max(profile.shake, 0.42);
    addPlan("dark tension");
  }

  if (!profile.plan.length) {
    addPlan("depth parallax");
    addPlan("cinematic grade");
  }

  return profile;
}

function promptProfile() {
  return analyzePrompt();
}

function presetFromPrompt(text) {
  return analyzePrompt(text).preset;
}

function updatePromptPlan(profile = promptProfile()) {
  if (!promptPlan) {
    return;
  }

  promptPlan.innerHTML = "";
  const title = document.createElement("span");
  title.className = "prompt-plan-title";
  title.textContent = "Scene";
  promptPlan.append(title);

  const effectTags = [
    profile.rain ? "rain layer" : "",
    profile.snow ? "snow drift" : "",
    profile.embers ? "ember energy" : "",
    profile.stars ? "star field" : "",
    profile.bubbles ? "water depth" : "",
    profile.fog ? "soft haze" : "",
    profile.rays ? "light rays" : "",
    profile.streaks ? "motion streaks" : "",
  ].filter(Boolean);
  const tags = [...new Set([
    profile.scene,
    profile.camera,
    profile.subject,
    ...effectTags,
    ...profile.plan,
  ])];

  tags.slice(0, 7).forEach((tag) => {
    const chip = document.createElement("span");
    chip.className = "prompt-chip";
    chip.textContent = tag;
    promptPlan.append(chip);
  });
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
    updatePromptPlan(analyzePrompt(""));
    return;
  }

  const profile = promptProfile();
  setPreset(profile.preset, false);
  updatePromptPlan(profile);
}

function frameForPreset(progress, profile = promptProfile()) {
  const wave = Math.sin(progress * Math.PI * 2);
  const ease = 0.5 - Math.cos(progress * Math.PI) / 2;
  const shakeX = Math.sin(progress * Math.PI * 18 + profile.seed) * profile.shake * 8;
  const shakeY = Math.cos(progress * Math.PI * 15 + profile.seed) * profile.shake * 5;

  if (state.preset === "speed") {
    return {
      x: -120 + ease * 240 + shakeX,
      y: wave * 12 + shakeY,
      scale: 1.08 + profile.depth * 0.04,
      rotate: wave * 0.012 + profile.shake * 0.006,
    };
  }

  if (state.preset === "orbit") {
    return {
      x: Math.cos(progress * Math.PI * 2) * (34 + profile.depth * 28) + shakeX * 0.35,
      y: Math.sin(progress * Math.PI * 2) * (22 + profile.depth * 20) + shakeY * 0.35,
      scale: 1.08 + profile.depth * 0.05,
      rotate: wave * 0.02,
    };
  }

  if (state.preset === "zoom") {
    return {
      x: (0.5 - profile.focusX) * canvas.width * ease * 0.08 + shakeX * 0.28,
      y: (0.5 - profile.focusY) * canvas.height * ease * 0.08 + shakeY * 0.28,
      scale: 1.02 + ease * (0.16 + profile.depth * 0.08),
      rotate: wave * 0.003,
    };
  }

  return {
    x: -34 + ease * 68 + shakeX * 0.18,
    y: -14 + ease * 28 + shakeY * 0.18,
    scale: 1.04 + ease * (0.04 + profile.depth * 0.04),
    rotate: wave * 0.007,
  };
}

function coverMetrics(image, scaleMultiplier = 1, offsetX = 0, offsetY = 0) {
  const scale = Math.max(canvas.width / image.width, canvas.height / image.height) * scaleMultiplier;
  const width = image.width * scale;
  const height = image.height * scale;
  return {
    x: (canvas.width - width) / 2 + offsetX,
    y: (canvas.height - height) / 2 + offsetY,
    width,
    height,
  };
}

function drawCoverImage(image, frame, filter = "none", alpha = 1) {
  const metrics = coverMetrics(image, frame.scale, frame.x, frame.y);
  ctx.save();
  ctx.globalAlpha = alpha;
  ctx.filter = filter;
  ctx.drawImage(image, metrics.x, metrics.y, metrics.width, metrics.height);
  ctx.restore();
}

function drawLayeredImage(progress, profile, frame) {
  const focusShiftX = (0.5 - profile.focusX) * canvas.width;
  const focusShiftY = (0.5 - profile.focusY) * canvas.height;

  drawCoverImage(
    state.image,
    {
      x: frame.x * 0.42 - focusShiftX * 0.025,
      y: frame.y * 0.42 - focusShiftY * 0.02,
      scale: frame.scale + 0.08,
    },
    `blur(${2 + profile.depth * 4}px) brightness(${0.72 * profile.brightness}) saturate(${profile.saturation * 0.78})`,
    1,
  );

  drawCoverImage(
    state.image,
    {
      x: frame.x * 0.72,
      y: frame.y * 0.72,
      scale: frame.scale + 0.025,
    },
    `contrast(${profile.contrast}) saturate(${profile.saturation}) brightness(${profile.brightness})`,
    0.92,
  );

  drawDepthBands(progress, profile, frame);
  drawFocusLayer(progress, profile, frame);
  drawForegroundPass(progress, profile, frame);
}

function drawDepthBands(progress, profile, frame) {
  const bands = [
    { top: 0, height: 0.28, power: -0.45, blur: 1.2, alpha: 0.42 },
    { top: 0.32, height: 0.24, power: 0.25, blur: 0, alpha: 0.28 },
    { top: 0.62, height: 0.38, power: 0.7, blur: 1.6, alpha: 0.5 },
  ];

  bands.forEach((band, index) => {
    const y = canvas.height * band.top;
    const h = canvas.height * band.height;
    const drift = Math.sin(progress * Math.PI * 2 + index * 1.7) * profile.depth * 16;
    const frameBand = {
      x: frame.x + drift + (index - 1) * profile.depth * 14,
      y: frame.y + band.power * profile.depth * 24,
      scale: frame.scale + 0.035 + Math.abs(band.power) * profile.depth * 0.05,
    };

    ctx.save();
    ctx.beginPath();
    ctx.rect(0, y, canvas.width, h);
    ctx.clip();
    drawCoverImage(
      state.image,
      frameBand,
      `blur(${band.blur}px) contrast(${profile.contrast * 1.04}) saturate(${profile.saturation * 1.04})`,
      band.alpha,
    );
    ctx.restore();
  });
}

function drawFocusLayer(progress, profile, frame) {
  const x = canvas.width * profile.focusX;
  const y = canvas.height * profile.focusY;
  const radiusX = canvas.width * (0.24 + profile.depth * 0.08);
  const radiusY = canvas.height * (0.24 + profile.depth * 0.06);
  const pulse = Math.sin(progress * Math.PI * 2) * 0.012;

  ctx.save();
  ctx.beginPath();
  ctx.ellipse(x, y, radiusX, radiusY, 0, 0, Math.PI * 2);
  ctx.clip();
  drawCoverImage(
    state.image,
    {
      x: frame.x + (0.5 - profile.focusX) * canvas.width * 0.045,
      y: frame.y + (0.5 - profile.focusY) * canvas.height * 0.04,
      scale: frame.scale + 0.055 + pulse,
    },
    `contrast(${profile.contrast * 1.12}) saturate(${profile.saturation * 1.12}) brightness(${profile.brightness * 1.05})`,
    0.9,
  );
  ctx.restore();

  const glow = ctx.createRadialGradient(x, y, 0, x, y, Math.max(radiusX, radiusY) * 1.25);
  glow.addColorStop(0, hexToRgba(profile.accent, 0.22));
  glow.addColorStop(0.58, hexToRgba(profile.accent, 0.04));
  glow.addColorStop(1, "rgba(0, 0, 0, 0)");
  ctx.save();
  ctx.globalCompositeOperation = "screen";
  ctx.fillStyle = glow;
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.restore();
}

function drawForegroundPass(progress, profile, frame) {
  const height = canvas.height * 0.2;
  const y = canvas.height - height;
  const shift = Math.sin(progress * Math.PI * 2 + 0.7) * profile.depth * 34;

  ctx.save();
  ctx.beginPath();
  ctx.rect(0, y, canvas.width, height);
  ctx.clip();
  drawCoverImage(
    state.image,
    {
      x: frame.x + shift,
      y: frame.y + profile.depth * 26,
      scale: frame.scale + 0.12,
    },
    `blur(${1.8 + profile.depth * 1.8}px) contrast(${profile.contrast}) saturate(${profile.saturation})`,
    0.34,
  );
  ctx.restore();
}

function drawPromptEffects(progress, profile) {
  const wash = ctx.createLinearGradient(0, 0, canvas.width, canvas.height);
  wash.addColorStop(0, hexToRgba(profile.accent, 0.18));
  wash.addColorStop(0.52, "rgba(0, 0, 0, 0)");
  wash.addColorStop(1, hexToRgba(profile.secondary, 0.2));

  ctx.save();
  ctx.globalCompositeOperation = "screen";
  ctx.fillStyle = wash;
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.restore();

  if (profile.fog) {
    drawFog(progress, profile);
  }

  if (profile.rays) {
    drawLightRays(progress, profile);
  }

  if (profile.streaks || state.preset === "speed") {
    drawSpeedStreaks(progress, profile);
  }

  if (profile.pulse) {
    drawPulse(progress, profile);
  }

  drawParticles(progress, profile);

  if (profile.flare) {
    drawLensFlare(progress, profile);
  }

  drawFilmTexture(progress, profile);

  if (profile.bars) {
    const barHeight = Math.max(36, canvas.height * 0.075);
    ctx.fillStyle = "rgba(0, 0, 0, 0.76)";
    ctx.fillRect(0, 0, canvas.width, barHeight);
    ctx.fillRect(0, canvas.height - barHeight, canvas.width, barHeight);
  }
}

function drawFog(progress, profile) {
  ctx.save();
  ctx.globalAlpha = 0.12 + Math.sin(progress * Math.PI * 2) * 0.035;
  ctx.filter = "blur(18px)";
  for (let i = 0; i < 8; i += 1) {
    const radius = canvas.width * (0.16 + (i % 3) * 0.045);
    const x = canvas.width * seededRandom(profile.seed, i) + Math.sin(progress * 2 + i) * canvas.width * 0.08;
    const y = canvas.height * seededRandom(profile.seed + 7, i) + Math.cos(progress * 1.7 + i) * canvas.height * 0.08;
    const fog = ctx.createRadialGradient(x, y, 0, x, y, radius);
    fog.addColorStop(0, hexToRgba(profile.accent, 0.32));
    fog.addColorStop(1, "rgba(255, 255, 255, 0)");
    ctx.fillStyle = fog;
    ctx.beginPath();
    ctx.arc(x, y, radius, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.restore();
}

function drawLightRays(progress, profile) {
  ctx.save();
  ctx.globalCompositeOperation = "screen";
  for (let i = 0; i < 5; i += 1) {
    const x = canvas.width * (0.08 + i * 0.18 + Math.sin(progress + i) * 0.025);
    const ray = ctx.createLinearGradient(x, 0, x + canvas.width * 0.22, canvas.height);
    ray.addColorStop(0, hexToRgba(profile.accent, 0.18));
    ray.addColorStop(0.55, hexToRgba(profile.secondary, 0.05));
    ray.addColorStop(1, "rgba(255, 255, 255, 0)");
    ctx.fillStyle = ray;
    ctx.beginPath();
    ctx.moveTo(x, 0);
    ctx.lineTo(x + canvas.width * 0.16, 0);
    ctx.lineTo(x + canvas.width * 0.36, canvas.height);
    ctx.lineTo(x - canvas.width * 0.05, canvas.height);
    ctx.closePath();
    ctx.fill();
  }
  ctx.restore();
}

function drawSpeedStreaks(progress, profile) {
  ctx.save();
  ctx.globalAlpha = 0.22 + profile.shake * 0.08;
  ctx.strokeStyle = profile.accent;
  ctx.lineWidth = Math.max(3, canvas.width * 0.004);
  for (let i = 0; i < 18; i += 1) {
    const y = (i / 17) * canvas.height + Math.sin(progress * 10 + i) * 28;
    const start = -canvas.width * 0.22 + ((progress * 1.7 + seededRandom(profile.seed, i)) % 1) * canvas.width * 0.42;
    ctx.beginPath();
    ctx.moveTo(start, y);
    ctx.lineTo(canvas.width * (0.62 + seededRandom(profile.seed + 5, i) * 0.32), y - canvas.height * 0.16);
    ctx.stroke();
  }
  ctx.restore();
}

function drawPulse(progress, profile) {
  ctx.save();
  ctx.globalAlpha = 0.16;
  ctx.strokeStyle = profile.secondary;
  ctx.lineWidth = Math.max(5, canvas.width * 0.006);
  ctx.beginPath();
  ctx.arc(
    canvas.width * profile.focusX,
    canvas.height * profile.focusY,
    Math.min(canvas.width, canvas.height) * (0.18 + progress * 0.42),
    0,
    Math.PI * 2,
  );
  ctx.stroke();
  ctx.restore();
}

function drawParticles(progress, profile) {
  const count = profile.rain ? 90 : profile.snow ? 70 : profile.embers ? 55 : profile.stars ? 80 : profile.bubbles ? 45 : 34;
  ctx.save();
  ctx.globalCompositeOperation = profile.stars || profile.embers ? "screen" : "source-over";

  for (let i = 0; i < count; i += 1) {
    const baseX = seededRandom(profile.seed, i) * canvas.width;
    const baseY = seededRandom(profile.seed + 11, i) * canvas.height;
    const speed = 0.25 + seededRandom(profile.seed + 23, i) * 0.75;
    let x = baseX;
    let y = baseY;
    let size = 1 + seededRandom(profile.seed + 31, i) * 3;
    let alpha = 0.12 + seededRandom(profile.seed + 41, i) * 0.34;
    let color = profile.accent;

    if (profile.rain) {
      x = (baseX + progress * canvas.width * 0.28 * speed) % canvas.width;
      y = (baseY + progress * canvas.height * 1.4 * speed) % canvas.height;
      ctx.globalAlpha = 0.34;
      ctx.strokeStyle = hexToRgba("#d9f7ff", 0.42);
      ctx.lineWidth = 1.4;
      ctx.beginPath();
      ctx.moveTo(x, y);
      ctx.lineTo(x - canvas.width * 0.025, y + canvas.height * 0.09);
      ctx.stroke();
      continue;
    }

    if (profile.snow) {
      x = (baseX + Math.sin(progress * 5 + i) * 22) % canvas.width;
      y = (baseY + progress * canvas.height * 0.28 * speed) % canvas.height;
      color = "#ffffff";
      alpha = 0.28;
      size += 1.6;
    } else if (profile.embers) {
      x = baseX + Math.sin(progress * 8 + i) * 24;
      y = (baseY - progress * canvas.height * 0.7 * speed + canvas.height) % canvas.height;
      color = i % 2 ? profile.accent : profile.secondary;
      alpha = 0.28;
      size += 1.2;
    } else if (profile.stars) {
      x = baseX + Math.sin(progress * 1.8 + i) * 8;
      y = baseY + Math.cos(progress * 1.4 + i) * 6;
      color = "#ffffff";
      alpha = 0.18 + Math.sin(progress * 9 + i) * 0.12;
      size = 1 + seededRandom(profile.seed + 31, i) * 2;
    } else if (profile.bubbles) {
      x = baseX + Math.sin(progress * 5 + i) * 20;
      y = (baseY - progress * canvas.height * 0.36 * speed + canvas.height) % canvas.height;
      color = "#d9fffb";
      alpha = 0.18;
      size += 2.4;
    } else {
      x = baseX + Math.sin(progress * 3 + i) * 16;
      y = baseY + Math.cos(progress * 2 + i) * 10;
    }

    ctx.globalAlpha = Math.max(0.03, alpha);
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.arc(x, y, size, 0, Math.PI * 2);
    ctx.fill();
  }

  ctx.restore();
}

function drawLensFlare(progress, profile) {
  const x = canvas.width * (0.18 + Math.sin(progress * Math.PI * 2) * 0.04);
  const y = canvas.height * 0.24;
  ctx.save();
  ctx.globalCompositeOperation = "screen";
  const flare = ctx.createRadialGradient(x, y, 0, x, y, canvas.width * 0.18);
  flare.addColorStop(0, hexToRgba(profile.accent, 0.4));
  flare.addColorStop(0.2, hexToRgba(profile.secondary, 0.16));
  flare.addColorStop(1, "rgba(255, 255, 255, 0)");
  ctx.fillStyle = flare;
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  for (let i = 0; i < 4; i += 1) {
    ctx.globalAlpha = 0.12 - i * 0.018;
    ctx.fillStyle = i % 2 ? profile.accent : profile.secondary;
    ctx.beginPath();
    ctx.arc(x + canvas.width * (0.12 + i * 0.09), y + canvas.height * (0.06 + i * 0.025), 12 + i * 10, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.restore();
}

function drawFilmTexture(progress, profile) {
  ctx.save();
  ctx.globalAlpha = 0.045;
  ctx.fillStyle = "#ffffff";
  const step = Math.max(12, Math.floor(canvas.width / 90));
  for (let y = 0; y < canvas.height; y += step) {
    for (let x = 0; x < canvas.width; x += step) {
      const n = seededRandom(profile.seed + Math.floor(progress * 100), x * 3 + y * 5);
      if (n > 0.58) {
        ctx.fillRect(x, y, 1.3, 1.3);
      }
    }
  }
  ctx.restore();
}

function drawOverlay(progress, profile) {
  const gradient = ctx.createLinearGradient(0, 0, canvas.width, canvas.height);
  gradient.addColorStop(0, "rgba(0, 0, 0, 0.1)");
  gradient.addColorStop(0.48, "rgba(0, 0, 0, 0)");
  gradient.addColorStop(1, `rgba(0, 0, 0, ${profile.vignette})`);
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  drawPromptEffects(progress, profile);
}

function hexToRgba(hex, alpha) {
  const value = hex.replace("#", "");
  const r = parseInt(value.slice(0, 2), 16);
  const g = parseInt(value.slice(2, 4), 16);
  const b = parseInt(value.slice(4, 6), 16);
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

function hashText(text) {
  let hash = 2166136261;
  for (let i = 0; i < text.length; i += 1) {
    hash ^= text.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  return Math.abs(hash);
}

function seededRandom(seed, index) {
  const x = Math.sin(seed * 0.0001 + index * 12.9898) * 43758.5453;
  return x - Math.floor(x);
}

function drawFrame(progress = 0) {
  resizeCanvasForAspect();
  ctx.clearRect(0, 0, canvas.width, canvas.height);

  if (!state.image) {
    ctx.fillStyle = "#0b0c0d";
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    return;
  }

  const profile = promptProfile();
  const frame = frameForPreset(progress, profile);

  ctx.save();
  ctx.translate(canvas.width / 2, canvas.height / 2);
  ctx.rotate(frame.rotate);
  ctx.translate(-canvas.width / 2, -canvas.height / 2);
  drawLayeredImage(progress, profile, frame);
  ctx.restore();

  drawOverlay(progress, profile);
}

function showImageReady(name) {
  state.imageName = name;
  state.lastAutoSignature = "";
  imageMeta.textContent = name;
  emptyState.classList.add("hidden");
  applyPromptPreset();
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
    applyPromptPreset();
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
  setStatus(reason === "prompt" ? "프롬프트를 장면 계획으로 변환했습니다. 곧 자동 생성합니다." : "영상 자동 생성 대기 중입니다.");
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
    setStatus("프롬프트 계획에 맞춰 레이어와 조명을 합성하고 있습니다.");

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
    setStatus("디테일 영상이 자동 생성되었습니다. 오른쪽에서 재생하거나 다운로드할 수 있습니다.");
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
  updatePromptPlan(analyzePrompt(""));
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
  updatePromptPlan(promptProfile());
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
updatePromptPlan(analyzePrompt(""));
drawFrame(0);
