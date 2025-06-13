import * as THREE from 'three';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';
import { ShaderPass } from 'three/addons/postprocessing/ShaderPass.js';

import { createGalaxyCore } from './core/galaxy-core.js';
import { createGalaxyDisk } from './disk/galaxy-disk.js';
// Correctly import the particle-based dust lanes function
import { createDustLanes } from './dust/dust-lanes.js'; 
import { createBackgroundStars } from './environment/background-stars.js';
import { createCameraController, updateCameraController, setupMouseControls } from './utils/camera-controller.js';
import { VignetteShader } from './effects/shaders/particle-shaders.js';

// Parameters adjusted for the final particle-based dust lane approach
const params = {
    coreParticleCount: 20000, coreColor1: '#FFFAE0', coreColor2: '#FFEBCD', coreColorBright: '#FFFFFF',
    coreSize: 0.35, coreOpacity: 0.9, coreRadius: 22,
    diskParticleCount: 50000, diskColor1: '#FFDAB9', diskColor2: '#FFB6C1', diskColor3: '#B0DCFF',
    diskSize: 0.28, diskOpacity: 0.7, numSpiralArms: 4, spiralTightness: 0.28, armSpread: 2.5,
    armLength: 140, armInnerRadiusFactor: 0.25,
    // A high particle count is key for the new dust lane effect
    dustParticleCount: 150000, 
    dustColor1: '#4B3621', 
    dustColor2: '#3D2B1F', 
    // UPDATED: Increased base size for more prominent particles from a distance
    dustParticleSize: 0.5,
    // UPDATED: Increased base opacity for more visible dust clouds
    dustOpacity: 0.75,
    dustLaneRadiusMin: 40, 
    dustLaneRadiusMax: 120, 
    dustLaneThickness: 25,
    dustParticleRotationSpeedFactor: 0.5, 
    bgStarCount: 15000, bgStarSize: 0.06, bgStarOpacity: 0.35,
    bloomEnabled: true, bloomThreshold: 0.8, bloomStrength: 0.4, bloomRadius: 0.5,
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
let animationFrameId = null;
let isAnimationPaused = false;
let mouseRotationFactor = 1.0;
let targetRotationFactor = 1.0;
const LERP_FACTOR = 0.025;
const MOUSE_SENSITIVITY = 0.4;
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
    animationFrameId = requestAnimationFrame(animate);
    const elapsedTime = isAnimationPaused ? 0 : clock.getElapsedTime();
    
    mouseRotationFactor += (targetRotationFactor - mouseRotationFactor) * 0.1;
    
    const adjustedTime = elapsedTime * mouseRotationFactor;
    // Animate star systems using shader time
    if (particlesCore) particlesCore.material.uniforms.uTime.value = adjustedTime;
    if (particlesDisk) particlesDisk.material.uniforms.uTime.value = adjustedTime;

    // Animate dust system using its custom update function
    if (dustLaneParticles && dustLaneParticles.userData.update) {
        dustLaneParticles.userData.update(adjustedTime);
    }
    
    scrollCurrent += (scrollTarget - scrollCurrent) * LERP_FACTOR;
    const easedScroll = easeInOutCubic(scrollCurrent);
    window._easedScroll = easedScroll;
    
    // UPDATED: Added fade-out logic for dust lanes to make them less distracting up close
    if (dustLaneParticles) {
        // Calculate a fade factor based on scroll position. Starts at 1 (fully visible) and fades to 0.
        const dustFadeFactor = 1.0 - Math.min(easedScroll / 0.5, 1.0);
        
        // Apply the fade to both dust layers
        dustLaneParticles.children.forEach((layer, index) => {
            const baseOpacity = (index === 0) ? params.dustOpacity : params.dustOpacity * 0.6;
            layer.material.opacity = baseOpacity * dustFadeFactor;
        });
    }

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
    
    canvasElement.addEventListener('mousemove', (event) => {
        const mouseX = event.clientX / window.innerWidth;
        targetRotationFactor = 0.8 + mouseX * MOUSE_SENSITIVITY;
    });
    
    canvasElement.addEventListener('mouseleave', () => {
        targetRotationFactor = 1.0;
    });
    
    renderer = new THREE.WebGLRenderer({
        canvas: canvasElement,
        antialias: false,
        powerPreference: 'high-performance',
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
    // Correctly call the particle-based dust lane function
    dustLaneParticles = createDustLanes(params, galaxyGroup); 
    backgroundStars = createBackgroundStars(params, scene);
    
    handleResize(); 
    setupPostProcessing();
    window.addEventListener('resize', handleResize);
    window.addEventListener('scroll', onScroll, { passive: true });
    window.addEventListener('DOMContentLoaded', updateProjectsSectionTop);
    window.addEventListener('load', updateProjectsSectionTop);
    onScroll();
    
    console.log("Initialization complete. Starting animation loop.");
    
    document.addEventListener('visibilitychange', () => {
        if (document.hidden) {
            if (animationFrameId && !isAnimationPaused) {
                cancelAnimationFrame(animationFrameId);
                isAnimationPaused = true;
            }
        } else {
            if (isAnimationPaused) {
                isAnimationPaused = false;
                clock.start();
                animate();
            }
        }
    });

    animate();
}
