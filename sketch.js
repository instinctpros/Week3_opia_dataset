let dataset;
let nodes = [];
let backgroundStars = [];
let hoveredNode = null;
let tooltipLift = 0;
let userNode = null;
let soundEnabled = false;
let oscillators = [];
let envelopes = [];
let bowlFilter;
let bowlReverb;
let reducedMotion = false;
let activeCategory = null;
const clusterLabelAlpha = { age: 0, identity: 0, race: 0, income: 0, location: 0 };

const GOLD = [246, 207, 116];
const CREAM = [255, 247, 214];
const MIST = [170, 187, 224];
const CATEGORY_ORDER = ["age", "identity", "location", "race", "income"];
const CATEGORY_LABELS = {
  age: "AGE",
  identity: "IDENTITY",
  race: "RACE + ETHNICITY",
  income: "INCOME",
  location: "LOCATION"
};
const CLUSTER_OFFSETS = {
  age: [
    [-0.88, -0.26],
    [-0.12, -0.82],
    [0.78, -0.08],
    [-0.34, 0.76]
  ],
  identity: [
    [-0.92, -0.18],
    [-0.52, -0.78],
    [0.08, -0.60],
    [0.84, -0.34],
    [0.64, 0.28],
    [0.18, 0.86],
    [-0.42, 0.62],
    [-0.76, 0.22]
  ],
  race: [
    [-0.86, -0.38],
    [-0.18, -0.72],
    [0.76, -0.48],
    [0.88, 0.28],
    [0.04, 0.82],
    [-0.58, 0.46]
  ],
  income: [
    [-0.78, -0.58],
    [0.06, -0.82],
    [0.82, -0.24],
    [0.60, 0.58],
    [-0.12, 0.76],
    [-0.90, 0.14]
  ],
  location: [
    [-0.72, -0.40],
    [0.34, -0.68],
    [0.78, 0.26],
    [-0.40, 0.72]
  ]
};

function preload() {
  dataset = loadJSON("data/loneliness.json");
}

function setup() {
  const wrap = document.getElementById("canvas-wrap");
  const canvas = createCanvas(wrap.clientWidth, wrap.clientHeight);
  canvas.parent("p5-canvas");
  canvas.attribute("aria-hidden", "true");
  pixelDensity(Math.min(window.devicePixelRatio || 1, 2));
  reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  createBackgroundStars();
  buildUniverse();
  bindInterface();
}

function createBackgroundStars() {
  backgroundStars = [];
  const count = floor(map(width * height, 320000, 1600000, 290, 560, true));
  for (let i = 0; i < count; i++) {
    backgroundStars.push({
      x: random(width),
      y: random(height),
      size: random(0.7, 3.1),
      phase: random(TWO_PI),
      glint: random() < 0.24
    });
  }
}

function buildUniverse() {
  nodes = [];
  CATEGORY_ORDER.forEach(category => {
    const items = dataset.groups[category];
    items.forEach((item, index) => {
      nodes.push(new DataNode(item, category, index));
    });
  });
}

function draw() {
  drawNightSky();
  activeCategory = categoryAtPointer();
  drawClusterNames();

  for (const node of nodes) node.update();
  if (userNode) userNode.update();

  const drawerOpen = document.getElementById("entry-drawer").open;
  const nextHoveredNode = drawerOpen ? null : findHoveredNode();
  if (nextHoveredNode !== hoveredNode) {
    hoveredNode = nextHoveredNode;
    tooltipLift = 0;

    if (hoveredNode) playBowlTone(hoveredNode.connectivity);
  }

  if (hoveredNode) {
    drawAurora(hoveredNode);
    drawConnections(hoveredNode);
  }

  for (const node of nodes) node.display(node === hoveredNode, node.category === activeCategory);
  if (userNode) userNode.display(userNode === hoveredNode, activeCategory === "location");

  if (hoveredNode) drawMapTooltip(hoveredNode);
}

