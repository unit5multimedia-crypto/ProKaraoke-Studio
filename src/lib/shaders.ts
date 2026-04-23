export const PRESET_SHADERS: Record<string, { name: string, glsl: string }> = {
  nebula: {
    name: 'Cosmic Nebula',
    glsl: `
// Cosmic Nebula with audio reactivity
void mainImage(out vec4 fragColor, in vec2 fragCoord) {
    vec2 uv = fragCoord.xy / iResolution.xy;
    vec2 p = uv * 2.0 - 1.0;
    p.x *= iResolution.x / iResolution.y;

    // Reactivity
    float bass = texture(iChannel0, vec2(0.1, 0.0)).x;
    float mid = texture(iChannel0, vec2(0.5, 0.0)).x;
    float treb = texture(iChannel0, vec2(0.9, 0.0)).x;

    float t = iTime * 0.5 + bass * 2.0;

    vec3 color = vec3(0.0);
    for(int i = 0; i < 3; i++) {
        vec2 q = p;
        q.x += sin(t * 0.5 + float(i) * 1.5) * 0.5;
        q.y += cos(t * 0.3 + float(i) * 1.2) * 0.5;

        float d = length(q);
        float glow = 0.05 / (d * d + 0.01);
        
        vec3 layerColor = vec3(
            0.8 + 0.4 * sin(float(i) * 2.0 + t),
            0.4 + 0.3 * cos(float(i) * 1.5 + t),
            0.6 + 0.4 * sin(float(i) * 1.0 - t)
        );

        color += layerColor * glow * (0.8 + mid * 0.5);
    }
    
    // Add some pulsing flash for treble
    color += vec3(treb * 0.3);

    // Apply sensitivity mapping via u_sensitivity
    color *= u_sensitivity;

    fragColor = vec4(color, 1.0);
}
    `
  },
  neongrid: {
    name: 'Synthwave Grid',
    glsl: `
void mainImage(out vec4 fragColor, in vec2 fragCoord) {
    vec2 uv = fragCoord.xy / iResolution.xy;
    vec2 p = uv * 2.0 - 1.0;
    
    // Perspective division
    p.y += 0.5;
    float depth = 1.0 / max(abs(p.y), 0.01);
    vec2 w = vec2(p.x * depth, depth);
    
    float bass = texture(iChannel0, vec2(0.1, 0.0)).x;
    float t = iTime * (2.0 + bass * 2.0);
    w.y -= t;
    
    // Grid lines
    vec2 grid = fract(w);
    float line = smoothstep(0.0, 0.05, grid.x) * smoothstep(1.0, 0.95, grid.x) *
                 smoothstep(0.0, 0.05, grid.y) * smoothstep(1.0, 0.95, grid.y);
    
    line = 1.0 - line;
    float fade = min(1.0, depth * 0.05);
    
    vec3 col = vec3(0.9, 0.1, 0.8) * line * fade * (1.0 + bass);
    
    // Horizon glow
    float horizon = smoothstep(0.0, 0.2, abs(p.y));
    col += vec3(1.0, 0.2, 0.6) * (1.0 - horizon) * 0.5 * u_sensitivity;
    
    fragColor = vec4(col, 1.0);
}
    `
  },
  goldenrays: {
    name: 'Golden Praise',
    glsl: `
void mainImage(out vec4 fragColor, in vec2 fragCoord) {
    vec2 uv = fragCoord.xy / iResolution.xy;
    vec2 p = uv * 2.0 - 1.0;
    p.x *= iResolution.x / iResolution.y;

    float bass = texture(iChannel0, vec2(0.1, 0.0)).x;
    float mid = texture(iChannel0, vec2(0.5, 0.0)).x;
    
    float a = atan(p.y, p.x);
    float l = length(p);
    
    float rays = sin(a * 10.0 + iTime * 2.0) * cos(a * 8.0 - iTime);
    rays = smoothstep(0.2, 0.8, rays);
    
    vec3 gold = vec3(1.0, 0.84, 0.0);
    vec3 darkGold = vec3(0.4, 0.3, 0.0);
    
    vec3 col = mix(darkGold, gold, rays);
    
    // Center glow pulsing to the beat
    float glow = 0.2 / l;
    col *= glow * (1.0 + bass * 1.5 * u_sensitivity);
    
    // Add sparkles based on mid frequencies
    float noise = fract(sin(dot(p, vec2(12.9898, 78.233))) * 43758.5453);
    if (noise > 0.98) {
        col += vec3(1.0) * mid * u_sensitivity;
    }
    
    fragColor = vec4(col, 1.0);
}
    `
  }
};

// Default boilerplate to compile Shadertoy-like code
export const SHADER_BOILERPLATE = `
precision highp float;
uniform float iTime;
uniform vec2 iResolution;
uniform sampler2D iChannel0; // Audio FFT texture
uniform float u_sensitivity; // Scale multiplier from settings

out vec4 fragColor;

// --- USER CODE START ---
\${USER_GLSL}
// --- USER CODE END ---

void main() {
    mainImage(fragColor, gl_FragCoord.xy);
}
`;
