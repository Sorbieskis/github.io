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
    const fadeAttr = new Float32Array(particleCount);
    
    const color1 = new THREE.Color(params.coreColor1); 
    const color2 = new THREE.Color(params.coreColor2); 
    const colorBright = new THREE.Color(params.coreColorBright);
    const coreRadius = params.coreRadius; 
    
    let j = 0;
    for (let i = 0; i < particleCount; i++) {
        const r = Math.pow(Math.random(), 2.2) * coreRadius; 
        let fade = 1.0;
        
        const theta = Math.random() * Math.PI * 2; 
        const phi = Math.acos((Math.random() * 2) - 1);
        
        positions[j * 3 + 0] = r * Math.sin(phi) * Math.cos(theta); 
        positions[j * 3 + 1] = r * Math.sin(phi) * Math.sin(theta) * 0.5; 
        positions[j * 3 + 2] = r * Math.cos(phi);
        
        let pColor;
        if (r < coreRadius * 0.18 && Math.random() < 0.15) { 
            pColor = colorBright.clone().lerp(new THREE.Color('#B0DCFF'), 0.3); 
            // Add luminosity-based color variation
            const luminosity = 1.1 + Math.random() * 0.5;
            pColor.r *= luminosity * (0.9 + Math.random() * 0.2);
            pColor.g *= luminosity * (0.85 + Math.random() * 0.25);
            pColor.b *= luminosity * (1.1 + Math.random() * 0.3);
            sizes[j] = params.coreSize * 2.5 * (1.1 + Math.random() * 0.7);
        } else if (r < coreRadius * 0.25) { 
            pColor = colorBright.clone(); 
            pColor.r *= (1.1 + Math.random() * 0.7);
            pColor.g *= (1.1 + Math.random() * 0.6);
            pColor.b *= (0.9 + Math.random() * 0.4);
            sizes[j] = params.coreSize * (1.5 + Math.random() * 0.7);
        } else if (r < coreRadius * 0.65) { 
            pColor = Math.random() > 0.3 ? color1.clone() : colorBright.clone().lerp(color1, 0.4); 
            pColor.lerp(color2, Math.random() * 0.2); 
            sizes[j] = params.coreSize * (1.1 + Math.random() * 0.5);
        } else { 
            pColor = Math.random() > 0.5 ? color1.clone() : color2.clone(); 
            pColor.lerp(color2, Math.random() * 0.4); 
            sizes[j] = params.coreSize * (0.7 + Math.random() * 0.5); 
        }
        
        if (Math.random() < 0.08) pColor.lerp(new THREE.Color('#FFD6E0'), 0.3 + Math.random() * 0.3); 
        if (Math.random() < 0.08) pColor.lerp(new THREE.Color('#B0FFEA'), 0.3 + Math.random() * 0.3);
        
        colors[j * 3 + 0] = pColor.r; 
        colors[j * 3 + 1] = pColor.g; 
        colors[j * 3 + 2] = pColor.b;
        
        sizes[j] = Math.max(params.coreSize * 0.15, sizes[j]); 
        rotationSpeeds[j] = (Math.random() - 0.5) * 0.07 + 0.025; 
        distanceFromCenterAttr[j] = r;
        twinkleSpeeds[j] = Math.random() < 0.12 ? (0.7 + Math.random() * 1.2) * (Math.random() < 0.5 ? 1 : -1) : 0; 
        fadeAttr[j] = fade; 
        j++;
    }
    
    const finalCount = j; 
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute('position', new THREE.BufferAttribute(positions.slice(0, finalCount * 3), 3)); 
    geometry.setAttribute('aColor', new THREE.BufferAttribute(colors.slice(0, finalCount * 3), 3)); 
    geometry.setAttribute('aSize', new THREE.BufferAttribute(sizes.slice(0, finalCount), 1)); 
    geometry.setAttribute('aRotationSpeed', new THREE.BufferAttribute(rotationSpeeds.slice(0, finalCount), 1)); 
    geometry.setAttribute('aDistanceFromCenter', new THREE.BufferAttribute(distanceFromCenterAttr.slice(0, finalCount), 1)); 
    geometry.setAttribute('aTwinkleSpeed', new THREE.BufferAttribute(twinkleSpeeds.slice(0, finalCount), 1)); 
    geometry.setAttribute('aFade', new THREE.BufferAttribute(fadeAttr.slice(0, finalCount), 1)); 
    
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