function drawNightSky() {
  const top = color(8, 26, 65);
  const middle = color(5, 16, 43);
  const bottom = color(2, 8, 25);

  for (let y = 0; y < height; y += 4) {
    const amount = y / height;
    const skyColor = amount < 0.56
      ? lerpColor(top, middle, amount / 0.56)
      : lerpColor(middle, bottom, (amount - 0.56) / 0.44);
    stroke(skyColor);
    strokeWeight(5);
    line(0, y, width, y);
  }

  for (const star of backgroundStars) {
    const twinkle = reducedMotion ? 0.72 : 0.58 + 0.40 * sin(frameCount * 0.018 + star.phase);
    const opacity = 185 * twinkle;

    if (star.glint) {
      stroke(255, 247, 214, opacity * 0.62);
      strokeWeight(0.8);
      const ray = star.size * 2.5;
      line(star.x - ray, star.y, star.x + ray, star.y);
      line(star.x, star.y - ray, star.x, star.y + ray);
    }

    noStroke();
    fill(255, 247, 214, opacity);
    circle(star.x, star.y, star.glint ? star.size * 1.25 : star.size);
  }
}

function clusterCenter(category) {
  const mobile = width < 700;
  const layouts = mobile
    ? {
        age: [0.32, 0.17],
        identity: [0.67, 0.35],
        location: [0.42, 0.51],
        race: [0.31, 0.69],
        income: [0.65, 0.86]
      }
    : {
        age: [0.22, 0.29],
        identity: [0.77, 0.28],
        location: [0.50, 0.51],
        race: [0.25, 0.73],
        income: [0.76, 0.72]
      };
  return { x: width * layouts[category][0], y: height * layouts[category][1] };
}

function clusterRadii(category) {
  if (width < 700) {
    if (category === "location") return { x: 86, y: 63 };
    return category === "identity" ? { x: 118, y: 88 } : { x: 104, y: 72 };
  }
  const base = min(width, height);
  if (category === "location") return { x: min(118, base * 0.15), y: min(82, base * 0.1) };
  return category === "identity"
    ? { x: min(190, base * 0.22), y: min(125, base * 0.145) }
    : { x: min(160, base * 0.19), y: min(108, base * 0.13) };
}

function categoryAtPointer() {
  if (document.getElementById("entry-drawer").open) return null;
  let nearest = null;
  let nearestScore = Infinity;

  for (const category of CATEGORY_ORDER) {
    const center = clusterCenter(category);
    const radii = clusterRadii(category);
    const dx = (mouseX - center.x) / (radii.x * 1.42);
    const dy = (mouseY - center.y) / (radii.y * 1.58);
    const score = dx * dx + dy * dy;
    if (score < 1 && score < nearestScore) {
      nearest = category;
      nearestScore = score;
    }
  }

  return nearest;
}

function drawClusterNames() {
  noStroke();
  textAlign(CENTER, CENTER);
  textFont("Arial");
  textStyle(NORMAL);

  for (const category of CATEGORY_ORDER) {
    const center = clusterCenter(category);
    const target = category === activeCategory ? 1 : 0;
    const ease = reducedMotion ? 1 : 0.12;
    clusterLabelAlpha[category] = lerp(clusterLabelAlpha[category], target, ease);

    if (clusterLabelAlpha[category] < 0.025) continue;
    fill(170, 187, 224, 145 * clusterLabelAlpha[category]);
    textSize((width < 700 ? 11 : 12) + clusterLabelAlpha[category] * 1.5);
    text(CATEGORY_LABELS[category], center.x, center.y);
  }
}

function drawAurora(focus) {
  const palette = auroraPalette(focus.connectivity);
  const motion = reducedMotion ? 0 : frameCount * 0.0018;
  noFill();

  for (let band = 0; band < 6; band++) {
    const c = lerpColor(color(...palette[0]), color(...palette[1]), band / 5);
    c.setAlpha(14 + band * 2.5);
    stroke(c);
    strokeWeight(19 - band * 2.5);
    beginShape();
    for (let x = -40; x <= width + 40; x += 20) {
      const baseY = focus.y * 0.52 + height * 0.1 + band * 14;
      const wave = noise(x * 0.005, band * 0.21, motion) * 160 - 76;
      curveVertex(x, baseY + wave);
    }
    endShape();
  }
}

