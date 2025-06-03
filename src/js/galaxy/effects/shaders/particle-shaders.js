export const particleVertexShader = `
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
    varying float vDistanceFromCenter; // For depth effects

    void main() {
        vColor = aColor;
        float twinkle = 1.0;
        if (aTwinkleSpeed != 0.0) {
            twinkle = 0.78 + 0.32 * sin(uTime * aTwinkleSpeed * 0.7 + aDistanceFromCenter * 0.1);
        }
        vParticleOpacityFactor = twinkle; 
        vFade = aFade; 
        vDistanceFromCenter = aDistanceFromCenter;

        vec3 transformedPosition = position;
        float angle = uTime * aRotationSpeed * 0.035 + (aDistanceFromCenter * 0.00035); 
        mat2 rotationMatrix = mat2(cos(angle), -sin(angle), sin(angle), cos(angle));
        transformedPosition.xz = rotationMatrix * transformedPosition.xz;

        vec4 mvPosition = modelViewMatrix * vec4(transformedPosition, 1.0);
        gl_PointSize = aSize * uSize * (uScale / -mvPosition.z); 
        gl_Position = projectionMatrix * mvPosition;
    }
`;

export const particleFragmentShader = `
    varying vec3 vColor;
    varying float vParticleOpacityFactor;
    varying float vFade;
    varying float vDistanceFromCenter;
    uniform float uParticleOpacity;
    uniform float uMaxDistance;

    void main() {
        float dist = distance(gl_PointCoord, vec2(0.5));
        float alpha = 1.0 - smoothstep(0.3, 0.5, dist); 
        if (alpha < 0.001) discard;
        
        // Apply redshift based on distance
        float distanceFactor = vDistanceFromCenter / uMaxDistance;
        vec3 shiftedColor = vColor;
        shiftedColor.r *= 1.0 + distanceFactor * 0.4;
        shiftedColor.g *= 1.0 - distanceFactor * 0.2;
        shiftedColor.b *= 1.0 - distanceFactor * 0.3;
        
        gl_FragColor = vec4(shiftedColor, alpha * uParticleOpacity * vParticleOpacityFactor * vFade);
    }
`;

export const VignetteShader = {
    uniforms: {
        'tDiffuse': { value: null },
        'offset': { value: 1.2 },
        'darkness': { value: 0.3 }
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