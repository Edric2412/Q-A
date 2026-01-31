"use client";

import { useEffect, useRef } from "react";
import * as THREE from "three";
import { useTheme } from "./ThemeProvider";

interface WireframeMeshProps {
    variant?: "blue" | "teal" | "combined";
}

export function WireframeMesh({ variant = "combined" }: WireframeMeshProps) {
    const containerRef = useRef<HTMLDivElement>(null);
    const { resolvedTheme } = useTheme();
    const rendererRef = useRef<THREE.WebGLRenderer | null>(null);
    const animationIdRef = useRef<number | undefined>(undefined);

    useEffect(() => {
        if (!containerRef.current) return;

        const container = containerRef.current;
        const isDark = resolvedTheme === "dark";

        // Scene setup
        const scene = new THREE.Scene();

        const camera = new THREE.PerspectiveCamera(
            55,
            window.innerWidth / window.innerHeight,
            0.1,
            1000
        );
        camera.position.set(0, -15, 45); // Set further back for wider FOV coverage
        camera.lookAt(0, 0, 0);

        // Renderer
        const renderer = new THREE.WebGLRenderer({
            antialias: true,
            alpha: true,
        });
        renderer.setSize(window.innerWidth, window.innerHeight);
        renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
        renderer.setClearColor(isDark ? 0x050510 : 0xeef2ff, 1);
        container.appendChild(renderer.domElement);
        rendererRef.current = renderer;

        // Geometry - Spanning the WHOLE screen
        // Significantly increased dimensions to ensuring no edges are visible
        const segmentsX = 160;
        const segmentsY = 100;
        const planeWidth = 300; // VERY WIDE coverage
        const planeHeight = 200; // HIGH coverage

        const geometry = new THREE.PlaneGeometry(
            planeWidth,
            planeHeight,
            segmentsX,
            segmentsY
        );

        // Create vertex colors
        const colors: number[] = [];
        const positions = geometry.attributes.position;
        const count = positions.count;

        for (let i = 0; i < count; i++) {
            colors.push(0, 0, 0);
        }
        geometry.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));

        // Create per-particle size attribute for firefly-like twinkling
        const sizes: number[] = [];
        const baseSize = isDark ? 0.5 : 0.6; // Larger base size for more visible glow
        for (let i = 0; i < count; i++) {
            // Random size variation for natural firefly effect
            sizes.push(baseSize * (0.7 + Math.random() * 0.6));
        }
        geometry.setAttribute('size', new THREE.Float32BufferAttribute(sizes, 1));

        // Pre-generate random phase offsets and intensities for each particle
        const twinklePhases: number[] = [];
        const twinkleIntensities: number[] = [];
        for (let i = 0; i < count; i++) {
            twinklePhases.push(Math.random() * Math.PI * 2);
            // Some particles glow brighter than others (firefly effect)
            twinkleIntensities.push(0.3 + Math.random() * 0.7);
        }

        // Material - Enhanced for firefly glow
        const pointsMaterial = new THREE.PointsMaterial({
            vertexColors: true,
            size: baseSize,
            transparent: true,
            opacity: isDark ? 0.5 : 0.45, // Balanced opacity for visible but subtle background
            blending: THREE.AdditiveBlending, // Additive blending creates glow effect
            depthWrite: false,
            map: new THREE.TextureLoader().load('https://raw.githubusercontent.com/mrdoob/three.js/master/examples/textures/sprites/disc.png'),
        });

        const points = new THREE.Points(geometry, pointsMaterial);
        // Flatter rotation to create a "sea" of particles rather than a strip
        points.rotation.x = -Math.PI / 3;
        points.rotation.z = 0; // Remove tilt to keep it symmetrical and wide
        scene.add(points);

        // Animation
        const clock = new THREE.Clock();

        const animate = () => {
            const t = clock.getElapsedTime() * 0.055;

            const positions = geometry.attributes.position;
            const colorAttr = geometry.attributes.color;
            const sizeAttr = geometry.attributes.size;

            for (let i = 0; i < count; i++) {
                const x = positions.getX(i);
                const y = positions.getY(i);

                // Smoother wave motion
                const wave1 = Math.sin((x + y) * 0.06 + t) * 4;
                const wave2 = Math.cos((x - y) * 0.04 + t * 0.8) * 3;
                const z = wave1 + wave2;
                positions.setZ(i, z);

                // Height - normalized for color mapping
                const height = (z + 8) / 16;
                const h = Math.max(0, Math.min(1, height));

                // Firefly-like twinkle with variable intensity
                const twinkleSpeed = 2 + twinkleIntensities[i] * 2; // Varying speeds
                const twinkle = 0.5 + 0.5 * Math.sin(t * twinkleSpeed + twinklePhases[i]);
                const glowIntensity = twinkle * twinkleIntensities[i];
                sizeAttr.setX(i, baseSize * (0.8 + twinkle * 0.4));

                // --- COLOR LOGIC BASED ON VARIANT ---
                let r, g, b;

                // STRATEGY: Use deeper, purer colors.
                if (variant === "blue") {
                    r = 0.1;
                    g = 0.2;
                    b = 0.6; // Strong blue base
                } else if (variant === "teal") {
                    r = 0.0;
                    g = 0.4;
                    b = 0.4; // Strong teal
                } else {
                    // COMBINED THEME
                    const colorWave = Math.sin(x * 0.05 + t * 0.4) * 0.5 + 0.5;

                    // Base 1: Deep Blue/Violet
                    const r1 = 0.2 + h * 0.1;
                    const g1 = 0.1;
                    const b1 = 0.5 + h * 0.2;

                    // Base 2: Deep Teal/Emerald
                    const r2 = 0.0;
                    const g2 = 0.4 + h * 0.2;
                    const b2 = 0.3;

                    r = r1 * (1 - colorWave) + r2 * colorWave;
                    g = g1 * (1 - colorWave) + g2 * colorWave;
                    b = b1 * (1 - colorWave) + b2 * colorWave;
                }

                // Apply firefly glow intensity to colors
                if (isDark) {
                    const glowBoost = 1 + glowIntensity * 1.5; // Brighter glow for prominent particles
                    colorAttr.setXYZ(i, r * glowBoost, g * glowBoost, b * glowBoost);
                } else {
                    const glowBoost = 1.5 + glowIntensity * 0.5;
                    colorAttr.setXYZ(i, r * glowBoost, g * glowBoost, b * glowBoost);
                }
            }

            positions.needsUpdate = true;
            colorAttr.needsUpdate = true;
            sizeAttr.needsUpdate = true;

            // Subtle camera movement
            camera.position.x = Math.sin(t * 0.15) * 1.5;
            camera.lookAt(0, 0, 0);

            renderer.render(scene, camera);
            animationIdRef.current = requestAnimationFrame(animate);
        };

        animate();

        // Handle resize
        const handleResize = () => {
            const width = window.innerWidth;
            const height = window.innerHeight;
            camera.aspect = width / height;
            camera.updateProjectionMatrix();
            renderer.setSize(width, height);
        };
        window.addEventListener("resize", handleResize);

        // Cleanup
        return () => {
            window.removeEventListener("resize", handleResize);
            if (animationIdRef.current) {
                cancelAnimationFrame(animationIdRef.current);
            }
            geometry.dispose();
            pointsMaterial.dispose();
            if (pointsMaterial.map) pointsMaterial.map.dispose();
            renderer.dispose();
            if (container.contains(renderer.domElement)) {
                container.removeChild(renderer.domElement);
            }
        };
    }, [resolvedTheme, variant]);

    return (
        <div
            ref={containerRef}
            style={{
                position: "fixed",
                top: 0,
                left: 0,
                width: "100%",
                height: "100%",
                zIndex: 0,
                pointerEvents: "none",
                // 30% blur for dreamy firefly atmosphere
                filter: "blur(3px)",
            }}
        />
    );
}

export { WireframeMesh as RibbonBackground };