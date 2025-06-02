// Ethereal Sombrero Galaxy Animation (modular JS version)
import * as THREE from 'three';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';

// --- Custom Vignette ShaderPass ---
import { ShaderPass } from 'three/addons/postprocessing/ShaderPass.js';

const VignetteShader = {
    uniforms: {
        'tDiffuse': { value: null },
        'offset': { value: 1.2 },    // 1.2 = very subtle, increase for more vignette
        'darkness': { value: 0.3 }   // 0.3 = subtle, increase for more darkness
    },
    vertexShader: `
        varying vec2 vUv;
        void main() {
            vUv = uv;
            gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
        }
    `,
    fragmentShader: `
        uniform float offset;
        uniform float darkness;
        uniform sampler2D tDiffuse;
        varying vec2 vUv;
        void main() {
            vec4 texel = texture2D(tDiffuse, vUv);
            float dist = distance(vUv, vec2(0.5, 0.5));
            float vignette = smoothstep(0.8, offset, dist);
            texel.rgb = mix(texel.rgb, texel.rgb * (1.0 - darkness), vignette);
            gl_FragColor = texel;
        }
    `
};

// === Shader code as JS strings ===
const particleVertexShader = `
    uniform float uTime;
    uniform float uSize;
    uniform float uScale;

    attribute float aSize; 
    attribute vec3 aColor;
    attribute float aRotationSpeed; 
    attribute float aDistanceFromCenter;
    attribute float aTwinkleSpeed;
    attribute float aFade; // <--- Add fade attribute

    varying vec3 vColor;
    varying float vParticleOpacityFactor;
    varying float vFade;

    void main() {
        vColor = aColor;
        float twinkle = 1.0;
        if (aTwinkleSpeed != 0.0) {
            // Sparser but more visible twinkle
            twinkle = 0.78 + 0.32 * sin(uTime * aTwinkleSpeed * 0.7 + aDistanceFromCenter * 0.1);
        }
        vParticleOpacityFactor = twinkle; // <--- Only twinkle, no fade here
        vFade = aFade; // <--- Pass fade separately

        vec3 transformedPosition = position;
        float angle = uTime * aRotationSpeed * 0.035 + (aDistanceFromCenter * 0.00035); 
        mat2 rotationMatrix = mat2(cos(angle), -sin(angle), sin(angle), cos(angle));
        transformedPosition.xz = rotationMatrix * transformedPosition.xz;

        vec4 mvPosition = modelViewMatrix * vec4(transformedPosition, 1.0);
        gl_PointSize = aSize * uSize * (uScale / -mvPosition.z); 
        gl_Position = projectionMatrix * mvPosition;
    }
`;
const particleFragmentShader = `
    varying vec3 vColor;
    varying float vParticleOpacityFactor;
    varying float vFade;
    uniform float uParticleOpacity;

    void main() {
        float dist = distance(gl_PointCoord, vec2(0.5));
        float alpha = 1.0 - smoothstep(0.3, 0.5, dist); 
        if (alpha < 0.001) discard;
        gl_FragColor = vec4(vColor, alpha * uParticleOpacity * vParticleOpacityFactor * vFade);
    }
`;

// === Parameters (from user's latest provided code) ===
const params = {
    coreParticleCount: 20000, 
    coreColor1: '#FFFAE0',
    coreColor2: '#FFEBCD',
    coreColorBright: '#FFFFFF',
    coreSize: 0.35, 
    coreOpacity: 0.9,
    coreRadius: 22, 

    diskParticleCount: 50000, 
    diskColor1: '#B0DCFF',
    diskColor2: '#DADAFE',
    diskColor3: '#FFFFFF',
    diskSize: 0.28, 
    diskOpacity: 0.7,
    numSpiralArms: 4,
    spiralTightness: 0.28,
    armSpread: 2.5,
    armLength: 140, 
    armInnerRadiusFactor: 0.25,

    dustParticleCount: 60000, 
    dustColor1: '#2c1f1f',
    dustColor2: '#382828',
    dustParticleSize: 0.2, 
    dustOpacity: 0.35,
    dustLaneRadiusMin: 75,
    dustLaneRadiusMax: 115,
    dustLaneThickness: 15,
    dustParticleRotationSpeedFactor: 0.5, 

    bgStarCount: 1500, 
    bgStarSize: 0.06, 
    bgStarOpacity: 0.35,

    bloomEnabled: false, // Kept false for debugging
    bloomThreshold: 0.45,  
    bloomStrength: 0.5,   
    bloomRadius: 0.7,    

    cameraAnimationSpeed: 0.005, // Note: This is not directly used if path is only scroll-driven
    cameraFov: 55,

    particleBaseSize: 1.5, 
    particlePerspectiveScale: 380.0, 
};