function drawConnections(focus) {
  const allNodes = userNode ? [...nodes, userNode] : nodes;
  const candidates = focus.isUser
    ? CATEGORY_ORDER.map(category => nodes.find(node => node.category === category && node.label === focus.matches[category])).filter(Boolean)
    : allNodes
        .filter(node => node !== focus && node.category === focus.category)
        .sort((a, b) => dist(focus.x, focus.y, a.x, a.y) - dist(focus.x, focus.y, b.x, b.y))
        .slice(0, 2);
  const palette = auroraPalette(focus.connectivity);

  for (let i = 0; i < candidates.length; i++) {
    const target = candidates[i];
    const c = lerpColor(color(...palette[0]), color(...palette[1]), i);
    c.setAlpha(70 - i * 18);
    stroke(c);
    strokeWeight(1.1);
    noFill();
    const sway = reducedMotion ? 0 : sin(frameCount * 0.004 + i) * 12;
    bezier(
      focus.x, focus.y,
      focus.x + sway, (focus.y + target.y) / 2,
      target.x - sway, (focus.y + target.y) / 2,
      target.x, target.y
    );
  }
}

function auroraPalette(connectivity) {
  if (connectivity < 55) return [[237, 83, 145], [246, 207, 116]];
  return [[76, 208, 255], [92, 235, 168]];
}

class DataNode {
  constructor(item, category, index, isUser = false) {
    this.label = item.label;
    this.value = item.value;
    this.truth = item.truth || "";
    this.feeling = item.feeling || "";
    this.contextOnly = Boolean(item.contextOnly);
    this.matches = item.matches || {};
    this.category = category;
    this.index = index;
    this.isUser = isUser;
    this.connectivity = this.contextOnly ? 60 : 100 - this.value;
    this.x = random(width * 0.18, width * 0.82);
    this.y = random(height * 0.18, height * 0.82);
    this.tx = this.x;
    this.ty = this.y;
    this.phase = random(TWO_PI);
    this.setTarget();
  }

  setTarget() {
    if (this.isUser) {
      const place = nodes.find(node => node.category === "location" && node.label === this.matches.location);
      this.tx = place ? place.tx + 20 : clusterCenter("location").x;
      this.ty = place ? place.ty + 16 : clusterCenter("location").y;
      return;
    }

    const center = clusterCenter(this.category);
    const radii = clusterRadii(this.category);
    const point = CLUSTER_OFFSETS[this.category][this.index];
    this.tx = center.x + point[0] * radii.x;
    this.ty = center.y + point[1] * radii.y;
  }

  update() {
    const ease = reducedMotion ? 1 : 0.045;
    this.x = lerp(this.x, this.tx, ease);
    this.y = lerp(this.y, this.ty, ease);
  }

  display(active, clusterActive = false) {
    const pulse = reducedMotion ? 1 : 1 + sin(frameCount * 0.026 + this.phase) * 0.075;
    const baseSize = this.isUser ? 22 : this.contextOnly ? 12 : map(this.value, 20, 65, 9, 19, true);
    const diameter = baseSize * pulse;
    const glow = active ? diameter * 3.2 : clusterActive ? diameter * 2.2 : diameter * 1.55;
    const restingAlpha = this.contextOnly ? 90 : 158;
    const diamondAlpha = active ? 235 : clusterActive ? 205 : restingAlpha;

    noStroke();
    for (let r = glow; r > diameter; r -= 4) {
      fill(GOLD[0], GOLD[1], GOLD[2], map(r, diameter, glow, active ? 28 : clusterActive ? 18 : 10, 1));
      drawDataStar(this.x, this.y, r);
    }

    if (this.contextOnly) fill(MIST[0], MIST[1], MIST[2], diamondAlpha);
    else if (this.isUser) fill(CREAM[0], CREAM[1], CREAM[2], diamondAlpha);
    else fill(GOLD[0], GOLD[1], GOLD[2], diamondAlpha);
    drawDataStar(this.x, this.y, diameter);

    if (this.isUser && !active) {
      fill(CREAM[0], CREAM[1], CREAM[2], 170);
      textAlign(CENTER, BOTTOM);
      textFont("Arial");
      textSize(11);
      text("YOU", this.x, this.y - diameter);
    }
  }

