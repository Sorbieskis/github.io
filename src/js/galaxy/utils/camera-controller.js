import * as THREE from 'three';

export function createCameraController(scene, params) {
    // Setup Camera Rig
    const cameraRigY = new THREE.Object3D();
    const cameraRigX = new THREE.Object3D();
    const cameraDolly = new THREE.Object3D();

    const camera = new THREE.PerspectiveCamera(
        params.cameraFov, 
        window.innerWidth / window.innerHeight, 
        0.1, 
        5000
    );
    camera.position.set(0, 0, 0);

    cameraDolly.add(camera);
    cameraRigX.add(cameraDolly);
    cameraRigY.add(cameraRigX);
    scene.add(cameraRigY);

    // Set initial rig positions/rotations
    const initialDollyZ = 300;
    const initialRigXRotation = -Math.PI / 12;
    const totalRigYSweep = Math.PI * 0.5;
    
    cameraDolly.position.z = initialDollyZ;
    cameraRigX.rotation.x = initialRigXRotation;
    cameraRigY.rotation.y = -totalRigYSweep / 2;

    return {
        camera,
        cameraRigY,
        cameraRigX,
        cameraDolly,
        initialDollyZ,
        initialRigXRotation,
        totalRigYSweep
    };
}

export function updateCameraController(
    cameraController,
    easedScroll,
    mouseState,  // Declare mouseState as parameter
    elapsedTime
) {
    const {
        camera,
        cameraRigY,
        cameraRigX,
        cameraDolly,
        initialDollyZ,
        initialRigXRotation,
        totalRigYSweep
    } = cameraController;

    const RIG_LERP_FACTOR = 0.035;
    const SPRING_IDLE_DELAY = 0.7;
    const MOUSE_LERP = 0.05;
    
    // Create local state if not provided
    let localMouseState = mouseState || {
        mouseX: 0,
        mouseY: 0,
        targetMouseX: 0,
        targetMouseY: 0,
        lastMouseMoveTime: performance.now()
    };

    let targetDollyZ = initialDollyZ - (easedScroll * (initialDollyZ - 55));
    let targetRigYRotation = (easedScroll * totalRigYSweep) - (totalRigYSweep / 2);
    let targetRigXRotation = initialRigXRotation - (easedScroll * (initialRigXRotation - 0));
    
    // Apply mouse influence to rig rotation targets when fully zoomed
    if (easedScroll > 0.98) {
        const effectStrength = Math.max(0, (easedScroll - 0.98) / 0.02);
        const mouseInfluenceY = localMouseState.mouseX * (Math.PI / 72) * effectStrength;
        const mouseInfluenceX = -localMouseState.mouseY * (Math.PI / 90) * effectStrength;

        targetRigYRotation = ((1.0 * totalRigYSweep) - (totalRigYSweep / 2)) + mouseInfluenceY;
        targetRigXRotation = 0 + mouseInfluenceX;
    }

    // Breathing Effect at Rest
    const idleTime = performance.now() - localMouseState.lastMouseMoveTime;
    if (easedScroll > 0.99 && idleTime > SPRING_IDLE_DELAY * 1000) {
        const breathAmount = 1.0;
        const breathSpeed = 0.35;
        targetDollyZ = 55 + (Math.sin(elapsedTime * breathSpeed) * breathAmount);
    }

    // Update camera rig
    cameraRigY.rotation.y += (targetRigYRotation - cameraRigY.rotation.y) * RIG_LERP_FACTOR;
    cameraRigX.rotation.x += (targetRigXRotation - cameraRigX.rotation.x) * RIG_LERP_FACTOR;
    cameraDolly.position.z += (targetDollyZ - cameraDolly.position.z) * RIG_LERP_FACTOR;
    
    // Dynamic FOV
    const targetFov = 60 - (easedScroll * 15);
    camera.fov += (targetFov - camera.fov) * RIG_LERP_FACTOR;
    camera.updateProjectionMatrix();
    
    // Update mouse positions
    localMouseState.mouseX += (localMouseState.targetMouseX - localMouseState.mouseX) * MOUSE_LERP;
    localMouseState.mouseY += (localMouseState.targetMouseY - localMouseState.mouseY) * MOUSE_LERP;
    
    return localMouseState;
}

// Mouse tracking variables
let mouseX = 0, mouseY = 0;
let targetMouseX = 0, targetMouseY = 0;
let lastMouseMoveTime = 0;

export function setupMouseControls() {
    const mouseState = {
        mouseX: 0,
        mouseY: 0,
        targetMouseX: 0,
        targetMouseY: 0,
        lastMouseMoveTime: 0
    };
    
    window.addEventListener('mousemove', (e) => {
        const w = window.innerWidth, h = window.innerHeight;
        mouseState.targetMouseX = ((e.clientX / w) - 0.5) * 2;
        mouseState.targetMouseY = ((e.clientY / h) - 0.5) * 2;
        mouseState.lastMouseMoveTime = performance.now();
    }, { passive: true });
    
    return mouseState;
}