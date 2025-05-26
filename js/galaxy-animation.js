// Ethereal Sombrero Galaxy Animation (modular JS version)
// This file is pure JavaScript for use as a module or script, no HTML or <script> tags.
// All shader code is in JS strings. Visuals are preserved as in your HTML version.
import * as THREE from 'three';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';

// === Shader code as JS strings ===
const particleVertexShader = `
    uniform float uTime;
    uniform float uSize;
    uniform float uScale;

    attribute float aSize; 
    attribute vec3 aColor;
    attribute float aRotationSpeed; 
    attribute float aDistanceFromCenter;

    varying vec3 vColor;
    varying float vParticleOpacityFactor;

    void main() {
        vColor = aColor;
        vParticleOpacityFactor = 1.0; 

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
    uniform float uParticleOpacity;

    void main() {
        float dist = distance(gl_PointCoord, vec2(0.5));
        float alpha = 1.0 - smoothstep(0.3, 0.5, dist); 
        if (alpha < 0.001) discard;
        gl_FragColor = vec4(vColor, alpha * uParticleOpacity * vParticleOpacityFactor);
    }
`;

// === Parameters ===
const params = {
    coreParticleCount: 10000,
    coreColor1: '#FFFAE0',
    coreColor2: '#FFEBCD',
    coreColorBright: '#FFFFFF',
    coreSize: 0.35,
    coreOpacity: 0.9,
    coreRadius: 22,

    diskParticleCount: 28000,
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

    dustParticleCount: 40000,
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

    bloomEnabled: true,
    bloomThreshold: 0.45,  
    bloomStrength: 0.5,   
    bloomRadius: 0.7,    

    cameraAnimationSpeed: 0.005, 
    cameraFov: 55,

    particleBaseSize: 1.0,      
    particlePerspectiveScale: 380.0, 
};

// === Main Animation Logic ===
let scene, camera, renderer, composer, clock;
let galaxyGroup, particlesCore, particlesDisk, dustLaneParticles, backgroundStars;
let cameraPath;

function setupCameraPaths(center) {
    const orbitRadius = 160;
    const verticalRange = 35;
    const numPoints = 12;
    const cameraPathPoints = [];
    for (let i = 0; i < numPoints; i++) {
        const angle = (i / numPoints) * Math.PI * 2;
        const x = center.x + Math.cos(angle) * (orbitRadius + Math.sin(angle * 2) * 20);
        const z = center.z + Math.sin(angle) * (orbitRadius + Math.cos(angle * 2) * 20);
        const y = center.y + Math.sin(angle * 1.5) * verticalRange;
        cameraPathPoints.push(new THREE.Vector3(x, y, z));
    }
    cameraPath = new THREE.CatmullRomCurve3(cameraPathPoints, true);
}

