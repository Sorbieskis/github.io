import * as THREE from 'three';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';
import { ShaderPass } from 'three/addons/postprocessing/ShaderPass.js';

// Removed duplicate export statement - init is already exported via 'export function init'

import { createGalaxyCore } from './core/galaxy-core.js';
import { createGalaxyDisk } from './disk/galaxy-disk.js';
import { createDustLaneParticles } from './dust/dust-lanes.js';
import { createBackgroundStars } from './environment/background-stars.js';
import { createCameraController, updateCameraController, setupMouseControls } from './utils/camera-controller.js';
import { VignetteShader } from './effects/shaders/particle-shaders.js';

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

let scene, camera, renderer, clock;
let composer, bloomPass, vignettePass;
let galaxyGroup, particlesCore, particlesDisk, dustLaneParticles, backgroundStars;
let canvasElement;
let cameraController;
let mouseState;
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

function setupPostProcessing() {
    composer = new EffectComposer(renderer);
    const renderPass = new RenderPass(scene, camera);
    composer.addPass(renderPass);
    
    bloomPass = new UnrealBloomPass(
        new THREE.Vector2(window.innerWidth, window.innerHeight), 
        params.bloomStrength, 
        params.bloomRadius, 
        params.bloomThreshold
    );
    composer.addPass(bloomPass);
    
    vignettePass = new ShaderPass(VignetteShader);
    composer.addPass(vignettePass);
    
    const outputPass = new OutputPass();
    composer.addPass(outputPass);
}

function handleResize() {
    if (!camera || !renderer) return;
    const width = window.innerWidth;
    const height = window.innerHeight;
    camera.aspect = width / height;
    camera.updateProjectionMatrix();
    renderer.setSize(width, height);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    if (canvasElement) {
        canvasElement.style.width = `${width}px`;
        canvasElement.style.height = `${height}px`;
    }
    updateProjectsSectionTop();
    if (composer) composer.setSize(width, height);
}

function easeInOutCubic(t) {
    return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
}

function animate() {
    requestAnimationFrame(animate);
    const elapsedTime = clock.getElapsedTime();
    
    if (particlesCore) particlesCore.material.uniforms.uTime.value = elapsedTime;
    if (particlesDisk) particlesDisk.material.uniforms.uTime.value = elapsedTime; 
    if (dustLaneParticles) dustLaneParticles.material.uniforms.uTime.value = elapsedTime;
    
    scrollCurrent += (scrollTarget - scrollCurrent) * LERP_FACTOR;
    const easedScroll = easeInOutCubic(scrollCurrent);
    window._easedScroll = easedScroll;
    
    if (cameraController && mouseState) {
        mouseState = updateCameraController(
            cameraController, 
            easedScroll, 
            mouseState.mouseX, 
            mouseState.mouseY, 
            elapsedTime
        );
    }

    if (composer) composer.render();
    else if (renderer && scene && camera) renderer.render(scene, camera);
}

export function init() {
    console.log("Starting galaxy initialization...");
    clock = new THREE.Clock(); 
    scene = new THREE.Scene();
    
    canvasElement = document.getElementById('sombreroCanvas');
    if (!canvasElement) {
        console.error('Canvas element not found');
        return;
    }
    canvasElement.style.display = "block";
    canvasElement.style.position = "fixed";
    canvasElement.style.left = "0";
    canvasElement.style.top = "0";
    canvasElement.style.width = "100vw";
    canvasElement.style.height = "100vh";
    canvasElement.style.zIndex = "-2";
    
    renderer = new THREE.WebGLRenderer({ 
        canvas: canvasElement, 
        antialias: true, 
        alpha: true 
    });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.setClearColor(0x000000, 1);
    
    galaxyGroup = new THREE.Group();
    scene.add(galaxyGroup);
    
    cameraController = createCameraController(scene, params);
    camera = cameraController.camera;
    mouseState = setupMouseControls();
    
    particlesCore = createGalaxyCore(params, galaxyGroup);
    particlesDisk = createGalaxyDisk(params, galaxyGroup);
    dustLaneParticles = createDustLaneParticles(params, galaxyGroup);
    backgroundStars = createBackgroundStars(params, scene);
    
    handleResize(); 
    setupPostProcessing();
    window.addEventListener('resize', handleResize);
    window.addEventListener('scroll', onScroll, { passive: true });
    window.addEventListener('DOMContentLoaded', updateProjectsSectionTop);
    window.addEventListener('load', updateProjectsSectionTop);
    onScroll();
    
    console.log("Initialization complete. Starting animation loop.");
    animate();
    
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
        glowSprite.scale.set(60, 60, 1);
        glowSprite.position.set(0, 0, 0);
        galaxyGroup.add(glowSprite);
    });
}