// === Main Animation Logic ===
let scene, camera, renderer, clock;
let composer, bloomPass, vignettePass;
let galaxyGroup, particlesCore, particlesDisk, dustLaneParticles, backgroundStars; 
let cameraPath; 
let canvasElement; 
let debugCube; 
// --- Reusable vectors for performance ---
let orbitOffset, orbitAxisX, orbitAxisY;

// Scroll-related variables
let scrollTarget = 0; // Normalized scroll position (0-1)
let scrollCurrent = 0; // Lerped scroll position
let zoomTarget = 1;    // Target zoom factor (1 = no zoom, <1 = zoom in)
let zoomCurrent = 1;   // Lerped zoom factor
const LERP_FACTOR = 0.025; // Smoothing factor for scroll and zoom lerping

// --- SCROLL MAPPING TO PROJECTS SECTION ---
let projectsSectionTop = null;
function updateProjectsSectionTop() {
    const projectsSection = document.getElementById('projects');
    if (projectsSection) {
        const rect = projectsSection.getBoundingClientRect();
        // Normalize scroll until the top of the projects section reaches the top of the viewport
        projectsSectionTop = rect.top + window.scrollY;
    } else {
        // Fallback: if projects section isn't found, use a large enough value 
        // to allow full scroll of typical page content.
        projectsSectionTop = Math.max(document.body.scrollHeight - window.innerHeight, window.innerHeight * 3);
    }
}

function onScroll() {
    if (projectsSectionTop === null) {
        updateProjectsSectionTop(); // Calculate on first scroll if not already set by resize/load
    }
    
    let scrollNorm = 0;
    if (projectsSectionTop > 0) {
        // Normalize scroll from page top to the top of the projects section
        scrollNorm = Math.min(1, Math.max(0, window.scrollY / projectsSectionTop));
    }
    scrollTarget = scrollNorm; // This drives _easedScroll for the camera path

    // Zoom target is now linked to this new, longer scrollNorm.
    // Adjust factor (e.g., 0.9) to control how quickly it zooms over this longer distance.
    // A value of 1.0 would mean it's fully zoomed (target 0.1) when scrollNorm is 1.
    // Max zoom factor of 0.1 means it zooms in to 10% of original distance/FOV effect.
    zoomTarget = Math.max(0.1, 1.0 - scrollNorm * 0.9); 
}


// --- Camera Path: gentle, floaty Bezier curve ---
let cameraCurve; // cameraStart, cameraMid, cameraEnd are no longer needed for QuadraticBezierCurve3

function setupCameraPath(center) {
    // Define points for a sweeping CatmullRomCurve3 path
    const points = [
        new THREE.Vector3(center.x + 40, center.y + 70, center.z + 280),   // Start further out, slightly adjusted from previous
        new THREE.Vector3(center.x - 120, center.y + 50, center.z + 180),  // Sweep left and a bit closer
        new THREE.Vector3(center.x, center.y - 60, center.z + 100),       // Optional: Sweep underneath or a different angle
        new THREE.Vector3(center.x + 120, center.y + 30, center.z + 160),  // Sweep right
        new THREE.Vector3(center.x, center.y + 5, center.z + 45)          // Final approach, close to center
    ];
    cameraCurve = new THREE.CatmullRomCurve3(points, false, 'catmullrom', 0.5); // closed = false, curveType, tension
}