function createGalaxyCore() {
    if (particlesCore) galaxyGroup.remove(particlesCore);
    const particleCount = params.coreParticleCount;
    const positions = new Float32Array(particleCount * 3);
    const colors = new Float32Array(particleCount * 3);
    const sizes = new Float32Array(particleCount);
    const rotationSpeeds = new Float32Array(particleCount);
    const distanceFromCenterAttr = new Float32Array(particleCount);

    const color1 = new THREE.Color(params.coreColor1);
    const color2 = new THREE.Color(params.coreColor2);
    const colorBright = new THREE.Color(params.coreColorBright);
    const coreRadius = params.coreRadius;

    for (let i = 0; i < particleCount; i++) {
        const r = Math.pow(Math.random(), 2.2) * coreRadius;
        const theta = Math.random() * Math.PI * 2;
        const phi = Math.acos((Math.random() * 2) - 1);
        positions[i * 3 + 0] = r * Math.sin(phi) * Math.cos(theta);
        positions[i * 3 + 1] = r * Math.sin(phi) * Math.sin(theta) * 0.5;
        positions[i * 3 + 2] = r * Math.cos(phi);

        let pColor;
        if (r < coreRadius * 0.25) { 
            pColor = colorBright.clone();
            pColor.r *= (1.8 + Math.random() * 1.2); 
            pColor.g *= (1.8 + Math.random() * 1.0);
            pColor.b *= (1.5 + Math.random() * 0.7);
        } else if (r < coreRadius * 0.65) { 
            pColor = Math.random() > 0.3 ? color1.clone() : colorBright.clone().lerp(color1, 0.4);
        } else { 
            pColor = Math.random() > 0.5 ? color1.clone() : color2.clone();
            pColor.lerp(color2, Math.random() * 0.4);
        }
        colors[i * 3 + 0] = pColor.r; colors[i * 3 + 1] = pColor.g; colors[i * 3 + 2] = pColor.b;
        sizes[i] = params.coreSize * (1.6 - Math.pow(r / coreRadius, 0.4)) * (0.6 + Math.random() * 0.7);
        sizes[i] = Math.max(params.coreSize * 0.15, sizes[i]);
        rotationSpeeds[i] = (Math.random() - 0.5) * 0.07 + 0.025; 
        distanceFromCenterAttr[i] = r;
    }
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    geometry.setAttribute('aColor', new THREE.BufferAttribute(colors, 3));
    geometry.setAttribute('aSize', new THREE.BufferAttribute(sizes, 1));
    geometry.setAttribute('aRotationSpeed', new THREE.BufferAttribute(rotationSpeeds, 1));
    geometry.setAttribute('aDistanceFromCenter', new THREE.BufferAttribute(distanceFromCenterAttr, 1));
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
        const mixedColor = baseColors[Math.floor(Math.random() * baseColors.length)].clone();
        mixedColor.lerp(new THREE.Color(0xffffff), Math.random() * 0.1);
        colors[i * 3 + 0] = mixedColor.r; colors[i * 3 + 1] = mixedColor.g; colors[i * 3 + 2] = mixedColor.b;
        sizes[i] = params.diskSize * (0.5 + Math.random() * 0.9); 
        const normalizedDistance = r / armLength;
        rotationSpeeds[i] = (0.3 - normalizedDistance * 0.28) * (0.6 + Math.random() * 0.7); 
        distanceFromCenterAttr[i] = r;
    }
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    geometry.setAttribute('aColor', new THREE.BufferAttribute(colors, 3));
    geometry.setAttribute('aSize', new THREE.BufferAttribute(sizes, 1));
    geometry.setAttribute('aRotationSpeed', new THREE.BufferAttribute(rotationSpeeds, 1));
    geometry.setAttribute('aDistanceFromCenter', new THREE.BufferAttribute(distanceFromCenterAttr, 1));
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
    const material = new THREE.ShaderMaterial({
        uniforms: {
            uTime: { value: 0.0 }, uSize: { value: params.particleBaseSize * 0.4 }, 
            uScale: { value: params.particlePerspectiveScale * 2.5 }, uParticleOpacity: { value: params.bgStarOpacity }
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
    composer.addPass(new RenderPass(scene, camera));
    const bloomPass = new UnrealBloomPass(
        new THREE.Vector2(renderer.domElement.clientWidth, renderer.domElement.clientHeight), 
        params.bloomStrength, params.bloomRadius, params.bloomThreshold
    );
    composer.addPass(bloomPass);
    const outputPass = new OutputPass();
    composer.addPass(outputPass);
}

function onWindowResize() {
    const canvas = renderer.domElement;
    const newWidth = canvas.clientWidth;
    const newHeight = canvas.clientHeight;

    camera.aspect = newWidth / newHeight;
    camera.updateProjectionMatrix();
    
    renderer.setSize(newWidth, newHeight);
    if (composer) composer.setSize(newWidth, newHeight);
    
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
}

function animate() {
    requestAnimationFrame(animate);
    const delta = clock.getDelta();
    const elapsedTime = clock.getElapsedTime();

    if (particlesCore) particlesCore.material.uniforms.uTime.value = elapsedTime;
    if (particlesDisk) particlesDisk.material.uniforms.uTime.value = elapsedTime;
    if (dustLaneParticles) dustLaneParticles.material.uniforms.uTime.value = elapsedTime;
    
    const time = (elapsedTime * params.cameraAnimationSpeed) % 1;
    const cameraPosition = cameraPath.getPointAt(time);
    camera.position.copy(cameraPosition);
    
    // Ensure camera always looks at the galaxyGroup's current world position
    // Since galaxyGroup is at (0, -10, 0) and doesn't move, this is fine.
    // If galaxyGroup itself moved, we'd need to get its world position.
    camera.lookAt(galaxyGroup.position); 

    if (params.bloomEnabled && composer) {
        composer.render(delta);
    } else {
        renderer.render(scene, camera);
    }
}

function init() {
    clock = new THREE.Clock();
    scene = new THREE.Scene();
    const canvas = document.getElementById('sombreroCanvas');
    if (!canvas) {
        console.error('Canvas #sombreroCanvas not found!');
        return;
    }
    renderer = new THREE.WebGLRenderer({ canvas: canvas, antialias: true, alpha: true });
    renderer.setSize(canvas.clientWidth, canvas.clientHeight);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.setClearColor(0x000000, 0);
    galaxyGroup = new THREE.Group();
    galaxyGroup.position.set(0, -10, 0);
    galaxyGroup.rotation.x = Math.PI / 12;
    scene.add(galaxyGroup);
    camera = new THREE.PerspectiveCamera(params.cameraFov, canvas.clientWidth / canvas.clientHeight, 0.1, 5000);
    setupCameraPaths(galaxyGroup.position);
    createGalaxyCore();
    createGalaxyDisk();
    createDustLaneParticles();
    createBackgroundStars();
    if (params.bloomEnabled) {
        setupPostProcessing();
    }
    window.addEventListener('resize', onWindowResize);
    animate();
}

if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
} else {
    init();
}
