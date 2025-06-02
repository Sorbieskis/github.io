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
    attribute float aFade; 

    varying vec3 vColor;
    varying float vParticleOpacityFactor;
    varying float vFade;

    void main() {
        vColor = aColor;
        float twinkle = 1.0;
        if (aTwinkleSpeed != 0.0) {
            twinkle = 0.78 + 0.32 * sin(uTime * aTwinkleSpeed * 0.7 + aDistanceFromCenter * 0.1);
        }
        vParticleOpacityFactor = twinkle; 
        vFade = aFade; 

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

const params = {
    coreParticleCount: 20000, coreColor1: '#FFFAE0', coreColor2: '#FFEBCD', coreColorBright: '#FFFFFF',
    coreSize: 0.35, coreOpacity: 0.9, coreRadius: 22, 
    diskParticleCount: 50000, diskColor1: '#B0DCFF', diskColor2: '#DADAFE', diskColor3: '#FFFFFF',
    diskSize: 0.28, diskOpacity: 0.7, numSpiralArms: 4, spiralTightness: 0.28, armSpread: 2.5,
    armLength: 140, armInnerRadiusFactor: 0.25,
    dustParticleCount: 60000, dustColor1: '#2c1f1f', dustColor2: '#382828', dustParticleSize: 0.2,
    dustOpacity: 0.35, dustLaneRadiusMin: 75, dustLaneRadiusMax: 115, dustLaneThickness: 15,
    dustParticleRotationSpeedFactor: 0.5, 
    bgStarCount: 1500, bgStarSize: 0.06, bgStarOpacity: 0.35,
    bloomEnabled: false, bloomThreshold: 0.45, bloomStrength: 0.5, bloomRadius: 0.7,    
    cameraFov: 55, particleBaseSize: 1.5, particlePerspectiveScale: 380.0, 
};

// === Main Animation Logic ===
let scene, camera, renderer, clock;
let composer, bloomPass, vignettePass;
let galaxyGroup, particlesCore, particlesDisk, dustLaneParticles, backgroundStars; 
let canvasElement; 

// --- Camera Rig Components ---
let cameraRigY, cameraRigX, cameraDolly; 
const RIG_LERP_FACTOR = 0.035; 

// --- Initial and Final Rig States for animation ---
const initialDollyZ = 300; 
const finalDollyZ = 55;    // Further from center, to be among arm stars
const initialRigXRotation = -Math.PI / 12; // Approx -15 degrees: looking UP from below
const finalRigXRotation = 0; // End with a level view for immersion
const totalRigYSweep = Math.PI * 0.5; // 90 degrees total horizontal sweep (-45 to +45)

// Scroll-related variables
let scrollTarget = 0; 
let scrollCurrent = 0; 
const LERP_FACTOR = 0.025; 

let projectsSectionTop = null;
function updateProjectsSectionTop() {
    const projectsSection = document.getElementById('projects');
    if (projectsSection) {
        const rect = projectsSection.getBoundingClientRect();
        projectsSectionTop = rect.top + window.scrollY;
    } else {
        projectsSectionTop = Math.max(document.body.scrollHeight - window.innerHeight, window.innerHeight * 3);
    }
}

function onScroll() {
    if (projectsSectionTop === null) {
        updateProjectsSectionTop(); 
    }
    let scrollNorm = 0;
    if (projectsSectionTop > 0) {
        scrollNorm = Math.min(1, Math.max(0, window.scrollY / projectsSectionTop));
    }
    scrollTarget = scrollNorm; 
}

function createGalaxyCore() { 
    if (particlesCore) galaxyGroup.remove(particlesCore);
    const particleCount = params.coreParticleCount;
    const positions = new Float32Array(particleCount * 3); const colors = new Float32Array(particleCount * 3); const sizes = new Float32Array(particleCount);
    const rotationSpeeds = new Float32Array(particleCount); const distanceFromCenterAttr = new Float32Array(particleCount);
    const twinkleSpeeds = new Float32Array(particleCount); const fadeAttr = new Float32Array(particleCount);
    const color1 = new THREE.Color(params.coreColor1); const color2 = new THREE.Color(params.coreColor2); const colorBright = new THREE.Color(params.coreColorBright);
    const coreRadius = params.coreRadius; let j = 0;
    for (let i = 0; i < particleCount; i++) {
        const r = Math.pow(Math.random(), 2.2) * coreRadius; let fade = 1.0;
        const theta = Math.random() * Math.PI * 2; const phi = Math.acos((Math.random() * 2) - 1);
        positions[j * 3 + 0] = r * Math.sin(phi) * Math.cos(theta); positions[j * 3 + 1] = r * Math.sin(phi) * Math.sin(theta) * 0.5; positions[j * 3 + 2] = r * Math.cos(phi);
        let pColor;
        if (r < coreRadius * 0.18 && Math.random() < 0.15) { pColor = colorBright.clone().lerp(new THREE.Color('#B0DCFF'), 0.3); pColor.r *= 2.2 + Math.random() * 0.7; pColor.g *= 2.0 + Math.random() * 0.5; pColor.b *= 2.0 + Math.random() * 0.7; sizes[j] = params.coreSize * 2.5 * (1.1 + Math.random() * 0.7);
        } else if (r < coreRadius * 0.25) { pColor = colorBright.clone(); pColor.r *= (1.8 + Math.random() * 1.2); pColor.g *= (1.8 + Math.random() * 1.0); pColor.b *= (1.5 + Math.random() * 0.7); sizes[j] = params.coreSize * (1.5 + Math.random() * 0.7);
        } else if (r < coreRadius * 0.65) { pColor = Math.random() > 0.3 ? color1.clone() : colorBright.clone().lerp(color1, 0.4); pColor.lerp(color2, Math.random() * 0.2); sizes[j] = params.coreSize * (1.1 + Math.random() * 0.5);
        } else { pColor = Math.random() > 0.5 ? color1.clone() : color2.clone(); pColor.lerp(color2, Math.random() * 0.4); sizes[j] = params.coreSize * (0.7 + Math.random() * 0.5); }
        if (Math.random() < 0.08) pColor.lerp(new THREE.Color('#FFD6E0'), 0.3 + Math.random() * 0.3); if (Math.random() < 0.08) pColor.lerp(new THREE.Color('#B0FFEA'), 0.3 + Math.random() * 0.3);
        colors[j * 3 + 0] = pColor.r; colors[j * 3 + 1] = pColor.g; colors[j * 3 + 2] = pColor.b;
        sizes[j] = Math.max(params.coreSize * 0.15, sizes[j]); rotationSpeeds[j] = (Math.random() - 0.5) * 0.07 + 0.025; distanceFromCenterAttr[j] = r;
        twinkleSpeeds[j] = Math.random() < 0.12 ? (0.7 + Math.random() * 1.2) * (Math.random() < 0.5 ? 1 : -1) : 0; fadeAttr[j] = fade; j++;
    }
    const finalCount = j; const geometry = new THREE.BufferGeometry();
    geometry.setAttribute('position', new THREE.BufferAttribute(positions.slice(0, finalCount * 3), 3)); geometry.setAttribute('aColor', new THREE.BufferAttribute(colors.slice(0, finalCount * 3), 3));
    geometry.setAttribute('aSize', new THREE.BufferAttribute(sizes.slice(0, finalCount), 1)); geometry.setAttribute('aRotationSpeed', new THREE.BufferAttribute(rotationSpeeds.slice(0, finalCount), 1));
    geometry.setAttribute('aDistanceFromCenter', new THREE.BufferAttribute(distanceFromCenterAttr.slice(0, finalCount), 1)); geometry.setAttribute('aTwinkleSpeed', new THREE.BufferAttribute(twinkleSpeeds.slice(0, finalCount), 1));
    geometry.setAttribute('aFade', new THREE.BufferAttribute(fadeAttr.slice(0, finalCount), 1));
    const material = new THREE.ShaderMaterial({ uniforms: { uTime: { value: 0.0 }, uSize: { value: params.particleBaseSize },  uScale: { value: params.particlePerspectiveScale }, uParticleOpacity: { value: params.coreOpacity }}, vertexShader: particleVertexShader, fragmentShader: particleFragmentShader, blending: THREE.AdditiveBlending, depthWrite: false, transparent: true, });
    particlesCore = new THREE.Points(geometry, material); galaxyGroup.add(particlesCore);
}
function createGalaxyDisk() { 
    if (particlesDisk) galaxyGroup.remove(particlesDisk); const particleCount = params.diskParticleCount;
    const positions = new Float32Array(particleCount * 3); const colors = new Float32Array(particleCount * 3); const sizes = new Float32Array(particleCount); 
    const rotationSpeeds = new Float32Array(particleCount); const distanceFromCenterAttr = new Float32Array(particleCount); const twinkleSpeeds = new Float32Array(particleCount);
    const fadeAttr = new Float32Array(particleCount).fill(1.0); 
    const color1 = new THREE.Color(params.diskColor1); const color2 = new THREE.Color(params.diskColor2); const color3 = new THREE.Color(params.diskColor3); const baseColors = [color1, color2, color3];
    const numArms = params.numSpiralArms; const armSeparation = (Math.PI * 2) / numArms; const tightness = params.spiralTightness; const armLength = params.armLength; const minArmRadius = armLength * params.armInnerRadiusFactor;
    for (let i = 0; i < particleCount; i++) {
        const armIndex = i % numArms; const angleOffset = armIndex * armSeparation; const r_norm = Math.pow(Math.random(), 1.4); const r = minArmRadius + r_norm * (armLength - minArmRadius);
        const baseAngle = Math.log(Math.max(0.1, r - minArmRadius + 1) / (armLength * 0.04) + 1) / tightness; let theta = baseAngle + angleOffset;
        const spreadFactor = params.armSpread * (1 - Math.pow((r - minArmRadius) / (armLength - minArmRadius), 0.6)); theta += (Math.random() - 0.5) * spreadFactor * (Math.PI / numArms) * 0.7;
        const x = Math.cos(theta) * r; const z = Math.sin(theta) * r; const y_factor = (1 - Math.pow(r / armLength, 1.8)); const y = (Math.random() - 0.5) * 12 * y_factor ; 
        positions[i * 3 + 0] = x; positions[i * 3 + 1] = y; positions[i * 3 + 2] = z;
        const mixedColor = baseColors[Math.floor(Math.random() * baseColors.length)].clone();
        if (Math.random() < 0.08) mixedColor.lerp(new THREE.Color('#FFD6E0'), 0.3 + Math.random() * 0.3); if (Math.random() < 0.08) mixedColor.lerp(new THREE.Color('#B0FFEA'), 0.3 + Math.random() * 0.3);
        mixedColor.lerp(new THREE.Color(0xffffff), Math.random() * 0.1); colors[i * 3 + 0] = mixedColor.r; colors[i * 3 + 1] = mixedColor.g; colors[i * 3 + 2] = mixedColor.b;
        if (Math.random() < 0.01) { sizes[i] = params.diskSize * 2.5 * (1.1 + Math.random() * 0.7); } else { sizes[i] = params.diskSize * (0.5 + Math.random() * 0.9); }
        const normalizedDistance = r / armLength; rotationSpeeds[i] = (0.3 - normalizedDistance * 0.28) * (0.6 + Math.random() * 0.7); distanceFromCenterAttr[i] = r;
        twinkleSpeeds[i] = Math.random() < 0.12 ? (0.7 + Math.random() * 1.2) * (Math.random() < 0.5 ? 1 : -1) : 0;
    }
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3)); geometry.setAttribute('aColor', new THREE.BufferAttribute(colors, 3));
    geometry.setAttribute('aSize', new THREE.BufferAttribute(sizes, 1)); geometry.setAttribute('aRotationSpeed', new THREE.BufferAttribute(rotationSpeeds, 1));
    geometry.setAttribute('aDistanceFromCenter', new THREE.BufferAttribute(distanceFromCenterAttr, 1)); geometry.setAttribute('aTwinkleSpeed', new THREE.BufferAttribute(twinkleSpeeds, 1));
    geometry.setAttribute('aFade', new THREE.BufferAttribute(fadeAttr, 1));
    const material = new THREE.ShaderMaterial({ uniforms: { uTime: { value: 0.0 }, uSize: { value: params.particleBaseSize }, uScale: { value: params.particlePerspectiveScale }, uParticleOpacity: { value: params.diskOpacity }}, vertexShader: particleVertexShader, fragmentShader: particleFragmentShader, blending: THREE.AdditiveBlending, depthWrite: false, transparent: true,});
    particlesDisk = new THREE.Points(geometry, material); galaxyGroup.add(particlesDisk);
}
function createDustLaneParticles() { 
    if (dustLaneParticles) galaxyGroup.remove(dustLaneParticles); const particleCount = params.dustParticleCount;
    const positions = new Float32Array(particleCount * 3); const colors = new Float32Array(particleCount * 3); const sizes = new Float32Array(particleCount);
    const rotationSpeeds = new Float32Array(particleCount); const distanceFromCenterAttr = new Float32Array(particleCount); const fadeAttr = new Float32Array(particleCount).fill(1.0); 
    const color1 = new THREE.Color(params.dustColor1); const color2 = new THREE.Color(params.dustColor2);
    const radiusMin = params.dustLaneRadiusMin; const radiusMax = params.dustLaneRadiusMax; const thickness = params.dustLaneThickness;
    for (let i = 0; i < particleCount; i++) {
        const r_torus = radiusMin + Math.random() * (radiusMax - radiusMin); const angle_torus = Math.random() * Math.PI * 2; 
        const r_tube = Math.random() * thickness / 2; const angle_tube = Math.random() * Math.PI * 2; 
        const x_offset = Math.cos(angle_tube) * r_tube; const y_offset = Math.sin(angle_tube) * r_tube * 0.5; 
        positions[i * 3 + 0] = Math.cos(angle_torus) * (r_torus + x_offset); positions[i * 3 + 1] = y_offset; positions[i * 3 + 2] = Math.sin(angle_torus) * (r_torus + x_offset);
        const mixedColor = Math.random() > 0.5 ? color1.clone() : color2.clone(); mixedColor.lerp(color1, Math.random() * 0.3); 
        colors[i * 3 + 0] = mixedColor.r; colors[i * 3 + 1] = mixedColor.g; colors[i * 3 + 2] = mixedColor.b;
        sizes[i] = params.dustParticleSize * (0.7 + Math.random() * 0.6); 
        const normalizedDist = (r_torus - radiusMin) / (radiusMax - radiusMin); rotationSpeeds[i] = ((0.15 - normalizedDist * 0.1) * (0.8 + Math.random() * 0.4)) * params.dustParticleRotationSpeedFactor;
        distanceFromCenterAttr[i] = r_torus;
    }
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3)); geometry.setAttribute('aColor', new THREE.BufferAttribute(colors, 3));
    geometry.setAttribute('aSize', new THREE.BufferAttribute(sizes, 1)); geometry.setAttribute('aRotationSpeed', new THREE.BufferAttribute(rotationSpeeds, 1));
    geometry.setAttribute('aDistanceFromCenter', new THREE.BufferAttribute(distanceFromCenterAttr, 1)); geometry.setAttribute('aFade', new THREE.BufferAttribute(fadeAttr, 1));
    const material = new THREE.ShaderMaterial({ uniforms: { uTime: { value: 0.0 }, uSize: { value: params.particleBaseSize }, uScale: { value: params.particlePerspectiveScale }, uParticleOpacity: { value: params.dustOpacity } }, vertexShader: particleVertexShader, fragmentShader: particleFragmentShader, blending: THREE.NormalBlending, depthWrite: false, transparent: true, });
    dustLaneParticles = new THREE.Points(geometry, material); galaxyGroup.add(dustLaneParticles);
}
function createBackgroundStars() { 
    if (backgroundStars) scene.remove(backgroundStars); const starCount = params.bgStarCount;
    const positions = new Float32Array(starCount * 3); const colors = new Float32Array(starCount * 3); const sizes = new Float32Array(starCount);
    const fadeAttr = new Float32Array(starCount).fill(1.0); 
    const colorWhite = new THREE.Color(0xffffff); const colorBlueish = new THREE.Color(0xb0b0ff);
    for (let i = 0; i < starCount; i++) {
        const r = 250 + Math.random() * 2000; const theta = Math.random() * Math.PI * 2; const phi = Math.acos(2 * Math.random() - 1);
        positions[i * 3 + 0] = r * Math.sin(phi) * Math.cos(theta); positions[i * 3 + 1] = r * Math.sin(phi) * Math.sin(theta); positions[i * 3 + 2] = r * Math.cos(phi);
        const c = Math.random() > 0.6 ? colorBlueish.clone() : colorWhite.clone(); c.multiplyScalar(0.5 + Math.random() * 0.4); 
        colors[i * 3 + 0] = c.r; colors[i * 3 + 1] = c.g; colors[i * 3 + 2] = c.b;
        sizes[i] = params.bgStarSize * (0.4 + Math.random() * 1.2);
    }
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3)); geometry.setAttribute('aColor', new THREE.BufferAttribute(colors, 3));
    geometry.setAttribute('aSize', new THREE.BufferAttribute(sizes, 1)); 
    const dummyRotationSpeeds = new Float32Array(starCount).fill(0); const dummyDistances = new Float32Array(starCount).fill(0);
    geometry.setAttribute('aRotationSpeed', new THREE.BufferAttribute(dummyRotationSpeeds, 1)); geometry.setAttribute('aDistanceFromCenter', new THREE.BufferAttribute(dummyDistances, 1));
    geometry.setAttribute('aFade', new THREE.BufferAttribute(fadeAttr, 1));
    const material = new THREE.ShaderMaterial({ uniforms: { uTime: { value: 0.0 }, uSize: { value: params.particleBaseSize * 0.4 }, uScale: { value: params.particlePerspectiveScale * 2.5 }, uParticleOpacity: { value: params.bgStarOpacity }}, vertexShader: particleVertexShader, fragmentShader: particleFragmentShader, blending: THREE.AdditiveBlending, depthWrite: false, transparent: true, });
    backgroundStars = new THREE.Points(geometry, material); scene.add(backgroundStars); 
}