function createGalaxyCore() { 
    if (particlesCore) galaxyGroup.remove(particlesCore);
    const particleCount = params.coreParticleCount;
    const positions = new Float32Array(particleCount * 3);
    const colors = new Float32Array(particleCount * 3);
    const sizes = new Float32Array(particleCount);
    const rotationSpeeds = new Float32Array(particleCount);
    const distanceFromCenterAttr = new Float32Array(particleCount);
    const twinkleSpeeds = new Float32Array(particleCount); // For twinkle effect
    const fadeAttr = new Float32Array(particleCount);

    const color1 = new THREE.Color(params.coreColor1);
    const color2 = new THREE.Color(params.coreColor2);
    const colorBright = new THREE.Color(params.coreColorBright);
    const coreRadius = params.coreRadius;

    // --- Make the fade zone even wider and sharper for a cleaner black hole ---
    // const horizonRadius = 3.2;
    // const minBlackHoleRadius = horizonRadius * 1.18; // Slightly larger: no stars inside event horizon+disk
    // const fadeZoneRadius = minBlackHoleRadius + 22.0; // MUCH wider fade zone for dramatic shadow
    // let j = 0; // index for valid stars
    // for (let i = 0; i < particleCount; i++) {
    //     const r = Math.pow(Math.random(), 2.2) * coreRadius;
    //     if (r < minBlackHoleRadius) continue; // Absolutely no stars inside event horizon+disk
    //     let fade = 1.0;
    //     if (r < fadeZoneRadius) {
    //         fade = (r - minBlackHoleRadius) / (fadeZoneRadius - minBlackHoleRadius);
    //         fade = Math.pow(fade, 4.0); // Even sharper fade (was 3.0)
    //         if (fade < 0.10) fade = 0.0; // Harder cutoff
    //     }
    //     const theta = Math.random() * Math.PI * 2;
    //     const phi = Math.acos((Math.random() * 2) - 1);
    //     positions[j * 3 + 0] = r * Math.sin(phi) * Math.cos(theta);
    //     positions[j * 3 + 1] = r * Math.sin(phi) * Math.sin(theta) * 0.5; 
    //     positions[j * 3 + 2] = r * Math.cos(phi);

    //     // --- More color and brightness variation ---
    //     let pColor;
    //     if (r < coreRadius * 0.18 && Math.random() < 0.15) {
    //         // Supergiant: rare, very bright, slightly blue-white
    //         pColor = colorBright.clone().lerp(new THREE.Color('#B0DCFF'), 0.3);
    //         pColor.r *= 2.2 + Math.random() * 0.7;
    //         pColor.g *= 2.0 + Math.random() * 0.5;
    //         pColor.b *= 2.0 + Math.random() * 0.7;
    //         sizes[j] = params.coreSize * 2.5 * (1.1 + Math.random() * 0.7);
    //     } else if (r < coreRadius * 0.25) { 
    //         pColor = colorBright.clone();
    //         pColor.r *= (1.8 + Math.random() * 1.2); 
    //         pColor.g *= (1.8 + Math.random() * 1.0);
    //         pColor.b *= (1.5 + Math.random() * 0.7);
    //         sizes[j] = params.coreSize * (1.5 + Math.random() * 0.7);
    //     } else if (r < coreRadius * 0.65) { 
    //         pColor = Math.random() > 0.3 ? color1.clone() : colorBright.clone().lerp(color1, 0.4);
    //         pColor.lerp(color2, Math.random() * 0.2);
    //         sizes[j] = params.coreSize * (1.1 + Math.random() * 0.5);
    //     } else { 
    //         pColor = Math.random() > 0.5 ? color1.clone() : color2.clone();
    //         pColor.lerp(color2, Math.random() * 0.4);
    //         sizes[j] = params.coreSize * (0.7 + Math.random() * 0.5);
    //     }
    //     // Add a bit more color variety
    //     if (Math.random() < 0.08) pColor.lerp(new THREE.Color('#FFD6E0'), 0.3 + Math.random() * 0.3);
    //     if (Math.random() < 0.08) pColor.lerp(new THREE.Color('#B0FFEA'), 0.3 + Math.random() * 0.3);
    //     colors[j * 3 + 0] = pColor.r; colors[j * 3 + 1] = pColor.g; colors[j * 3 + 2] = pColor.b;
    //     sizes[j] = Math.max(params.coreSize * 0.15, sizes[j]); 
    //     rotationSpeeds[j] = (Math.random() - 0.5) * 0.07 + 0.025; 
    //     distanceFromCenterAttr[j] = r;
    //     // Twinkle: random speed, some don't twinkle
    //     twinkleSpeeds[j] = Math.random() < 0.12 ? (0.7 + Math.random() * 1.2) * (Math.random() < 0.5 ? 1 : -1) : 0;
    //     fadeAttr[j] = fade;
    //     j++;
    // }
    // --- Instead, allow stars all the way to the center for a dense core ---
    let j = 0;
    for (let i = 0; i < particleCount; i++) {
        const r = Math.pow(Math.random(), 2.2) * coreRadius;
        let fade = 1.0;
        const theta = Math.random() * Math.PI * 2;
        const phi = Math.acos((Math.random() * 2) - 1);
        positions[j * 3 + 0] = r * Math.sin(phi) * Math.cos(theta);
        positions[j * 3 + 1] = r * Math.sin(phi) * Math.sin(theta) * 0.5; 
        positions[j * 3 + 2] = r * Math.cos(phi);

        // --- More color and brightness variation ---
        let pColor;
        if (r < coreRadius * 0.18 && Math.random() < 0.15) {
            // Supergiant: rare, very bright, slightly blue-white
            pColor = colorBright.clone().lerp(new THREE.Color('#B0DCFF'), 0.3);
            pColor.r *= 2.2 + Math.random() * 0.7;
            pColor.g *= 2.0 + Math.random() * 0.5;
            pColor.b *= 2.0 + Math.random() * 0.7;
            sizes[j] = params.coreSize * 2.5 * (1.1 + Math.random() * 0.7);
        } else if (r < coreRadius * 0.25) { 
            pColor = colorBright.clone();
            pColor.r *= (1.8 + Math.random() * 1.2); 
            pColor.g *= (1.8 + Math.random() * 1.0);
            pColor.b *= (1.5 + Math.random() * 0.7);
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
        // Add a bit more color variety
        if (Math.random() < 0.08) pColor.lerp(new THREE.Color('#FFD6E0'), 0.3 + Math.random() * 0.3);
        if (Math.random() < 0.08) pColor.lerp(new THREE.Color('#B0FFEA'), 0.3 + Math.random() * 0.3);
        colors[j * 3 + 0] = pColor.r; colors[j * 3 + 1] = pColor.g; colors[j * 3 + 2] = pColor.b;
        sizes[j] = Math.max(params.coreSize * 0.15, sizes[j]); 
        rotationSpeeds[j] = (Math.random() - 0.5) * 0.07 + 0.025; 
        distanceFromCenterAttr[j] = r;
        // Twinkle: random speed, some don't twinkle
        twinkleSpeeds[j] = Math.random() < 0.12 ? (0.7 + Math.random() * 1.2) * (Math.random() < 0.5 ? 1 : -1) : 0;
        fadeAttr[j] = fade;
        j++;
    }
    // Truncate arrays to actual number of valid stars
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
            uTime: { value: 0.0 }, uSize: { value: params.particleBaseSize }, 
            uScale: { value: params.particlePerspectiveScale }, uParticleOpacity: { value: params.coreOpacity }
        },
        vertexShader: particleVertexShader,
        fragmentShader: particleFragmentShader,
        blending: THREE.AdditiveBlending, depthWrite: false, transparent: true,
    });
    particlesCore = new THREE.Points(geometry, material);
    galaxyGroup.add(particlesCore);
}

