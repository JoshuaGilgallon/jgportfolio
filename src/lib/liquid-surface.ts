/**
 * Draws the surface of a liquid morph (src/lib/liquid-morph.ts): the union of
 * its blobs, filled with one colour, with the site's sheet shadow under it.
 *
 * While the blobs are fusing, their union's distance field is
 * gaussian-blurred, as CoreAnimation's CASDFLayer does and as the research
 * library reproduces it (liquid_glass/include/liquid_glass/glass.hpp,
 * `prepareGroup`): the field is sampled on a 2 px grid, blurred in two
 * separable passes, and its zero contour drawn at full resolution. Once the
 * blur is off, the union is evaluated exactly per pixel.
 *
 * WebGL 2. Each pass is a single triangle. The two grid passes (only while
 * the blur is on) are a few hundred texels across, and the full-resolution
 * pass is scissored to the blobs and their shadow.
 */

/** A rounded rectangle with superellipse corners, in CSS px. */
export type Blob = {
  cx: number;
  cy: number;
  w: number;
  h: number;
  /** Corner radius. */
  r: number;
  /** CSS `corner-shape: superellipse(k)`: 1 is round. */
  k: number;
};

/** Distances are stored in two 8-bit channels over ±RANGE px. */
const RANGE = 256;
/** Grid cell, CSS px (as in the library). */
const STEP = 2;
const MAX_TAPS = 64;

// The sheet's shadows (home-nav.module.css .panel): y offset, blur radius, alpha.
// The second one grows in with the sheet.
const SHADOW = { y1: 6, blur1: 20, a1: 0.12, y2: 24, blur2: 60, a2: 0.14, ring: 0.5, ringA: 0.1 };
// How far the shadows reach past the shape, for the scissor box.
const REACH = { top: 70, side: 92, bottom: 116 };

const common = /* glsl */ `#version 300 es
precision highp float;
precision highp int;
uniform vec4 uS[2];   // centre, half size (CSS px, viewport)
uniform vec2 uC[2];   // corner radius, superellipse exponent
uniform int uN;

float sdBlob(vec2 p, vec4 s, vec2 c) {
  vec2 q = abs(p - s.xy) - s.zw + c.x;
  vec2 m = max(q, 0.0);
  float o = c.y == 2.0 ? length(m) : pow(pow(m.x, c.y) + pow(m.y, c.y), 1.0 / c.y);
  return o + min(max(q.x, q.y), 0.0) - c.x;
}
float sdUnion(vec2 p) {
  float d = sdBlob(p, uS[0], uC[0]);
  if (uN > 1) d = min(d, sdBlob(p, uS[1], uC[1]));
  return d;
}
vec4 pack(float d) {
  float v = clamp(d / ${RANGE * 2}.0 + 0.5, 0.0, 1.0) * 255.0;
  float hi = min(floor(v), 254.0);
  return vec4(hi / 255.0, v - hi, 0.0, 1.0);
}
float unpack(vec4 t) {
  return ((t.x * 255.0 + t.y) / 255.0 - 0.5) * ${RANGE * 2}.0;
}
`;

const vertex = /* glsl */ `#version 300 es
void main() {
  vec2 p = vec2(gl_VertexID == 1 ? 3.0 : -1.0, gl_VertexID == 2 ? 3.0 : -1.0);
  gl_Position = vec4(p, 0.0, 1.0);
}`;

// Grid pass 1: the union's field, blurred along x (evaluated exactly at every tap).
const blurX =
  common +
  /* glsl */ `
uniform vec2 uOrigin;
uniform float uSigma;   // in cells
out vec4 o;
void main() {
  vec2 p = uOrigin + floor(gl_FragCoord.xy) * ${STEP}.0;
  int r = min(int(ceil(uSigma * 3.0)), ${MAX_TAPS});
  float sum = 0.0, wsum = 0.0;
  for (int i = -r; i <= r; i++) {
    float w = exp(-0.5 * float(i * i) / (uSigma * uSigma));
    sum += w * sdUnion(p + vec2(float(i) * ${STEP}.0, 0.0));
    wsum += w;
  }
  o = pack(sum / wsum);
}`;

