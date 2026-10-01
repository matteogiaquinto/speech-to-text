type SideRaysOptions = {
  speed: number;
  frameRate: number;
  renderScale: number;
  rayColor1: string;
  rayColor2: string;
  intensity: number;
  spread: number;
  tilt: number;
  saturation: number;
  blend: number;
  falloff: number;
  opacity: number;
};

const defaults: SideRaysOptions = {
  speed: 2.5,
  frameRate: 20,
  renderScale: 0.5,
  rayColor1: "#eab308",
  rayColor2: "#96c8ff",
  intensity: 2,
  spread: 2,
  tilt: 0,
  saturation: 1.5,
  blend: 0.75,
  falloff: 1.6,
  opacity: 1,
};

function hexToRgb(hex: string) {
  const match = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
  return match
    ? [
        Number.parseInt(match[1], 16) / 255,
        Number.parseInt(match[2], 16) / 255,
        Number.parseInt(match[3], 16) / 255,
      ]
    : [1, 1, 1];
}

/** Adds the SideRays treatment without requiring a UI framework in the static demo. */
export function initSideRays(options: Partial<SideRaysOptions> = {}) {
  const container = document.querySelector<HTMLElement>("[data-side-rays]");
  if (!container) return;

  const settings = { ...defaults, ...options };
  const canvas = document.createElement("canvas");
  const context = canvas.getContext("webgl", {
    alpha: true,
    premultipliedAlpha: false,
  });
  if (!context) return;

  canvas.setAttribute("aria-hidden", "true");
  container.replaceChildren(canvas);

  const vertexSource = `attribute vec2 position;
void main() { gl_Position = vec4(position, 0.0, 1.0); }`;
  const fragmentSource = `precision highp float;
uniform float time;
uniform vec2 resolution;
uniform float speed;
uniform vec3 rayColor1;
uniform vec3 rayColor2;
uniform float intensity;
uniform vec2 direction1;
uniform vec2 direction2;
uniform float tiltCos;
uniform float tiltSin;
uniform float saturation;
uniform float blend;
uniform float falloff;
uniform float opacity;

float rayStrength(vec2 normalizedRelative, vec2 direction, float seedA, float seedB, float velocity) {
  float cosine = dot(normalizedRelative, direction);
  return clamp((0.45 + 0.15 * sin(cosine * seedA + time * velocity)) + (0.3 + 0.2 * cos(-cosine * seedB + time * velocity)), 0.0, 1.0);
}

void main() {
  vec2 coordinate = vec2(gl_FragCoord.x, resolution.y - gl_FragCoord.y);
  vec2 source = vec2(resolution.x * 1.1, -0.5 * resolution.y);
  vec2 relative = coordinate - source;
  float sourceDistance = length(relative);
  vec2 rotatedRelative = vec2(relative.x * tiltCos - relative.y * tiltSin, relative.x * tiltSin + relative.y * tiltCos);
  vec2 normalizedRelative = rotatedRelative / max(sourceDistance, 0.001);
  float distanceFade = clamp((resolution.x - sourceDistance) / resolution.x, 0.5, 1.0);
  vec3 color = rayColor1 * rayStrength(normalizedRelative, direction1, 36.2214, 21.11349, speed) * (1.0 - blend) * 0.9 + rayColor2 * rayStrength(normalizedRelative, direction2, 22.3991, 18.0234, speed * 0.2) * blend * 0.9;
  color *= distanceFade;
  float distanceToLight = sourceDistance / resolution.y;
  color *= intensity * 0.4 / pow(max(distanceToLight, 0.001), falloff);
  float grayscale = dot(color, vec3(0.299, 0.587, 0.114));
  color = mix(vec3(grayscale), color, saturation);
  float alpha = max(color.r, max(color.g, color.b)) * opacity;
  gl_FragColor = vec4(color, alpha);
}`;

  function compile(type: number, source: string) {
    const shader = context.createShader(type);
    if (!shader) throw new Error("Unable to create SideRays shader.");
    context.shaderSource(shader, source);
    context.compileShader(shader);
    if (!context.getShaderParameter(shader, context.COMPILE_STATUS)) {
      throw new Error(
        context.getShaderInfoLog(shader) ??
          "Unable to compile SideRays shader.",
      );
    }
    return shader;
  }

  let program: WebGLProgram;
  try {
    program = context.createProgram()!;
    context.attachShader(program, compile(context.VERTEX_SHADER, vertexSource));
    context.attachShader(
      program,
      compile(context.FRAGMENT_SHADER, fragmentSource),
    );
    context.linkProgram(program);
    if (!context.getProgramParameter(program, context.LINK_STATUS))
      throw new Error(
        context.getProgramInfoLog(program) ?? "Unable to link SideRays shader.",
      );
  } catch {
    canvas.remove();
    return;
  }

  const buffer = context.createBuffer();
  context.bindBuffer(context.ARRAY_BUFFER, buffer);
  context.bufferData(
    context.ARRAY_BUFFER,
    new Float32Array([-1, -1, 3, -1, -1, 3]),
    context.STATIC_DRAW,
  );
  const position = context.getAttribLocation(program, "position");
  context.enableVertexAttribArray(position);
  context.vertexAttribPointer(position, 2, context.FLOAT, false, 0, 0);
  const uniformNames = [
    "time",
    "resolution",
    "speed",
    "rayColor1",
    "rayColor2",
    "direction1",
    "direction2",
    "tiltCos",
    "tiltSin",
    "intensity",
    "saturation",
    "blend",
    "falloff",
    "opacity",
  ] as const;
  const uniforms = Object.fromEntries(
    uniformNames.map((name) => [
      name,
      context.getUniformLocation(program, name),
    ]),
  ) as Record<(typeof uniformNames)[number], WebGLUniformLocation | null>;
  const reducedMotion = matchMedia("(prefers-reduced-motion: reduce)");
  const animationStartedAt = performance.now();
  let frame = 0;
  let timer = 0;

  const halfSpread = settings.spread * 0.275;
  const direction1 = [
    Math.cos(Math.PI / 4 + halfSpread),
    Math.sin(Math.PI / 4 + halfSpread),
  ];
  const direction2 = [
    Math.cos(Math.PI / 4 - halfSpread),
    Math.sin(Math.PI / 4 - halfSpread),
  ];
  const tilt = settings.tilt * (Math.PI / 180);
  const color1 = hexToRgb(settings.rayColor1);
  const color2 = hexToRgb(settings.rayColor2);

  function resize() {
    // The rays are intentionally soft, so sub-native resolution is visually
    // indistinguishable while avoiding millions of fragment operations.
    const scale = Math.min(devicePixelRatio || 1, 1) * settings.renderScale;
    canvas.width = Math.max(1, Math.round(container.clientWidth * scale));
    canvas.height = Math.max(1, Math.round(container.clientHeight * scale));
    context.viewport(0, 0, canvas.width, canvas.height);
  }

  function render(timestamp = 0) {
    const elapsed = Math.max(0, timestamp - animationStartedAt);
    context.useProgram(program);
    context.uniform1f(
      uniforms.time,
      reducedMotion.matches ? 0 : elapsed * 0.001,
    );
    context.uniform2f(uniforms.resolution, canvas.width, canvas.height);
    context.uniform1f(uniforms.speed, settings.speed);
    context.uniform3fv(uniforms.rayColor1, color1);
    context.uniform3fv(uniforms.rayColor2, color2);
    context.uniform2fv(uniforms.direction1, direction1);
    context.uniform2fv(uniforms.direction2, direction2);
    context.uniform1f(uniforms.tiltCos, Math.cos(tilt));
    context.uniform1f(uniforms.tiltSin, Math.sin(tilt));
    context.uniform1f(uniforms.intensity, settings.intensity);
    context.uniform1f(uniforms.saturation, settings.saturation);
    context.uniform1f(uniforms.blend, settings.blend);
    context.uniform1f(uniforms.falloff, settings.falloff);
    context.uniform1f(uniforms.opacity, settings.opacity);
    context.drawArrays(context.TRIANGLES, 0, 3);
  }

  function stop() {
    window.clearTimeout(timer);
    cancelAnimationFrame(frame);
    timer = 0;
    frame = 0;
  }

  function queue() {
    stop();
    if (document.hidden || reducedMotion.matches) return;
    timer = window.setTimeout(() => {
      timer = 0;
      frame = requestAnimationFrame((timestamp) => {
        frame = 0;
        render(timestamp);
        queue();
      });
    }, 1000 / settings.frameRate);
  }

  function refresh() {
    stop();
    render(performance.now());
    queue();
  }

  const observer = new ResizeObserver(() => {
    resize();
    refresh();
  });
  observer.observe(container);
  reducedMotion.addEventListener("change", refresh);
  document.addEventListener("visibilitychange", () => {
    if (document.hidden) stop();
    else refresh();
  });
  window.addEventListener("pagehide", stop, { once: true });
  resize();
  refresh();
}
