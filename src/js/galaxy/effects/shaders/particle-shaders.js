export const particleVertexShader = `
    precision mediump float;
    uniform float uTime;
    uniform float uSize;
    uniform float uScale;

    attribute float aSize; 
    attribute vec3 aColor; // Only using first color now - others will be uniforms
    attribute float aRotationSpeed;
    attribute float aDistanceFromCenter;
    attribute float aTwinkleSpeed;
    attribute float aSeed;
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
        // Add subtle twinkling effect to all disk particles
        float starTwinkle = 1.0;
        if (aDistanceFromCenter > 0.0) {
            starTwinkle = 1.0 + 0.1 * sin(uTime * 3.14159 + aSeed * 6.28318);
        }
        vParticleOpacityFactor = twinkle * starTwinkle;
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
    precision mediump float;
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
        
        // Three-color gradient based on distance
        float distanceFactor = clamp(vDistanceFromCenter / uMaxDistance, 0.0, 1.0);
        
        // Define our three colors (matches params in main.js)
        vec3 colorInner = vec3(0.690, 0.862, 1.0);   // #B0DCFF
        vec3 colorMid = vec3(1.0, 0.714, 0.757);     // #FFB6C1
        vec3 colorOuter = vec3(1.0, 0.855, 0.725);   // #FFDAB9
        
        // Smooth transitions between color zones
        float innerToMid = smoothstep(0.0, 0.4, distanceFactor);
        float midToOuter = smoothstep(0.4, 0.8, distanceFactor);
        
        // Blend between colors
        vec3 color = mix(colorInner, colorMid, innerToMid);
        color = mix(color, colorOuter, midToOuter);
        
        gl_FragColor = vec4(color, alpha * uParticleOpacity * vParticleOpacityFactor * vFade);
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