// Grid pass 2: blurred along y.
const blurY =
  common +
  /* glsl */ `
uniform sampler2D uTex;
uniform float uSigma;
out vec4 o;
void main() {
  ivec2 c = ivec2(gl_FragCoord.xy);
  int h = textureSize(uTex, 0).y;
  int r = min(int(ceil(uSigma * 3.0)), ${MAX_TAPS});
  float sum = 0.0, wsum = 0.0;
  for (int i = -r; i <= r; i++) {
    float w = exp(-0.5 * float(i * i) / (uSigma * uSigma));
    sum += w * unpack(texelFetch(uTex, ivec2(c.x, clamp(c.y + i, 0, h - 1)), 0));
    wsum += w;
  }
  o = pack(sum / wsum);
}`;

// The surface, per device pixel.
const surface =
  common +
  /* glsl */ `
uniform sampler2D uTex;
uniform bool uBlurred;
uniform vec2 uOrigin;
uniform float uHeight;  // canvas height, device px
uniform float uDpr;
uniform vec3 uColor;
uniform float uLift;
out vec4 o;

float grid(ivec2 c, ivec2 n) { return unpack(texelFetch(uTex, clamp(c, ivec2(0), n - 1), 0)); }
float field(vec2 p) {
  if (!uBlurred) return sdUnion(p);
  ivec2 n = textureSize(uTex, 0);
  vec2 g = (p - uOrigin) / ${STEP}.0;
  vec2 cg = clamp(g, vec2(0.0), vec2(n - 1));
  ivec2 i = ivec2(floor(cg));
  vec2 t = cg - vec2(i);
  float v = mix(mix(grid(i, n), grid(i + ivec2(1, 0), n), t.x), mix(grid(i + ivec2(0, 1), n), grid(i + ivec2(1, 1), n), t.x), t.y);
  return v + length(g - cg) * ${STEP}.0;  // outside the grid, add the distance to it
}
// A box shadow's edge: the gaussian CDF (logistic approximation), sigma = blur / 2.
float shadow(float d, float blur) { return 1.0 / (1.0 + exp(3.404 * d / blur)); }

void main() {
  vec2 p = uOrigin + vec2(gl_FragCoord.x, uHeight - gl_FragCoord.y) / uDpr;
  float d = field(p);
  float aa = max(length(vec2(dFdx(d), dFdy(d))), 1e-4);
  float fill = clamp(0.5 - d / aa, 0.0, 1.0);
  float ring = ${SHADOW.ringA} * clamp(0.5 - (d - ${SHADOW.ring}) / aa, 0.0, 1.0);
  float s1 = ${SHADOW.a1} * shadow(field(p - vec2(0.0, ${SHADOW.y1}.0)), ${SHADOW.blur1}.0);
  float s2 = ${SHADOW.a2} * uLift * shadow(field(p - vec2(0.0, ${SHADOW.y2}.0)), ${SHADOW.blur2}.0);
  float under = 1.0 - (1.0 - ring) * (1.0 - s1) * (1.0 - s2);
  o = vec4(uColor * fill, fill + (1.0 - fill) * under);
}`;

type Program = { p: WebGLProgram; u: (name: string) => WebGLUniformLocation | null };

export class LiquidSurface {
  private gl: WebGL2RenderingContext;
  private blurX: Program;
  private blurY: Program;
  private surface: Program;
  private tex: WebGLTexture[] = [];
  private fbo: WebGLFramebuffer[] = [];
  private gw = 0;
  private gh = 0;
  private x = 0;
  private y = 0;
  private dpr = 1;
  private color = [1, 1, 1];
  private shapes = new Float32Array(8);
  private corners = new Float32Array(4);
  lost = false;

