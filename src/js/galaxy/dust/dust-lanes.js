import * as THREE from 'three';
import { particleVertexShader, particleFragmentShader } from '../effects/shaders/particle-shaders.js';

export function createDustLaneParticles(params, galaxyGroup) {
    const particleCount = params.dustParticleCount;
    const positions = new Float32Array(particleCount * 3); 
    const colors = new Float32Array(particleCount * 3); 
    const sizes = new Float32Array(particleCount);
    const rotationSpeeds = new Float32Array(particleCount); 
    const distanceFromCenterAttr = new Float32Array(particleCount); 
    const fadeAttr = new Float32Array(particleCount).fill(1.0); 
    
    const color1 = new THREE.Color(params.dustColor1); 
    const color2 = new THREE.Color(params.dustColor2); 
    const radiusMin = params.dustLaneRadiusMin; 
    const radiusMax = params.dustLaneRadiusMax; 
    const thickness = params.dustLaneThickness; 
    
    for (let i = 0; i < particleCount; i++) {
        const r_torus = radiusMin + Math.random() * (radiusMax - radiusMin); 
        const angle_torus = Math.random() * Math.PI * 2; 
        const r_tube = Math.random() * thickness / 2; 
        const angle_tube = Math.random() * Math.PI * 2; 
        
        const x_offset = Math.cos(angle_tube) * r_tube; 
        const y_offset = Math.sin(angle_tube) * r_tube * 0.5; 
        
        positions[i * 3 + 0] = Math.cos(angle_torus) * (r_torus + x_offset); 
        positions[i * 3 + 1] = y_offset; 
        positions[i * 3 + 2] = Math.sin(angle_torus) * (r_torus + x_offset); 
        
        let mixedColor = Math.random() > 0.5 ? color1.clone() : color2.clone(); 
        mixedColor.lerp(color1, Math.random() * 0.3); 
        
        // Add subtle color variations based on position
        const posFactor = (r_torus - radiusMin) / (radiusMax - radiusMin);
        mixedColor.offsetHSL(
            (Math.random() - 0.5) * 0.02, 
            (Math.random() - 0.5) * 0.1, 
            (posFactor - 0.5) * 0.05
        );
        
        colors[i * 3 + 0] = mixedColor.r; 
        colors[i * 3 + 1] = mixedColor.g; 
        colors[i * 3 + 2] = mixedColor.b;
        
        sizes[i] = params.dustParticleSize * (0.7 + Math.random() * 0.6); 
        
        const normalizedDist = (r_torus - radiusMin) / (radiusMax - radiusMin); 
        rotationSpeeds[i] = ((0.15 - normalizedDist * 0.1) * (0.8 + Math.random() * 0.4)) * params.dustParticleRotationSpeedFactor; 
        distanceFromCenterAttr[i] = r_torus; 
    }
    
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3)); 
    geometry.setAttribute('aColor', new THREE.BufferAttribute(colors, 3)); 
    geometry.setAttribute('aSize', new THREE.BufferAttribute(sizes, 1)); 
    geometry.setAttribute('aRotationSpeed', new THREE.BufferAttribute(rotationSpeeds, 1)); 
    geometry.setAttribute('aDistanceFromCenter', new THREE.BufferAttribute(distanceFromCenterAttr, 1)); 
    geometry.setAttribute('aFade', new THREE.BufferAttribute(fadeAttr, 1)); 
    
    const material = new THREE.ShaderMaterial({ 
        uniforms: { 
            uTime: { value: 0.0 }, 
            uSize: { value: params.particleBaseSize }, 
            uScale: { value: params.particlePerspectiveScale }, 
            uParticleOpacity: { value: params.dustOpacity } 
        }, 
        vertexShader: particleVertexShader, 
        fragmentShader: particleFragmentShader, 
        blending: THREE.NormalBlending, 
        depthWrite: false, 
        transparent: true, 
    }); 
    
    const dustLaneParticles = new THREE.Points(geometry, material); 
    galaxyGroup.add(dustLaneParticles);
    
    return dustLaneParticles;
}