function createGalaxyDisk() { 
    if (particlesDisk) galaxyGroup.remove(particlesDisk);
    const particleCount = params.diskParticleCount;
    const positions = new Float32Array(particleCount * 3);
    const colors = new Float32Array(particleCount * 3);
    const sizes = new Float32Array(particleCount); 
    const rotationSpeeds = new Float32Array(particleCount);
    const distanceFromCenterAttr = new Float32Array(particleCount);
    const twinkleSpeeds = new Float32Array(particleCount); // For twinkle effect
    const fadeAttr = new Float32Array(particleCount).fill(1.0); // Disk: always 1.0

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
        positions[i * 3 + 0] = x; positions[i * 3 + 1] = y; positions[i * 3 + 2] = z;
        // --- More color and brightness variation ---
        const mixedColor = baseColors[Math.floor(Math.random() * baseColors.length)].clone();
        if (Math.random() < 0.08) mixedColor.lerp(new THREE.Color('#FFD6E0'), 0.3 + Math.random() * 0.3);
        if (Math.random() < 0.08) mixedColor.lerp(new THREE.Color('#B0FFEA'), 0.3 + Math.random() * 0.3);
        mixedColor.lerp(new THREE.Color(0xffffff), Math.random() * 0.1);
        colors[i * 3 + 0] = mixedColor.r; colors[i * 3 + 1] = mixedColor.g; colors[i * 3 + 2] = mixedColor.b;
        // --- Supergiant/giant stars ---
        if (Math.random() < 0.01) {
            sizes[i] = params.diskSize * 2.5 * (1.1 + Math.random() * 0.7);
        } else {
            sizes[i] = params.diskSize * (0.5 + Math.random() * 0.9);
        }
        const normalizedDistance = r / armLength;
        rotationSpeeds[i] = (0.3 - normalizedDistance * 0.28) * (0.6 + Math.random() * 0.7); 
        distanceFromCenterAttr[i] = r;
        // Twinkle: random speed, some don't twinkle
        twinkleSpeeds[i] = Math.random() < 0.12 ? (0.7 + Math.random() * 1.2) * (Math.random() < 0.5 ? 1 : -1) : 0;
    }
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    geometry.setAttribute('aColor', new THREE.BufferAttribute(colors, 3));
    geometry.setAttribute('aSize', new THREE.BufferAttribute(sizes, 1)); 
    geometry.setAttribute('aRotationSpeed', new THREE.BufferAttribute(rotationSpeeds, 1));
    geometry.setAttribute('aDistanceFromCenter', new THREE.BufferAttribute(distanceFromCenterAttr, 1));
    geometry.setAttribute('aTwinkleSpeed', new THREE.BufferAttribute(twinkleSpeeds, 1));
    geometry.setAttribute('aFade', new THREE.BufferAttribute(fadeAttr, 1));
    const material = new THREE.ShaderMaterial({
        uniforms: {
            uTime: { value: 0.0 }, uSize: { value: params.particleBaseSize }, 
            uScale: { value: params.particlePerspectiveScale }, uParticleOpacity: { value: params.diskOpacity }
        },
        vertexShader: particleVertexShader,
        fragmentShader: particleFragmentShader,
        blending: THREE.AdditiveBlending, depthWrite: false, transparent: true,
    });
    particlesDisk = new THREE.Points(geometry, material);
    galaxyGroup.add(particlesDisk);
}