  /** Null where WebGL 2 isn't available. */
  static create(canvas: HTMLCanvasElement) {
    const gl = canvas.getContext("webgl2", { alpha: true, premultipliedAlpha: true, antialias: false, depth: false, stencil: false });
    if (!gl) return null;
    try {
      return new LiquidSurface(canvas, gl);
    } catch {
      return null;
    }
  }

  private constructor(
    private canvas: HTMLCanvasElement,
    gl: WebGL2RenderingContext,
  ) {
    this.gl = gl;
    this.blurX = this.program(blurX);
    this.blurY = this.program(blurY);
    this.surface = this.program(surface);
    for (let i = 0; i < 2; i++) {
      const t = gl.createTexture()!;
      gl.bindTexture(gl.TEXTURE_2D, t);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
      this.tex.push(t);
      this.fbo.push(gl.createFramebuffer()!);
    }
    gl.disable(gl.DEPTH_TEST);
    gl.disable(gl.BLEND);
    canvas.addEventListener("webglcontextlost", () => (this.lost = true));
  }

  private program(fs: string): Program {
    const gl = this.gl;
    const p = gl.createProgram()!;
    for (const [type, src] of [
      [gl.VERTEX_SHADER, vertex],
      [gl.FRAGMENT_SHADER, fs],
    ] as const) {
      const s = gl.createShader(type)!;
      gl.shaderSource(s, src);
      gl.compileShader(s);
      gl.attachShader(p, s);
    }
    gl.linkProgram(p);
    if (!gl.getProgramParameter(p, gl.LINK_STATUS)) throw new Error(gl.getProgramInfoLog(p) ?? "link failed");
    const cache = new Map<string, WebGLUniformLocation | null>();
    return {
      p,
      u: (name) => {
        if (!cache.has(name)) cache.set(name, gl.getUniformLocation(p, name));
        return cache.get(name)!;
      },
    };
  }

