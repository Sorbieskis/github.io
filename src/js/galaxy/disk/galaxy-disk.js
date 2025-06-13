import * as THREE from 'three';
import { particleVertexShader, particleFragmentShader } from '../effects/shaders/particle-shaders.js';

export function createGalaxyDisk(params, galaxyGroup) {
    const particleCount = params.diskParticleCount;
    const positions = new Float32Array(particleCount * 3); 
    const colors = new Float32Array(particleCount * 3); 
    const sizes = new Float32Array(particleCount); 
    const rotationSpeeds = new Float32Array(particleCount); 
    const distanceFromCenterAttr = new Float32Array(particleCount); 
    const twinkleSpeeds = new Float32Array(particleCount);
    const fadeAttr = new Float32Array(particleCount).fill(1.0);
    const seeds = new Float32Array(particleCount);
    
    const color1 = new THREE.Color(params.diskColor1); 
    const color2 = new THREE.Color(params.diskColor2); 
    const color3 = new THREE.Color(params.diskColor3); 
    const baseColors = [color1, color2, color3];
    
    const numArms = params.numSpiralArms; 
    const armSeparation = (Math.PI * 2) / numArms; 
    const tightness = params.spiralTightness; 
    const armLength = params.armLength; 
    const minArmRadius = armLength * params.armInnerRadiusFactor; 
    
    for (let i = 0; i < particleCount; i++) {
        const armIndex = i % numArms; 
        const angleOffset = armIndex * armSeparation; 
        const r_norm = Math.pow(Math.random(), 1.4); 
        const r = minArmRadius + r_norm * (armLength - minArmRadius); 
        
        const baseAngle = Math.log(Math.max(0.1, r - minArmRadius + 1) / (armLength * 0.04) + 1) / tightness; 
        let theta = baseAngle + angleOffset; 
        
        const spreadFactor = params.armSpread * (1 - Math.pow((r - minArmRadius) / (armLength - minArmRadius), 0.6)); 
        theta += (Math.random() - 0.5) * spreadFactor * (Math.PI / numArms) * 0.7; 
        
        const x = Math.cos(theta) * r; 
        const z = Math.sin(theta) * r; 
        const y_factor = (1 - Math.pow(r / armLength, 1.8)); 
        const y = (Math.random() - 0.5) * 12 * y_factor ; 
        
        positions[i * 3 + 0] = x; 
        positions[i * 3 + 1] = y; 
        positions[i * 3 + 2] = z; 
        
        // Color will be determined in shader based on distance
        const baseColor = baseColors[0].clone();
        
        // Store all three colors for shader blending
        colors[i * 3 + 0] = baseColors[0].r;
        colors[i * 3 + 1] = baseColors[0].g;
        colors[i * 3 + 2] = baseColors[0].b;
        
        if (Math.random() < 0.01) { 
            sizes[i] = params.diskSize * 2.5 * (1.1 + Math.random() * 0.7); 
        } else { 
            sizes[i] = params.diskSize * (0.5 + Math.random() * 0.9); 
        }
        
        const normalizedDistance = r / armLength; 
        rotationSpeeds[i] = (0.3 - normalizedDistance * 0.28) * (0.6 + Math.random() * 0.7); 
        distanceFromCenterAttr[i] = r;
        twinkleSpeeds[i] = Math.random() < 0.12 ? (0.7 + Math.random() * 1.2) * (Math.random() < 0.5 ? 1 : -1) : 0;
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
    geometry.setAttribute('aSeed', new THREE.BufferAttribute(seeds, 1));
    
    const material = new THREE.ShaderMaterial({ 
        uniforms: { 
            uTime: { value: 0.0 }, 
            uSize: { value: params.particleBaseSize }, 
            uScale: { value: params.particlePerspectiveScale }, 
            uParticleOpacity: { value: params.diskOpacity },
            uMaxDistance: { value: params.armLength } 
        }, 
        vertexShader: particleVertexShader, 
        fragmentShader: particleFragmentShader, 
        blending: THREE.AdditiveBlending, 
        depthWrite: false, 
        transparent: true,
    }); 
    
    const particlesDisk = new THREE.Points(geometry, material); 
    galaxyGroup.add(particlesDisk);
    
    return particlesDisk;
}