function setupPostProcessing() {
    composer = new EffectComposer(renderer);
    const renderPass = new RenderPass(scene, camera);
    composer.addPass(renderPass);
    const outputPass = new OutputPass();
    composer.addPass(outputPass);
}

function handleResize() {
    if (!camera || !renderer) return;
    const width = window.innerWidth; const height = window.innerHeight;
    camera.aspect = width / height;
    camera.updateProjectionMatrix();
    renderer.setSize(width, height);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    if (canvasElement) { canvasElement.style.width = `${width}px`; canvasElement.style.height = `${height}px`; }
    updateProjectsSectionTop(); 
    if (composer) composer.setSize(width, height);
}

function easeInOutCubic(t) {
    return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
}

let mouseX = 0, mouseY = 0;
let targetMouseX = 0, targetMouseY = 0;
let lastMouseMoveTime = 0;
const MOUSE_LERP = 0.05; 
const SPRING_IDLE_DELAY = 0.7; 

window.addEventListener('mousemove', (e) => {
    const w = window.innerWidth, h = window.innerHeight;
    targetMouseX = ((e.clientX / w) - 0.5) * 2;
    targetMouseY = ((e.clientY / h) - 0.5) * 2;
    lastMouseMoveTime = performance.now();
}, { passive: true });

function animate() {
    requestAnimationFrame(animate);
    const elapsedTime = clock.getElapsedTime();
    if (particlesCore) particlesCore.material.uniforms.uTime.value = elapsedTime;
    if (particlesDisk) particlesDisk.material.uniforms.uTime.value = elapsedTime; 
    if (dustLaneParticles) dustLaneParticles.material.uniforms.uTime.value = elapsedTime;
    
    scrollCurrent += (scrollTarget - scrollCurrent) * LERP_FACTOR;
    const easedScroll = easeInOutCubic(scrollCurrent);
    window._easedScroll = easedScroll; 

    // Update Camera Rig based on easedScroll
    // Base target rotations from scroll
    let targetRigYRotation = (easedScroll * totalRigYSweep) - (totalRigYSweep / 2);
    let targetRigXRotation = initialRigXRotation - (easedScroll * (initialRigXRotation - finalRigXRotation));
    let targetDollyZ = initialDollyZ - (easedScroll * (initialDollyZ - finalDollyZ)); // Base target for dolly

    // Mouse spring-back logic
    const idleTime = performance.now() - lastMouseMoveTime;
    if (easedScroll > 0.98 && idleTime > SPRING_IDLE_DELAY * 1000) {
        targetMouseX = 0; targetMouseY = 0; 
    }
    mouseX += (targetMouseX - mouseX) * MOUSE_LERP;
    mouseY += (targetMouseY - mouseY) * MOUSE_LERP;
    mouseX = Math.max(-1, Math.min(1, mouseX)); 
    mouseY = Math.max(-1, Math.min(1, mouseY));

    // Apply mouse influence to rig rotation targets when fully zoomed
    if (easedScroll > 0.98) {
        const effectStrength = Math.max(0, (easedScroll - 0.98) / 0.02); // Fade in effect from 0.98 to 1.0
        const mouseInfluenceY = mouseX * (Math.PI / 72) * effectStrength; // Max ~2.5 deg Y orbit from mouse
        const mouseInfluenceX = -mouseY * (Math.PI / 90) * effectStrength; // Max ~2 deg X orbit from mouse (inverted Y for natural feel)

        // Add mouse influence to the final calculated scroll-driven targets
        targetRigYRotation = ((1.0 * totalRigYSweep) - (totalRigYSweep / 2)) + mouseInfluenceY; 
        targetRigXRotation = finalRigXRotation + mouseInfluenceX; 
        
        // Galaxy group itself no longer tilts with mouse
        galaxyGroup.rotation.x = 0; 
        galaxyGroup.rotation.y = 0;
        
        // Camera roll based on mouseX
        camera.rotation.z = mouseX * 0.08 * effectStrength;
    } else {
        // Reset mouse-driven effects if not fully zoomed
        galaxyGroup.rotation.x = 0;
        galaxyGroup.rotation.y = 0;
        camera.rotation.z = 0;
    }

    // LERP rig components (Dolly LERP happens after potential breathing modification)
    
    // Breathing Effect at Rest
    const breathingIdleDelay = SPRING_IDLE_DELAY * 1000 + 750; // Wait a bit longer than mouse spring back
    if (easedScroll > 0.99 && idleTime > breathingIdleDelay) { 
        const breathAmount = 1.0; // Max dolly movement for breath
        const breathSpeed = 0.35;  // Speed of the breath cycle
        // Modify targetDollyZ for breathing; it's already at finalDollyZ if easedScroll is ~1
        targetDollyZ = finalDollyZ + (Math.sin(elapsedTime * breathSpeed) * breathAmount);
    }

    cameraRigY.rotation.y += (targetRigYRotation - cameraRigY.rotation.y) * RIG_LERP_FACTOR;
    cameraRigX.rotation.x += (targetRigXRotation - cameraRigX.rotation.x) * RIG_LERP_FACTOR;
    cameraDolly.position.z += (targetDollyZ - cameraDolly.position.z) * RIG_LERP_FACTOR;
    
    // Dynamic FOV
    const targetFov = 60 - (easedScroll * 15); // FOV from 60 down to 45
    camera.fov += (targetFov - camera.fov) * RIG_LERP_FACTOR; 
    camera.updateProjectionMatrix(); 

    camera.lookAt(galaxyGroup.position); 

    if (composer) composer.render();
    else if (renderer && scene && camera) renderer.render(scene, camera);
}