function createDustLaneParticles() { 
    if (dustLaneParticles) galaxyGroup.remove(dustLaneParticles);
    const particleCount = params.dustParticleCount;
    const positions = new Float32Array(particleCount * 3);
    const colors = new Float32Array(particleCount * 3);
    const sizes = new Float32Array(particleCount);
    const rotationSpeeds = new Float32Array(particleCount);
    const distanceFromCenterAttr = new Float32Array(particleCount);
    const fadeAttr = new Float32Array(particleCount).fill(1.0); // Dust: always 1.0

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
        const mixedColor = Math.random() > 0.5 ? color1.clone() : color2.clone();
        mixedColor.lerp(color1, Math.random() * 0.3); 
        colors[i * 3 + 0] = mixedColor.r; colors[i * 3 + 1] = mixedColor.g; colors[i * 3 + 2] = mixedColor.b;
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
            uTime: { value: 0.0 }, uSize: { value: params.particleBaseSize }, 
            uScale: { value: params.particlePerspectiveScale }, uParticleOpacity: { value: params.dustOpacity }
        },
        vertexShader: particleVertexShader,
        fragmentShader: particleFragmentShader,
        blending: THREE.NormalBlending, depthWrite: false, transparent: true,
    });
    dustLaneParticles = new THREE.Points(geometry, material);
    galaxyGroup.add(dustLaneParticles);
}

function createBackgroundStars() { 
    if (backgroundStars) scene.remove(backgroundStars);
    const starCount = params.bgStarCount;
    const positions = new Float32Array(starCount * 3);
    const colors = new Float32Array(starCount * 3);
    const sizes = new Float32Array(starCount);
    const fadeAttr = new Float32Array(starCount).fill(1.0); // BG: always 1.0
    const colorWhite = new THREE.Color(0xffffff); const colorBlueish = new THREE.Color(0xb0b0ff);

    for (let i = 0; i < starCount; i++) {
        const r = 250 + Math.random() * 2000; 
        const theta = Math.random() * Math.PI * 2;
        const phi = Math.acos(2 * Math.random() - 1);
        positions[i * 3 + 0] = r * Math.sin(phi) * Math.cos(theta);
        positions[i * 3 + 1] = r * Math.sin(phi) * Math.sin(theta);
        positions[i * 3 + 2] = r * Math.cos(phi);
        const c = Math.random() > 0.6 ? colorBlueish.clone() : colorWhite.clone();
        c.multiplyScalar(0.5 + Math.random() * 0.4); 
        colors[i * 3 + 0] = c.r; colors[i * 3 + 1] = c.g; colors[i * 3 + 2] = c.b;
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
        blending: THREE.AdditiveBlending, depthWrite: false, transparent: true,
    });
    backgroundStars = new THREE.Points(geometry, material);
    scene.add(backgroundStars); 
}

function setupPostProcessing() {
    composer = new EffectComposer(renderer);
    const renderPass = new RenderPass(scene, camera);
    composer.addPass(renderPass);
    // UnrealBloomPass (subtle, tuned down)
    // bloomPass = new UnrealBloomPass(
    //     new THREE.Vector2(window.innerWidth, window.innerHeight),
    //     0.18,        0.18, // radius (was 0.85)
    //     0.12 // threshold (was 0.01)
    // );
    // composer.addPass(bloomPass);
    // Vignette (subtle, tuned down)
    // vignettePass = new ShaderPass(VignetteShader);
    // vignettePass.uniforms["offset"].value = 1.35; // much lighter vignette
    // vignettePass.uniforms["darkness"].value = 0.08; // almost no darkness
    // composer.addPass(vignettePass);
    // Output
    const outputPass = new OutputPass();
    composer.addPass(outputPass);
}

function handleResize() {
    if (!camera || !renderer) return;
    // console.log("handleResize called");

    const width = window.innerWidth; // Canvas is fixed fullscreen, so use window dimensions
    const height = window.innerHeight;
    // console.log(`Resizing to: ${width}x${height}`);

    camera.aspect = width / height;
    camera.updateProjectionMatrix();

    renderer.setSize(width, height);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));

    if (canvasElement) { // Ensure canvasElement style matches renderer size
        canvasElement.style.width = `${width}px`;
        canvasElement.style.height = `${height}px`;
    }
    updateProjectsSectionTop(); // Recalculate on resize

    if (composer) {
        composer.setSize(width, height);
    }
}

// === EASING FUNCTION ===
function easeInOutCubic(t) {
    return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
}