  contains(px, py) {
    const hit = this.isUser ? 26 : this.contextOnly ? 19 : max(18, map(this.value, 20, 65, 17, 28, true));
    return dist(px, py, this.x, this.y) < hit;
  }
}

function drawDataStar(x, y, size) {
  push();
  translate(x, y);
  rotate(-HALF_PI);
  beginShape();
  for (let i = 0; i < 10; i++) {
    const angle = (TWO_PI * i) / 10;
    const radius = i % 2 === 0 ? size * 0.5 : size * 0.22;
    vertex(cos(angle) * radius, sin(angle) * radius);
  }
  endShape(CLOSE);
  pop();
}

function drawMapTooltip(node) {
  tooltipLift = min(1, tooltipLift + (reducedMotion ? 1 : 0.05));
  const eased = 1 - pow(1 - tooltipLift, 3);
  const cardWidth = min(width < 700 ? 274 : 340, width - 28);
  const cardHeight = node.isUser ? 154 : node.contextOnly ? 104 : width < 700 ? 184 : 158;
  let cardX;
  let cardY;

  if (width < 700) {
    cardX = constrain(node.x - cardWidth / 2, 14, width - cardWidth - 14);
    cardY = node.y < height * 0.5 ? node.y + 34 : node.y - cardHeight - 34;
  } else {
    cardX = node.x < width * 0.5 ? node.x + 38 : node.x - cardWidth - 38;
    cardX = constrain(cardX, 24, width - cardWidth - 24);
    cardY = node.y - cardHeight * 0.42 - eased * 12;
  }
  cardY = constrain(cardY, 112, height - cardHeight - 28);

  const alpha = 255 * eased;
  drawingContext.save();
  drawingContext.shadowColor = `rgba(1, 6, 20, ${0.82 * eased})`;
  drawingContext.shadowBlur = 10;

  textFont("Arial");
  textAlign(LEFT, TOP);
  textStyle(NORMAL);
  fill(GOLD[0], GOLD[1], GOLD[2], alpha * 0.86);
  textSize(11);
  text(node.isUser ? "YOUR PLACE IN THE SKY" : CATEGORY_LABELS[node.category], cardX, cardY);

  fill(CREAM[0], CREAM[1], CREAM[2], alpha);
  textSize(width < 700 ? 13.5 : 14.5);
  textLeading(width < 700 ? 19 : 20.5);
  const sentence = node.isUser
    ? `You reported feeling ${Math.round(node.connectivity)}% connected and described yourself as ${node.feeling}. “${node.truth}”`
    : node.contextOnly
      ? `${node.label} is a participant location marker. It helps place your reflection, but it is not a CDC prevalence estimate.`
      : `${formatSubject(node)}: ${node.value.toFixed(1)}% reported feeling socially isolated always, usually, or sometimes.\n\nWhy it matters: loneliness was linked with higher stress, frequent mental distress, and depression across the study.`;
  text(sentence, cardX, cardY + 23, cardWidth, cardHeight - 42);

  fill(MIST[0], MIST[1], MIST[2], alpha * 0.7);
  textSize(10.5);
  const sourceText = node.isUser
    ? "Your answers connect five regions"
    : node.contextOnly
      ? "Participant context"
      : "CDC BRFSS · 2022";
  text(sourceText, cardX, cardY + cardHeight - 17);
  drawingContext.restore();
}

function formatSubject(node) {
  if (node.category === "age") return `People ages ${node.label}`;
  if (node.category === "income") return `People with household income ${node.label}`;
  return node.label;
}

