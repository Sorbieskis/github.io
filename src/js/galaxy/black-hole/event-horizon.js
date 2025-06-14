import * as THREE from 'three';

export function createEventHorizon(scene, params) {
    // Create black sphere geometry
    const geometry = new THREE.SphereGeometry(
        params.blackHole.radius, // Radius
        32, // Width segments
        32  // Height segments
    );

    // Create perfectly black material with slight emission
    const material = new THREE.MeshBasicMaterial({
        color: 0x000000,
        emissive: 0x111111,
        transparent: true,
        opacity: 1.0
    });

    // Create mesh and position at center
    const eventHorizon = new THREE.Mesh(geometry, material);
    eventHorizon.position.set(0, 0, 0);
    
    // Add to scene
    scene.add(eventHorizon);

    return eventHorizon;
}