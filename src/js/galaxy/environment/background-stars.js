import * as THREE from 'three';
import { particleVertexShader, particleFragmentShader } from '../effects/shaders/particle-shaders.js';

export function createBackgroundStars(params, scene) {
    const starCount = params.bgStarCount;
    const positions = new Float32Array(starCount * 3); 
    const colors = new Float32Array(starCount * 3); 
    const sizes = new Float32Array(starCount);
    const fadeAttr = new Float32Array(starCount).fill(1.0); 
    
    const colorWhite = new THREE.Color(0xffffff); 
    const colorBlueish = new THREE.Color(0xb0b0ff); 
    
    for (let i = 0; i < starCount; i++) {
        const r = 250 + Math.random() * 2000; 
        const theta = Math.random() * Math.PI * 2; 
        const phi = Math.acos(2 * Math.random() - 1); 
        
        positions[i * 3 + 0] = r * Math.sin(phi) * Math.cos(theta); 
        positions[i * 3 + 1] = r * Math.sin(phi) * Math.sin(theta); 
        positions[i * 3 + 2] = r * Math.cos(phi); 
        
        let c;
        const starType = Math.random();
        if (starType < 0.5) {
            c = colorWhite.clone();
        } else if (starType < 0.8) {
            c = colorBlueish.clone();
        } else {
            // Add orange/yellow stars for diversity
            c = new THREE.Color(0xffcc88);
        }
        
        // Apply brightness and color variations
        c.multiplyScalar(0.5 + Math.random() * 0.4); 
        c.offsetHSL((Math.random() - 0.5) * 0.05, 0, 0);
        
        colors[i * 3 + 0] = c.r; 
        colors[i * 3 + 1] = c.g; 
        colors[i * 3 + 2] = c.b;
        
        sizes[i] = params.bgStarSize * (0.4 + Math.random() * 1.2); 
    }
    
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3)); 
    geometry.setAttribute('aColor', new THREE.BufferAttribute(colors, 3)); 
    geometry.setAttribute('aSize', new THREE.BufferAttribute(sizes, 1)); 
    
    const dummyRotationSpeeds = new Float32Array(starCount).fill(0); 
    const dummyDistances = new Float32Array(starCount).fill(0); 
    geometry.setAttribute('aRotationSpeed', new THREE.BufferAttribute(dummyRotationSpeeds, 1)); 
    geometry.setAttribute('aDistanceFromCenter', new THREE.BufferAttribute(dummyDistances, 1)); 
    geometry.setAttribute('aFade', new THREE.BufferAttribute(fadeAttr, 1)); 
    
    const material = new THREE.ShaderMaterial({ 
        uniforms: { 
            uTime: { value: 0.0 }, 
            uSize: { value: params.particleBaseSize * 0.4 }, 
            uScale: { value: params.particlePerspectiveScale * 2.5 }, 
            uParticleOpacity: { value: params.bgStarOpacity } 
        }, 
        vertexShader: particleVertexShader, 
        fragmentShader: particleFragmentShader, 
        blending: THREE.AdditiveBlending, 
        depthWrite: false, 
        transparent: true, 
    }); 
    
    const backgroundStars = new THREE.Points(geometry, material); 
    scene.add(backgroundStars);
    
    return backgroundStars;
}