// --- Mouse Parallax Drift ---
let mouseX = 0, mouseY = 0;
let targetMouseX = 0, targetMouseY = 0;
let mouseVX = 0, mouseVY = 0;
let lastMouseMoveTime = 0;
const MOUSE_LERP = 0.05; // Lowered for less sensitivity
const SPRING_RETURN_LERP = 0.025; // Lowered for gentler spring
const SPRING_IDLE_DELAY = 0.7; // seconds before spring starts
const INERTIA_FRICTION = 0.97; // Higher = smoother, slower decay
const INERTIA_STRENGTH = 0.05; // Lowered for less velocity

// Only simple mousemove for parallax/orbit
window.addEventListener('mousemove', (e) => {
    const w = window.innerWidth, h = window.innerHeight;
    const newMouseX = ((e.clientX / w) - 0.5) * 2;
    const newMouseY = ((e.clientY / h) - 0.5) * 2;
    // Only update target, no velocity/inertia
    targetMouseX = newMouseX;
    targetMouseY = newMouseY;
    lastMouseMoveTime = performance.now();
}, { passive: true });

function animate() {
    requestAnimationFrame(animate);
    const elapsedTime = clock.getElapsedTime();
    if (particlesCore) particlesCore.material.uniforms.uTime.value = elapsedTime;
    if (particlesDisk) particlesDisk.material.uniforms.uTime.value = elapsedTime; 
    if (dustLaneParticles) dustLaneParticles.material.uniforms.uTime.value = elapsedTime;
    scrollCurrent += (scrollTarget - scrollCurrent) * LERP_FACTOR;
    zoomCurrent += (zoomTarget - zoomCurrent) * LERP_FACTOR;
    // Easing for camera progress
    const easedScroll = easeInOutCubic(scrollCurrent);
    window._easedScroll = easedScroll; // For mousemove handler
    if (cameraCurve && camera) {
        let lerpSpeed = MOUSE_LERP;
        // Only spring to center when fully zoomed in and mouse is idle
        if (easedScroll > 0.98 && (performance.now() - lastMouseMoveTime) > SPRING_IDLE_DELAY * 1000) {
            targetMouseX = 0;
            targetMouseY = 0;
        }
        // Always lerp to target (no inertia)
        mouseX += (targetMouseX - mouseX) * lerpSpeed;
        mouseY += (targetMouseY - mouseY) * lerpSpeed;
        // Clamp
        mouseX = Math.max(-1, Math.min(1, mouseX));
        mouseY = Math.max(-1, Math.min(1, mouseY));

        // Camera position along the Bezier curve
        const camPos = cameraCurve.getPoint(easedScroll);
        camera.position.copy(camPos);

        // Reset galaxy group rotation by default
        galaxyGroup.rotation.x = 0;
        galaxyGroup.rotation.y = 0;

        if (easedScroll > 0.98) {
            // Cinematic orbit (camera offset/roll) and galaxy tilt ONLY when fully zoomed in
            const maxOrbitAngleX = Math.PI / 18;
            const maxOrbitAngleY = Math.PI / 18;
            const orbitAngleX = mouseY * maxOrbitAngleX;
            const orbitAngleY = mouseX * maxOrbitAngleY;

            // Use reusable vectors for orbit calculation
            orbitOffset.subVectors(camPos, galaxyGroup.position);
            orbitAxisX.set(1, 0, 0); 
            orbitAxisY.set(0, 1, 0); 
            orbitOffset.applyAxisAngle(orbitAxisX, orbitAngleX);
            orbitOffset.applyAxisAngle(orbitAxisY, orbitAngleY);
            camera.position.copy(galaxyGroup.position).add(orbitOffset);
            
            // Galaxy tilt (optional, can be subtle)
            const maxTiltX = Math.PI / 20;
            const maxTiltY = Math.PI / 24;
            galaxyGroup.rotation.x = maxTiltX * mouseY;
            galaxyGroup.rotation.y = maxTiltY * mouseX;
        }
        
        // FOV animation: widen as we zoom in
        camera.fov = params.cameraFov + 12 * easedScroll;
        camera.updateProjectionMatrix(); // Update projection matrix after FOV change

        // Always look at the galaxy center
        camera.lookAt(galaxyGroup.position);

        // Apply roll effect AFTER the final lookAt, only if zoomed in
        if (easedScroll > 0.98) {
            camera.rotation.z = mouseX * 0.08;
        } else {
            camera.rotation.z = 0; // Ensure roll is reset otherwise
        }
    }

    if (composer) {
        composer.render();
    } else if (renderer && scene && camera) {
        renderer.render(scene, camera);
    }
}