function init() {
    console.log("Starting init function with Camera Rig...");
    clock = new THREE.Clock(); 
    scene = new THREE.Scene();
    
    canvasElement = document.getElementById('sombreroCanvas');
    if (!canvasElement) {
        console.error('CRITICAL: Canvas element "sombreroCanvas" not found.'); return; 
    }
    canvasElement.style.display = "block"; canvasElement.style.position = "fixed";
    canvasElement.style.left = "0"; canvasElement.style.top = "0";
    canvasElement.style.width = "100vw"; canvasElement.style.height = "100vh";
    canvasElement.style.zIndex = "-2"; 
    console.log("Canvas element styled as fixed background via JS.");

    renderer = new THREE.WebGLRenderer({ canvas: canvasElement, antialias: true, alpha: true });
    renderer.debug.checkShaderErrors = true; 
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.outputColorSpace = THREE.SRGBColorSpace; 
    renderer.setClearColor(0x000000, 1); 
    console.log("Renderer initialized.");

    galaxyGroup = new THREE.Group();
    galaxyGroup.position.set(0, 0, 0); 
    scene.add(galaxyGroup);
    console.log("GalaxyGroup created.");

    // Setup Camera Rig
    cameraRigY = new THREE.Object3D();
    cameraRigX = new THREE.Object3D(); 
    cameraDolly = new THREE.Object3D(); 

    camera = new THREE.PerspectiveCamera(params.cameraFov, window.innerWidth / window.innerHeight, 0.1, 5000);
    camera.position.set(0, 0, 0); 

    cameraDolly.add(camera);
    cameraRigX.add(cameraDolly);
    cameraRigY.add(cameraRigX);
    scene.add(cameraRigY);
    
    // Set initial rig positions/rotations
    cameraDolly.position.z = initialDollyZ;
    cameraRigX.rotation.x = initialRigXRotation; 
    cameraRigY.rotation.y = -totalRigYSweep / 2; 

    console.log("Camera Rig setup.");
    
    createGalaxyCore(); createGalaxyDisk(); createDustLaneParticles(); createBackgroundStars();
    console.log("Galaxy components creation called.");

    handleResize(); 
    setupPostProcessing();
    window.addEventListener('resize', handleResize);
    window.addEventListener('scroll', onScroll, { passive: true });
    window.addEventListener('DOMContentLoaded', updateProjectsSectionTop);
    window.addEventListener('load', updateProjectsSectionTop);
    onScroll(); 

    console.log("Initialization complete. Starting animation loop.");
    animate();
}

const textureLoader = new THREE.TextureLoader();
textureLoader.load('https://threejs.org/examples/textures/sprites/glow.png', (glowTexture) => {
    const glowMaterial = new THREE.SpriteMaterial({ map: glowTexture, color: 0xffffff, blending: THREE.AdditiveBlending, transparent: true, opacity: 0.22 });
    const glowSprite = new THREE.Sprite(glowMaterial);
    glowSprite.scale.set(60, 60, 1); 
    glowSprite.position.set(0, 0, 0);
    galaxyGroup.add(glowSprite);
});

document.addEventListener('DOMContentLoaded', init);
window.scrollTo(0, 0); 
export { init };