  /** Places the canvas over a box of the viewport (CSS px) and sets the fill colour (any CSS colour). */
  layout(x: number, y: number, w: number, h: number, color: string) {
    const { gl, canvas } = this;
    this.dpr = Math.min(devicePixelRatio || 1, 3);
    this.x = Math.floor(x);
    this.y = Math.floor(y);
    w = Math.ceil(w);
    h = Math.ceil(h);
    canvas.style.cssText = `left:${this.x}px;top:${this.y}px;width:${w}px;height:${h}px`;
    const dw = Math.round(w * this.dpr);
    const dh = Math.round(h * this.dpr);
    if (canvas.width !== dw || canvas.height !== dh) {
      canvas.width = dw;
      canvas.height = dh;
    }
    const gw = Math.ceil(w / STEP) + 1;
    const gh = Math.ceil(h / STEP) + 1;
    if (gw !== this.gw || gh !== this.gh) {
      this.gw = gw;
      this.gh = gh;
      for (let i = 0; i < 2; i++) {
        gl.bindTexture(gl.TEXTURE_2D, this.tex[i]);
        gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA8, gw, gh, 0, gl.RGBA, gl.UNSIGNED_BYTE, null);
        gl.bindFramebuffer(gl.FRAMEBUFFER, this.fbo[i]);
        gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, this.tex[i], 0);
      }
      gl.bindFramebuffer(gl.FRAMEBUFFER, null);
    }
    this.color = parseColor(color);
  }

  /**
   * Draws the blobs' union. `sigma` (px) blurs their distance field; `lift`
   * (0..1) fades in the sheet's deep shadow.
   */
  draw(blobs: Blob[], sigma: number, lift: number) {
    const { gl } = this;
    if (this.lost) return;
    let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
    const n = Math.min(blobs.length, 2);
    for (let i = 0; i < n; i++) {
      const b = blobs[i];
      const { shapes: s, corners: c } = this;
      s[i * 4] = b.cx;
      s[i * 4 + 1] = b.cy;
      s[i * 4 + 2] = b.w / 2;
      s[i * 4 + 3] = b.h / 2;
      c[i * 2] = Math.min(b.r, b.w / 2, b.h / 2);
      c[i * 2 + 1] = 2 ** b.k;
      x0 = Math.min(x0, b.cx - b.w / 2);
      x1 = Math.max(x1, b.cx + b.w / 2);
      y0 = Math.min(y0, b.cy - b.h / 2);
      y1 = Math.max(y1, b.cy + b.h / 2);
    }
    const cells = sigma / STEP;
    const blurred = cells > 0.05;

    const set = (pr: Program) => {
      gl.useProgram(pr.p);
      gl.uniform4fv(pr.u("uS"), this.shapes);
      gl.uniform2fv(pr.u("uC"), this.corners);
      gl.uniform1i(pr.u("uN"), n);
    };

    gl.disable(gl.SCISSOR_TEST);
    if (blurred) {
      gl.viewport(0, 0, this.gw, this.gh);
      set(this.blurX);
      gl.uniform2f(this.blurX.u("uOrigin"), this.x, this.y);
      gl.uniform1f(this.blurX.u("uSigma"), cells);
      gl.bindFramebuffer(gl.FRAMEBUFFER, this.fbo[0]);
      gl.drawArrays(gl.TRIANGLES, 0, 3);

      set(this.blurY);
      gl.uniform1f(this.blurY.u("uSigma"), cells);
      gl.uniform1i(this.blurY.u("uTex"), 0);
      gl.activeTexture(gl.TEXTURE0);
      gl.bindTexture(gl.TEXTURE_2D, this.tex[0]);
      gl.bindFramebuffer(gl.FRAMEBUFFER, this.fbo[1]);
      gl.drawArrays(gl.TRIANGLES, 0, 3);
      gl.bindTexture(gl.TEXTURE_2D, this.tex[1]);
    }

    const { width, height } = this.canvas;
    gl.bindFramebuffer(gl.FRAMEBUFFER, null);
    gl.viewport(0, 0, width, height);
    gl.clearColor(0, 0, 0, 0);
    gl.clear(gl.COLOR_BUFFER_BIT);

    // Only the blobs and their shadow.
    const d = this.dpr;
    const sx = Math.max(0, Math.floor((x0 - REACH.side - this.x) * d));
    const sy = Math.max(0, Math.floor((y0 - REACH.top - this.y) * d));
    const ex = Math.min(width, Math.ceil((x1 + REACH.side - this.x) * d));
    const ey = Math.min(height, Math.ceil((y1 + REACH.bottom - this.y) * d));
    if (ex <= sx || ey <= sy) return;
    gl.enable(gl.SCISSOR_TEST);
    gl.scissor(sx, height - ey, ex - sx, ey - sy);

    const pr = this.surface;
    set(pr);
    gl.uniform1i(pr.u("uTex"), 0);
    gl.uniform1i(pr.u("uBlurred"), blurred ? 1 : 0);
    gl.uniform2f(pr.u("uOrigin"), this.x, this.y);
    gl.uniform1f(pr.u("uHeight"), height);
    gl.uniform1f(pr.u("uDpr"), d);
    gl.uniform3fv(pr.u("uColor"), this.color);
    gl.uniform1f(pr.u("uLift"), lift);
    gl.drawArrays(gl.TRIANGLES, 0, 3);
  }

  clear() {
    const { gl } = this;
    if (this.lost) return;
    gl.disable(gl.SCISSOR_TEST);
    gl.bindFramebuffer(gl.FRAMEBUFFER, null);
    gl.clearColor(0, 0, 0, 0);
    gl.clear(gl.COLOR_BUFFER_BIT);
  }
}

/** Any CSS colour → sRGB 0..1, via a 1×1 canvas. */
function parseColor(css: string): number[] {
  const c = document.createElement("canvas");
  c.width = c.height = 1;
  const ctx = c.getContext("2d");
  if (!ctx) return [1, 1, 1];
  ctx.fillStyle = css;
  ctx.fillRect(0, 0, 1, 1);
  const [r, g, b] = ctx.getImageData(0, 0, 1, 1).data;
  return [r / 255, g / 255, b / 255];
}