function init() {
    console.log("Starting init function (User's New Scroll Logic, No Rig)...");
    clock = new THREE.Clock(); 
    scene = new THREE.Scene();

    // Initialize reusable vectors
    orbitOffset = new THREE.Vector3();
    orbitAxisX = new THREE.Vector3();
    orbitAxisY = new THREE.Vector3();
    canvasElement = document.getElementById('sombreroCanvas');

    if (!canvasElement) {
        console.error('CRITICAL: Canvas element with ID "sombreroCanvas" not found. Halting initialization.');
        return; 
    }
    // Style canvas via JS to ensure it's a fixed background for the whole page
    canvasElement.style.display = "block";
    canvasElement.style.position = "fixed";
    canvasElement.style.left = "0";
    canvasElement.style.top = "0";
    canvasElement.style.width = "100vw";
    canvasElement.style.height = "100vh";
    canvasElement.style.zIndex = "-2"; // Ensure it's behind all other content, including vignette/accent
    console.log("Canvas element found and styled as fixed background via JS.");

    renderer = new THREE.WebGLRenderer({ canvas: canvasElement, antialias: true, alpha: true });
    renderer.debug.checkShaderErrors = true; // Good for debugging shaders
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.outputColorSpace = THREE.SRGBColorSpace; 
    renderer.setClearColor(0x000000, 1); // <--- Set alpha to 1 for solid black background
    console.log("Renderer initialized.");

    galaxyGroup = new THREE.Group();
    galaxyGroup.position.set(0, 0, 0); // Position galaxy group at origin
    // galaxyGroup.rotation.x = Math.PI / 12; // Optional initial tilt
    scene.add(galaxyGroup);
    console.log("GalaxyGroup created at origin.");

    camera = new THREE.PerspectiveCamera(
        params.cameraFov, 
        window.innerWidth / window.innerHeight, // Use window dimensions for fullscreen canvas
        0.1, 
        5000 
    );
    // Initial camera position will be set by cameraPath logic in animate, 
    // but set a default starting point. The path is relative to (0,0,0).
    // The first point on path will be used.
    // camera.position.set(0, 0, 160); // Default starting distance if path wasn't used
    scene.add(camera); 
    console.log("Camera created.");
    
    setupCameraPath(galaxyGroup.position);
    console.log("Camera paths setup.");

    createGalaxyCore();
    createGalaxyDisk();
    createDustLaneParticles();
    createBackgroundStars();
    // addBlackHole(); // <--- Commented out: remove black hole and related visuals
    console.log("ALL Galaxy components creation RE-ENABLED.");


    handleResize();
    setupPostProcessing();
    window.addEventListener('resize', handleResize);
    window.addEventListener('scroll', onScroll, { passive: true });
    
    // Ensure projectsSectionTop is calculated after DOM is ready and on load
    window.addEventListener('DOMContentLoaded', updateProjectsSectionTop);
    window.addEventListener('load', updateProjectsSectionTop);
    
    onScroll(); // Call once to initialize scrollTarget based on initial scroll position

    // --- CAMERA HELPER (CRITICAL FOR DEBUGGING) ---
    // const helper = new THREE.CameraHelper( camera );
    // scene.add( helper ); 
    // --- END CAMERA HELPER ---

    // --- AXES HELPERS for visualizing orientation ---
    // const worldAxesHelper = new THREE.AxesHelper(50); 
    // scene.add(worldAxesHelper);
    // const galaxyAxesHelper = new THREE.AxesHelper(30); 
    // galaxyGroup.add(galaxyAxesHelper); 
    // --- END AXES HELPERS ---

    console.log("Initialization complete. Starting animation loop.");
    animate();
}

// After galaxyGroup = new THREE.Group();
const textureLoader = new THREE.TextureLoader();
textureLoader.load('https://threejs.org/examples/textures/sprites/glow.png', (glowTexture) => {
    const glowMaterial = new THREE.SpriteMaterial({
        map: glowTexture,
        color: 0xffffff,
        blending: THREE.AdditiveBlending,
        transparent: true,
        opacity: 0.22
    });
    const glowSprite = new THREE.Sprite(glowMaterial);
    glowSprite.scale.set(60, 60, 1); // Adjust size as needed
    glowSprite.position.set(0, 0, 0);
    galaxyGroup.add(glowSprite);
});

document.addEventListener('DOMContentLoaded', init);
window.scrollTo(0, 0); // Reset scroll on load
export { init };

// function addBlackHole() {
//     // --- Event Horizon (black sphere) ---
//     const horizonRadius = 3.2;
//     const horizonGeometry = new THREE.SphereGeometry(horizonRadius, 32, 32);
//     const horizonMaterial = new THREE.MeshBasicMaterial({ color: 0x000000, depthWrite: true, depthTest: true });
//     const eventHorizon = new THREE.Mesh(horizonGeometry, horizonMaterial);
//     eventHorizon.position.set(0, 0, 0);
//     eventHorizon.renderOrder = Infinity; // Absolutely last
//     if (galaxyGroup.children.includes(eventHorizon)) galaxyGroup.remove(eventHorizon);
//     galaxyGroup.add(eventHorizon);

