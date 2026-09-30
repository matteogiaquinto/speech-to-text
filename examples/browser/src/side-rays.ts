type SideRaysOptions = {
  speed: number;
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
uniform float spread;
uniform float tilt;
uniform float saturation;
uniform float blend;
uniform float falloff;
uniform float opacity;

float rayStrength(vec2 source, vec2 direction, vec2 coordinate, float seedA, float seedB, float velocity) {
  vec2 sourceToCoordinate = coordinate - source;
  float cosine = dot(normalize(sourceToCoordinate), direction);
  return clamp((0.45 + 0.15 * sin(cosine * seedA + time * velocity)) + (0.3 + 0.2 * cos(-cosine * seedB + time * velocity)), 0.0, 1.0) * clamp((resolution.x - length(sourceToCoordinate)) / resolution.x, 0.5, 1.0);
}

void main() {
  vec2 coordinate = vec2(gl_FragCoord.x, resolution.y - gl_FragCoord.y);
  vec2 source = vec2(resolution.x * 1.1, -0.5 * resolution.y);
  float angle = tilt * 0.0174532925;
  vec2 relative = coordinate - source;
  vec2 rotated = vec2(relative.x * cos(angle) - relative.y * sin(angle), relative.x * sin(angle) + relative.y * cos(angle)) + source;
  float halfSpread = spread * 0.275;
  vec2 direction1 = normalize(vec2(cos(0.785398 + halfSpread), sin(0.785398 + halfSpread)));
  vec2 direction2 = normalize(vec2(cos(0.785398 - halfSpread), sin(0.785398 - halfSpread)));
  vec3 color = rayColor1 * rayStrength(source, direction1, rotated, 36.2214, 21.11349, speed) * (1.0 - blend) * 0.9 + rayColor2 * rayStrength(source, direction2, rotated, 22.3991, 18.0234, speed * 0.2) * blend * 0.9;
  float distanceToLight = length(gl_FragCoord.xy - vec2(source.x, resolution.y - source.y)) / resolution.y;
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
  const uniform = (name: string) => context.getUniformLocation(program, name);
  const reducedMotion = matchMedia("(prefers-reduced-motion: reduce)");
  let frame = 0;

  function resize() {
    const scale = Math.min(devicePixelRatio || 1, 2);
    canvas.width = Math.max(1, Math.round(container.clientWidth * scale));
    canvas.height = Math.max(1, Math.round(container.clientHeight * scale));
    context.viewport(0, 0, canvas.width, canvas.height);
  }

  function render(timestamp = 0) {
    context.useProgram(program);
    context.uniform1f(
      uniform("time"),
      reducedMotion.matches ? 0 : timestamp * 0.001,
    );
    context.uniform2f(uniform("resolution"), canvas.width, canvas.height);
    context.uniform1f(uniform("speed"), settings.speed);
    context.uniform3fv(uniform("rayColor1"), hexToRgb(settings.rayColor1));
    context.uniform3fv(uniform("rayColor2"), hexToRgb(settings.rayColor2));
    context.uniform1f(uniform("intensity"), settings.intensity);
    context.uniform1f(uniform("spread"), settings.spread);
    context.uniform1f(uniform("tilt"), settings.tilt);
    context.uniform1f(uniform("saturation"), settings.saturation);
    context.uniform1f(uniform("blend"), settings.blend);
    context.uniform1f(uniform("falloff"), settings.falloff);
    context.uniform1f(uniform("opacity"), settings.opacity);
    context.drawArrays(context.TRIANGLES, 0, 3);
    if (!reducedMotion.matches) frame = requestAnimationFrame(render);
  }

  const observer = new ResizeObserver(() => {
    resize();
    if (reducedMotion.matches) render();
  });
  observer.observe(container);
  reducedMotion.addEventListener("change", () => {
    cancelAnimationFrame(frame);
    render();
  });
  resize();
  render();
}