function findHoveredNode() {
  const allNodes = userNode ? [...nodes, userNode] : nodes;
  return allNodes.find(node => node.contains(mouseX, mouseY)) || null;
}

function bindInterface() {
  const slider = document.getElementById("connection-slider");
  slider.addEventListener("input", () => {
    document.getElementById("connection-value").textContent = slider.value;
  });

  document.getElementById("enter-button").addEventListener("click", addUserNode);
  document.getElementById("sound-toggle").addEventListener("click", toggleSound);
}

function addUserNode() {
  const truthInput = document.getElementById("truth-input");
  const truth = truthInput.value.trim();
  const connectedness = Number(document.getElementById("connection-slider").value);
  const feeling = document.getElementById("feeling-select").value;
  const matches = {
    age: document.getElementById("age-select").value,
    identity: document.getElementById("identity-select").value,
    race: document.getElementById("race-select").value,
    income: document.getElementById("income-select").value,
    location: document.getElementById("location-select").value
  };
  const message = document.getElementById("entry-message");

  if (!truth) {
    message.textContent = "Give the sky one true sentence first.";
    truthInput.focus();
    return;
  }

  userNode = new DataNode({
    label: "You",
    value: 100 - connectedness,
    low: 100 - connectedness,
    high: 100 - connectedness,
    truth,
    feeling,
    matches
  }, "you", 0, true);
  userNode.x = width * 0.9;
  userNode.y = height * 0.9;
  userNode.setTarget();
  playBowlTone(userNode.connectivity);

  message.textContent = "Your star is in the sky.";
  document.getElementById("enter-button").textContent = "Update my star";
  setTimeout(() => { document.getElementById("entry-drawer").open = false; }, 650);
}

async function toggleSound() {
  const button = document.getElementById("sound-toggle");
  soundEnabled = !soundEnabled;
  button.setAttribute("aria-pressed", String(soundEnabled));
  button.setAttribute("aria-label", soundEnabled ? "Turn sound off" : "Turn sound on");
  button.setAttribute("title", soundEnabled ? "Turn sound off" : "Turn sound on");
  button.innerHTML = soundEnabled ? "<span aria-hidden='true'>♫</span>" : "<span aria-hidden='true'>♪</span>";

  if (soundEnabled) {
    await userStartAudio();
    if (!oscillators.length) createBowlVoices();
    playBowlTone(50);
  }
}

function createBowlVoices() {
  const ratios = [1, 1.48, 2.01, 2.43];
  const volumes = [0.14, 0.065, 0.038, 0.022];

  bowlFilter = new p5.LowPass();
  bowlFilter.freq(1050);
  bowlFilter.res(1.2);
  bowlReverb = new p5.Reverb();
  bowlReverb.process(bowlFilter, 4.2, 2.1);
  bowlReverb.drywet(0.42);

  ratios.forEach((ratio, index) => {
    const osc = new p5.Oscillator("sine");
    const env = new p5.Envelope();
    env.setADSR(0.025 + index * 0.01, 1.05 + index * 0.25, 0.025, 2.8 + index * 0.45);
    env.setRange(volumes[index], 0);
    osc.amp(0);
    osc.disconnect();
    osc.connect(bowlFilter);
    osc.start();
    oscillators.push({ osc, ratio });
    envelopes.push(env);
  });
}

function playBowlTone(connectivity) {
  if (!soundEnabled || !oscillators.length) return;
  const base = map(connectivity, 35, 80, 92, 218, true);
  oscillators.forEach((voice, index) => {
    const naturalDrift = 1 + random(-0.0025, 0.0025);
    voice.osc.freq(base * voice.ratio * naturalDrift);
    envelopes[index].play(voice.osc, index * 0.035, 0.16);
  });
}

function windowResized() {
  const wrap = document.getElementById("canvas-wrap");
  resizeCanvas(wrap.clientWidth, wrap.clientHeight);
  createBackgroundStars();
  nodes.forEach(node => node.setTarget());
  if (userNode) userNode.setTarget();
}