//     // --- Accretion Disk (glowing ring) ---
//     const diskInner = horizonRadius * 1.15;
//     const diskOuter = horizonRadius * 2.2;
//     const accretionGeometry = new THREE.RingGeometry(diskInner, diskOuter, 128);
//     const diskCanvas = document.createElement('canvas');
//     diskCanvas.width = 256; diskCanvas.height = 256;
//     const ctx = diskCanvas.getContext('2d');
//     const grad = ctx.createRadialGradient(128,128,60,128,128,128);
//     grad.addColorStop(0.0, 'rgba(255,255,255,0.85)');
//     grad.addColorStop(0.25, 'rgba(255,220,120,0.55)');
//     grad.addColorStop(0.55, 'rgba(80,180,255,0.18)');
//     grad.addColorStop(0.85, 'rgba(0,0,0,0.0)');
//     ctx.fillStyle = grad;
//     ctx.beginPath();
//     ctx.arc(128,128,128,0,Math.PI*2);
//     ctx.fill();
//     const diskTexture = new THREE.CanvasTexture(diskCanvas);
//     diskTexture.wrapS = diskTexture.wrapT = THREE.ClampToEdgeWrapping;
//     const accretionMaterial = new THREE.MeshBasicMaterial({ 
//         map: diskTexture, 
//         transparent: true, 
//         side: THREE.DoubleSide, 
//         depthWrite: false,
//         depthTest: false, // Prevents hiding galaxy
//         blending: THREE.AdditiveBlending
//     });
//     const accretionDisk = new THREE.Mesh(accretionGeometry, accretionMaterial);
//     accretionDisk.position.set(0, 0, 0.1);
//     accretionDisk.rotation.x = Math.PI / 2;
//     accretionDisk.renderOrder = 999999;
//     if (galaxyGroup.children.includes(accretionDisk)) galaxyGroup.remove(accretionDisk);
//     galaxyGroup.add(accretionDisk);

//     // --- Lensing/Accretion Ring (subtle, color-shifting) ---
//     const lensingInner = diskOuter * 1.04;
//     const lensingOuter = diskOuter * 1.19; // Make it wider for more visible lensing
//     const lensingGeometry = new THREE.RingGeometry(lensingInner, lensingOuter, 256);
//     // Custom canvas texture for lensing ring
//     const lensingCanvas = document.createElement('canvas');
//     lensingCanvas.width = 256; lensingCanvas.height = 32;
//     const lctx = lensingCanvas.getContext('2d');
//     // Colorful, subtle chromatic aberration effect
//     const lgrad = lctx.createLinearGradient(0, 0, 256, 0);
//     lgrad.addColorStop(0.0, 'rgba(120,180,255,0.12)');
//     lgrad.addColorStop(0.18, 'rgba(255,255,255,0.22)');
//     lgrad.addColorStop(0.32, 'rgba(255,220,120,0.18)');
//     lgrad.addColorStop(0.5, 'rgba(255,255,255,0.28)');
//     lgrad.addColorStop(0.68, 'rgba(255,120,220,0.18)');
//     lgrad.addColorStop(0.82, 'rgba(255,255,255,0.22)');
//     lgrad.addColorStop(1.0, 'rgba(120,180,255,0.12)');
//     lctx.fillStyle = lgrad;
//     lctx.fillRect(0, 0, 256, 32);
//     const lensingTexture = new THREE.CanvasTexture(lensingCanvas);
//     lensingTexture.wrapS = lensingTexture.wrapT = THREE.RepeatWrapping;
//     lensingTexture.repeat.set(2, 1); // Subtle repeat for more detail
//     const lensingMaterial = new THREE.MeshBasicMaterial({
//         map: lensingTexture,
//         transparent: true,
//         side: THREE.DoubleSide,
//         depthWrite: false,
//         depthTest: false,
//         blending: THREE.AdditiveBlending,
//         opacity: 0.55 // More visible
//     });
//     const lensingRing = new THREE.Mesh(lensingGeometry, lensingMaterial);
//     lensingRing.position.set(0, 0, 0.13);
//     lensingRing.rotation.x = Math.PI / 2;
//     lensingRing.renderOrder = 1000000;
//     // Animate the lensing ring's color subtly for a premium effect
//     function animateLensingRing() {
//         const t = performance.now() * 0.00018;
//         lensingMaterial.opacity = 0.38 + 0.18 * Math.sin(t * 1.2);
//         lensingRing.material.color.setHSL(0.62 + 0.08 * Math.sin(t * 0.7), 0.7, 0.72 + 0.08 * Math.cos(t * 0.9));
//         requestAnimationFrame(animateLensingRing);
//     }
//     animateLensingRing();
//     if (galaxyGroup.children.includes(lensingRing)) galaxyGroup.remove(lensingRing);
//     galaxyGroup.add(lensingRing);
// }
