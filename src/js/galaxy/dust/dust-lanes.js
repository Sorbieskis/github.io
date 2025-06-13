import * as THREE from 'three';

/**
 * Creates and configures the definitive, particle-based dust lane systems for the galaxy.
 * This approach uses a high count of small particles, generated in a spiral pattern
 * to ensure visual cohesion with the starfield and a realistic, large-scale structure.
 * @param {object} params - The global params object from main.js.
 * @param {THREE.Group} galaxyGroup - The main group to add the particles to.
 * @returns {THREE.Group} A group containing the two generated dust particle systems.
 */
export function createDustLanes(params, galaxyGroup) {
    const dustGroup = new THREE.Group();

    // Configuration for the two dust layers for a volumetric effect
    const layersConfig = [
        { // Main, dense dust lane, closer to the galactic plane
            particleCount: params.dustParticleCount * 0.7,
            color: params.dustColor1,
            radiusMin: params.dustLaneRadiusMin,
            radiusMax: params.dustLaneRadiusMax,
            thickness: params.dustLaneThickness * 0.5, // Denser core lane
            particleSize: params.dustParticleSize * 0.9,
            opacity: params.dustOpacity,
            rotationSpeedFactor: params.dustParticleRotationSpeedFactor
        },
        { // Secondary, wispier haze, more spread out
            particleCount: params.dustParticleCount * 0.3,
            color: params.dustColor2,
            radiusMin: params.dustLaneRadiusMin - 15,
            radiusMax: params.dustLaneRadiusMax + 15,
            thickness: params.dustLaneThickness * 1.5, // More vertical spread
            particleSize: params.dustParticleSize * 0.7,
            opacity: params.dustOpacity * 0.6,
            rotationSpeedFactor: params.dustParticleRotationSpeedFactor * 0.8
        }
    ];

    layersConfig.forEach(config => {
        const geometry = new THREE.BufferGeometry();
        const positions = new Float32Array(config.particleCount * 3);
        const colors = new Float32Array(config.particleCount * 3);
        const sizes = new Float32Array(config.particleCount);

        const color = new THREE.Color(config.color);

        // --- Spiral Generation Logic (in JavaScript) ---
        const numArms = params.numSpiralArms;
        const armSeparation = (Math.PI * 2) / numArms;
        // Use a slightly different tightness for dust to offset it from the star arms
        const tightness = params.spiralTightness * 1.05; 

        for (let i = 0; i < config.particleCount; i++) {
            const armIndex = i % numArms;
            const angleOffset = armIndex * armSeparation;

            const r = config.radiusMin + Math.pow(Math.random(), 1.5) * (config.radiusMax - config.radiusMin);
            const baseAngle = Math.log(r / (params.dustLaneRadiusMin * 0.8)) / tightness;
            let theta = baseAngle + angleOffset;

            // Add spread to create clouds, not lines
            const spreadFactor = Math.random() * params.armSpread * 0.5;
            theta += (Math.random() - 0.5) * spreadFactor;

            const x = Math.cos(theta) * r;
            const z = Math.sin(theta) * r;
            const y = (Math.random() - 0.5) * config.thickness;

            positions[i * 3 + 0] = x;
            positions[i * 3 + 1] = y;
            positions[i * 3 + 2] = z;

            // Add subtle color variation
            const colorVariation = (Math.random() - 0.5) * 0.1;
            colors[i * 3 + 0] = color.r + colorVariation;
            colors[i * 3 + 1] = color.g + colorVariation;
            colors[i * 3 + 2] = color.b + colorVariation;

            sizes[i] = config.particleSize * (0.5 + Math.random() * 0.5);
        }

        geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
        geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3));
        geometry.setAttribute('size', new THREE.BufferAttribute(sizes, 1));
        
        // Use a simple, performant material
        const material = new THREE.PointsMaterial({
            size: config.particleSize,
            opacity: config.opacity,
            blending: THREE.NormalBlending,
            transparent: true,
            depthWrite: false,
            vertexColors: true,
            sizeAttenuation: true,
        });

        const points = new THREE.Points(geometry, material);
        points.userData = { rotationSpeed: config.rotationSpeedFactor };
        dustGroup.add(points);
    });

    galaxyGroup.add(dustGroup);

    // Add an update function for simple rotation in the main animation loop
    dustGroup.userData.update = (time) => {
        dustGroup.children.forEach(layer => {
            // UPDATED: Slowed down rotation to be less distracting
            layer.rotation.y = time * layer.userData.rotationSpeed * 0.05;
        });
    };

    return dustGroup;
}