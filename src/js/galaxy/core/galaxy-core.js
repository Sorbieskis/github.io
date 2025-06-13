import * as THREE from 'three';
import { particleVertexShader, particleFragmentShader } from '../effects/shaders/particle-shaders.js';

export function createGalaxyCore(params, galaxyGroup) {
    const particleCount = params.coreParticleCount;
    const positions = new Float32Array(particleCount * 3); 
    const colors = new Float32Array(particleCount * 3); 
    const sizes = new Float32Array(particleCount);
    const rotationSpeeds = new Float32Array(particleCount); 
    const distanceFromCenterAttr = new Float32Array(particleCount); 
    const twinkleSpeeds = new Float32Array(particleCount); 
    const fadeAttr = new Float32Array(particleCount).fill(1.0);
    const seeds = new Float32Array(particleCount);
    
    const color1 = new THREE.Color(params.coreColor1); 
    const color2 = new THREE.Color(params.coreColor2); 
    const colorBright = new THREE.Color(params.coreColorBright);
    const coreRadius = params.coreRadius;
    
    // --- NEW: Define the size of the central "black hole" ---
    const holeRadius = coreRadius * 0.15;

    for (let i = 0; i < particleCount; i++) {
        // --- UPDATED: Generate particles in a flat disk with a hole ---
        // Generate a radius that starts from the hole's edge, not from 0
        const r = holeRadius + Math.pow(Math.random(), 1.5) * (coreRadius - holeRadius);
        const angle = Math.random() * Math.PI * 2;

        const x = Math.cos(angle) * r;
        const z = Math.sin(angle) * r;
        // Give the disk a small amount of vertical thickness
        const y = (Math.random() - 0.5) * (coreRadius * 0.1) * (1.0 - r / coreRadius);

        positions[i * 3 + 0] = x;
        positions[i * 3 + 1] = y;
        positions[i * 3 + 2] = z;
        
        // --- UPDATED: Color and size logic for an accretion disk ---
        // The closer to the hole, the brighter and hotter the particle
        const normalizedDist = (r - holeRadius) / (coreRadius - holeRadius); // 0.0 at the hole, 1.0 at the edge
        
        let pColor;
        // Innermost edge (hottest part)
        if (normalizedDist < 0.1) {
            pColor = colorBright.clone();
            pColor.lerp(new THREE.Color('#BBE8FF'), 0.5); // Add a blueish tint for extreme heat
            sizes[i] = params.coreSize * (1.8 - normalizedDist * 5.0); // Largest at the very edge
        } 
        // Main body of the disk
        else if (normalizedDist < 0.6) {
            pColor = colorBright.clone().lerp(color1, normalizedDist);
            sizes[i] = params.coreSize * (1.0 - normalizedDist);
        }
        // Outer, "cooler" edge
        else {
            pColor = color1.clone().lerp(color2, (normalizedDist - 0.6) / 0.4);
            sizes[i] = params.coreSize * 0.4;
        }

        colors[i * 3 + 0] = pColor.r; 
        colors[i * 3 + 1] = pColor.g; 
        colors[i * 3 + 2] = pColor.b;
        
        // --- UPDATED: Rotation speed based on distance (Kepler's laws visually) ---
        // Particles closer to the center (smaller r) rotate much faster.
        rotationSpeeds[i] = (1.0 / (r * 0.25)) * 0.2;

        distanceFromCenterAttr[i] = r;
        twinkleSpeeds[i] = Math.random() < 0.1 ? (0.7 + Math.random() * 1.2) : 0;
        seeds[i] = Math.random();
    }
    
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3)); 
    geometry.setAttribute('aColor', new THREE.BufferAttribute(colors, 3)); 
    geometry.setAttribute('aSize', new THREE.BufferAttribute(sizes, 1)); 
    geometry.setAttribute('aRotationSpeed', new THREE.BufferAttribute(rotationSpeeds, 1)); 
    geometry.setAttribute('aDistanceFromCenter', new THREE.BufferAttribute(distanceFromCenterAttr, 1)); 
    geometry.setAttribute('aTwinkleSpeed', new THREE.BufferAttribute(twinkleSpeeds, 1)); 
    geometry.setAttribute('aFade', new THREE.BufferAttribute(fadeAttr, 1));
    geometry.setAttribute('aSeed', new THREE.BufferAttribute(seeds, 1)); // Add seed for shader
    
    const material = new THREE.ShaderMaterial({ 
        uniforms: { 
            uTime: { value: 0.0 }, 
            uSize: { value: params.particleBaseSize },
            uScale: { value: params.particlePerspectiveScale }, 
            uParticleOpacity: { value: params.coreOpacity },
            uMaxDistance: { value: params.coreRadius }
        }, 
        vertexShader: particleVertexShader, 
        fragmentShader: particleFragmentShader, 
        blending: THREE.AdditiveBlending, 
        depthWrite: false, 
        transparent: true, 
    }); 
    
    const particlesCore = new THREE.Points(geometry, material); 
    galaxyGroup.add(particlesCore);
    
    return particlesCore;
}
