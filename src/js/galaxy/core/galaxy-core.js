import {
  Color,
  BufferGeometry,
  BufferAttribute,
  ShaderMaterial,
  AdditiveBlending,
  Points
} from 'three';
import { particleVertexShader, particleFragmentShader } from '../effects/shaders/particle-shaders.js';

// Galaxy Core Configuration
const isMobile = /Mobi|Android|iPhone|iPad|iPod/i.test(navigator.userAgent);
const isLowPerfDevice = isMobile || navigator.hardwareConcurrency < 4;

export const GalaxyConfig = {
  particleCount: isLowPerfDevice ? 5000 : 15000,
  maxPixelRatio: isLowPerfDevice ? 1 : 2,
  useSimpleShaders: isLowPerfDevice,
  baseQuality: isLowPerfDevice ? 0.7 : 1.0
};

// Minimal stub for createGalaxyCore for compatibility
export function createGalaxyCore(params, group) {
  // Create geometry and material for the core
  const particleCount = params.coreParticleCount || 20000;
  const positions = new Float32Array(particleCount * 3);
  const colors = new Float32Array(particleCount * 3);
  const sizes = new Float32Array(particleCount);
  const rotationSpeeds = new Float32Array(particleCount);
  const distanceFromCenterAttr = new Float32Array(particleCount);
  const twinkleSpeeds = new Float32Array(particleCount);
  const fadeAttr = new Float32Array(particleCount).fill(1.0);

  const color1 = new Color(params.coreColor1 || '#FFFAE0');
  const color2 = new Color(params.coreColor2 || '#FFEBCD');
  const colorBright = new Color(params.coreColorBright || '#FFFFFF');
  const coreRadius = params.coreRadius || 22;

  for (let i = 0; i < particleCount; i++) {
    // Spherical distribution, denser at the center
    const r = Math.pow(Math.random(), 2.2) * coreRadius;
    const theta = Math.random() * 2 * Math.PI;
    const phi = Math.acos(2 * Math.random() - 1);

    const x = r * Math.sin(phi) * Math.cos(theta);
    const y = r * Math.sin(phi) * Math.sin(theta);
    const z = r * Math.cos(phi);

    positions[i * 3 + 0] = x;
    positions[i * 3 + 1] = y;
    positions[i * 3 + 2] = z;

    // Color interpolation for a glowing effect
    const t = Math.pow(r / coreRadius, 1.5);
    const color = color1.clone().lerp(color2, t).lerp(colorBright, 1 - t);
    colors[i * 3 + 0] = color.r;
    colors[i * 3 + 1] = color.g;
    colors[i * 3 + 2] = color.b;

    // Core stars: smaller, less rotation, more twinkle
    sizes[i] = params.coreSize * (0.7 + Math.random() * 0.6);
    rotationSpeeds[i] = (Math.random() - 0.5) * 0.1;
    distanceFromCenterAttr[i] = r;
    twinkleSpeeds[i] = Math.random() < 0.2 ? (0.7 + Math.random() * 1.2) * (Math.random() < 0.5 ? 1 : -1) : 0;
  }

  const geometry = new BufferGeometry();
  geometry.setAttribute('position', new BufferAttribute(positions, 3));
  geometry.setAttribute('aColor', new BufferAttribute(colors, 3));
  geometry.setAttribute('aSize', new BufferAttribute(sizes, 1));
  geometry.setAttribute('aRotationSpeed', new BufferAttribute(rotationSpeeds, 1));
  geometry.setAttribute('aDistanceFromCenter', new BufferAttribute(distanceFromCenterAttr, 1));
  geometry.setAttribute('aTwinkleSpeed', new BufferAttribute(twinkleSpeeds, 1));
  geometry.setAttribute('aFade', new BufferAttribute(fadeAttr, 1));

  const material = new ShaderMaterial({
    uniforms: {
      uTime: { value: 0.0 },
      uSize: { value: params.particleBaseSize },
      uScale: { value: params.particlePerspectiveScale },
      uParticleOpacity: { value: params.coreOpacity },
      uMaxDistance: { value: coreRadius }
    },
    vertexShader: particleVertexShader,
    fragmentShader: particleFragmentShader,
    blending: AdditiveBlending,
    depthWrite: false,
    transparent: true,
  });

  const points = new Points(geometry, material);
  group.add(points);
  return points;
}