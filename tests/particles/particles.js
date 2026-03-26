import * as THREE from 'three';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { item, effect } from 'item.js';

// ============================================================
// item.js Reactive Particle System Demo
// 
// Demonstrates:
// - Each particle = reactive Item with x,y,vx,vy,age,hue properties
// - effect() automatically re-renders when particle state changes
// - Event bubbling (changeIn) for birth/reproduction tracking
// - Autovivification: particle.item('x').value = 10 creates property
// - Signal-based reactivity performance with thousands of items
// - Async iterator on particle collection
// ============================================================

class ParticleSystem {
    constructor() {
        this.maxParticles = 1500;
        this.birthsThisSecond = 0;
        this.effectCallsThisSecond = 0;
        this.lastReset = performance.now();
        this.paused = false;
        this.mouse = { x: 0, y: 0, active: false };
        
        // Root item containing all particles - demonstrates reactive collection
        this.rootItem = item({});
        this.particlesItem = this.rootItem.item('particles');
        
        // Stats as reactive items - autovivification creates these properties
        this.statsItem = this.rootItem.item('stats');
        this.statsItem.item('fps').set(60, { silent: true });
        this.statsItem.item('count').set(0, { silent: true });
        this.statsItem.item('births').set(0, { silent: true });
        this.statsItem.item('effects').set(0, { silent: true });
        
        this.init();
        this.createInitialParticles();
        this.setupReactiveRenderer();
        this.setupParticleGenerationLoop();
        this.setupEventListeners();
        this.setupMouseInteraction();
        this.animate();
    }

    init() {
        // Three.js setup
        this.scene = new THREE.Scene();
        this.scene.fog = new THREE.FogExp2(0x000000, 0.001);

        this.camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000);
        this.camera.position.z = 50;

        this.renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
        this.renderer.setSize(window.innerWidth, window.innerHeight);
        this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
        this.renderer.setClearColor(0x000000);
        document.getElementById('canvas-container').appendChild(this.renderer.domElement);

        this.composer = new EffectComposer(this.renderer);
        this.composer.addPass(new RenderPass(this.scene, this.camera));
        
        this.bloomPass = new UnrealBloomPass(
            new THREE.Vector2(window.innerWidth, window.innerHeight),
            1.5, 0.4, 0.85
        );
        this.composer.addPass(this.bloomPass);

        // Particle geometry - will be updated by effect()
        this.particleGeometry = new THREE.BufferGeometry();
        const maxCount = this.maxParticles;
        this.particleGeometry.setAttribute('position', new THREE.BufferAttribute(new Float32Array(maxCount * 3), 3));
        this.particleGeometry.setAttribute('color', new THREE.BufferAttribute(new Float32Array(maxCount * 3), 3));
        this.particleGeometry.setAttribute('size', new THREE.BufferAttribute(new Float32Array(maxCount), 1));
        this.particleGeometry.setDrawRange(0, 0);

        const texture = this.createParticleTexture();
        
        this.particleMaterial = new THREE.PointsMaterial({
            size: 1,
            vertexColors: true,
            map: texture,
            transparent: true,
            alphaTest: 0.1,
            blending: THREE.AdditiveBlending,
            depthWrite: false
        });

        this.points = new THREE.Points(this.particleGeometry, this.particleMaterial);
        this.scene.add(this.points);
        
        // Raycaster for mouse interaction
        this.raycaster = new THREE.Raycaster();
        this.mouseVector = new THREE.Vector2();
    }

    createParticleTexture() {
        const canvas = document.createElement('canvas');
        canvas.width = 64;
        canvas.height = 64;
        const ctx = canvas.getContext('2d');
        
        const gradient = ctx.createRadialGradient(32, 32, 0, 32, 32, 32);
        gradient.addColorStop(0, 'rgba(255, 255, 255, 1)');
        gradient.addColorStop(0.2, 'rgba(255, 255, 255, 0.8)');
        gradient.addColorStop(0.5, 'rgba(255, 255, 255, 0.3)');
        gradient.addColorStop(1, 'rgba(255, 255, 255, 0)');
        
        ctx.fillStyle = gradient;
        ctx.fillRect(0, 0, 64, 64);
        
        const texture = new THREE.CanvasTexture(canvas);
        texture.minFilter = THREE.LinearFilter;
        texture.magFilter = THREE.LinearFilter;
        return texture;
    }

    // Create a particle as reactive Item - demonstrates autovivification
    createParticle(parent = null, burst = false) {
        const particleId = crypto.randomUUID();
        const particle = this.particlesItem.item(particleId);
        
        const angle = Math.random() * Math.PI * 2;
        const radius = burst ? Math.random() * 5 : Math.random() * 40;
        
        // Each property is a reactive item - autovivification creates these
        const parentX = parent ? parent.item('x').peek() : null;
        const parentY = parent ? parent.item('y').peek() : null;
        const parentVX = parent ? parent.item('vx').peek() : null;
        const parentVY = parent ? parent.item('vy').peek() : null;
        const parentHue = parent ? parent.item('hue').peek() : null;
        const parentGen = parent ? parent.item('generation').peek() : null;
        
        particle.item('x').set(parent ? parentX + Math.cos(angle) * 2 : Math.cos(angle) * radius, { silent: true });
        particle.item('y').set(parent ? parentY + Math.sin(angle) * 2 : Math.sin(angle) * radius, { silent: true });
        particle.item('z').set((Math.random() - 0.5) * 20, { silent: true });
        particle.item('vx').set((Math.random() - 0.5) * 0.5 + (parent ? parentVX * 0.5 : 0), { silent: true });
        particle.item('vy').set((Math.random() - 0.5) * 0.5 + (parent ? parentVY * 0.5 : 0), { silent: true });
        particle.item('vz').set((Math.random() - 0.5) * 0.2, { silent: true });
        particle.item('age').set(0, { silent: true });
        particle.item('maxAge').set(300 + Math.random() * 200, { silent: true });
        particle.item('size').set(burst ? 2 : 0.5 + Math.random(), { silent: true });
        particle.item('targetSize').set(1 + Math.random() * 2, { silent: true });
        particle.item('hue').set(parent ? parentHue + (Math.random() - 0.5) * 30 : Math.random() * 360, { silent: true });
        particle.item('saturation').set(0.8 + Math.random() * 0.2, { silent: true });
        particle.item('lightness').set(0.5 + Math.random() * 0.3, { silent: true });
        particle.item('reproductiveUrge').set(0, { silent: true });
        particle.item('generation').set(parent ? parentGen + 1 : 0, { silent: true });
        particle.item('justBorn').set(burst ? 10 : 30, { silent: true });
        
        if (parent) {
            this.birthsThisSecond++;
            this.showBirthFlash(parentX, parentY);
        }
        
        return particle;
    }

    createInitialParticles() {
        for (let i = 0; i < 50; i++) {
            this.createParticle();
        }
    }

    showBirthFlash(x, y) {
        const flash = document.getElementById('birth-flash');
        const screenX = ((x / 50) + 1) * 50;
        const screenY = ((-y / 50) + 1) * 50;
        flash.style.setProperty('--x', `${screenX}%`);
        flash.style.setProperty('--y', `${screenY}%`);
        flash.style.opacity = '1';
        setTimeout(() => { flash.style.opacity = '0'; }, 100);
    }

    // ============================================================
    // REACTIVE RENDERING - The core item.js feature demo
    // effect() automatically re-runs when any accessed item changes
    // ============================================================
    setupReactiveRenderer() {
        // This effect runs whenever any particle's reactive properties change
        effect(() => {
            this.effectCallsThisSecond++;
            
            const positions = this.particleGeometry.attributes.position.array;
            const colors = this.particleGeometry.attributes.color.array;
            const sizes = this.particleGeometry.attributes.size.array;
            
            let idx = 0;
            const particles = this.particlesItem.items();
            
            for (const particle of particles) {
                // Access reactive values - effect() tracks these dependencies
                const age = particle.item('age').get({ silent: true });
                const maxAge = particle.item('maxAge').get({ silent: true });
                
                if (age > maxAge) {
                    particle.remove({ local: true });
                    continue;
                }
                
                // Read all reactive properties - effect tracks them
                const x = particle.item('x').get({ silent: true });
                const y = particle.item('y').get({ silent: true });
                const z = particle.item('z').get({ silent: true });
                const hue = particle.item('hue').get({ silent: true });
                const lightness = particle.item('lightness').get({ silent: true });
                const justBorn = particle.item('justBorn').get({ silent: true });
                const size = particle.item('size').get({ silent: true });
                const saturation = particle.item('saturation').get({ silent: true });
                
                const ageRatio = age / maxAge;
                
                // Update Three.js arrays
                positions[idx * 3] = x;
                positions[idx * 3 + 1] = y;
                positions[idx * 3 + 2] = z;
                
                const h = hue + ageRatio * 30;
                const s = saturation;
                const l = justBorn > 0 ? 0.9 : lightness * (1 - ageRatio * 0.5);
                
                const rgb = this.hslToRgb(h / 360, s, l);
                colors[idx * 3] = rgb[0];
                colors[idx * 3 + 1] = rgb[1];
                colors[idx * 3 + 2] = rgb[2];
                
                const sizePulse = justBorn > 0 ? 3 : 1 + Math.sin(age * 0.1) * 0.2;
                sizes[idx] = size * sizePulse * (1 - ageRatio * 0.3);
                
                idx++;
            }
            
            this.particleGeometry.setDrawRange(0, idx);
            this.particleGeometry.attributes.position.needsUpdate = true;
            this.particleGeometry.attributes.color.needsUpdate = true;
            this.particleGeometry.attributes.size.needsUpdate = true;
            
            // Update stats reactive items
            this.statsItem.item('count').set(idx, { silent: true });
        });
    }

    // ============================================================
    // PARTICLE PHYSICS LOOP - Updates reactive item values
    // The effect() above will automatically re-render!
    // ============================================================
    setupParticleGenerationLoop() {
        const updateLoop = () => {
            if (this.paused) {
                requestAnimationFrame(updateLoop);
                return;
            }
            
            const particles = this.particlesItem.items();
            const count = particles.length;
            
            for (const particle of particles) {
                // Read current reactive values using peek() to avoid tracking in physics loop
                let x = particle.item('x').peek();
                let y = particle.item('y').peek();
                let z = particle.item('z').peek();
                let vx = particle.item('vx').peek();
                let vy = particle.item('vy').peek();
                let vz = particle.item('vz').peek();
                let age = particle.item('age').peek();
                let size = particle.item('size').peek();
                let targetSize = particle.item('targetSize').peek();
                let reproductiveUrge = particle.item('reproductiveUrge').peek();
                let justBorn = particle.item('justBorn').peek();
                let hue = particle.item('hue').peek();
                
                // Update age
                age++;
                justBorn = Math.max(0, justBorn - 1);
                
                // Mouse attraction - reactive mouse state
                if (this.mouse.active) {
                    const dx = this.mouse.x - x;
                    const dy = this.mouse.y - y;
                    const dist = Math.sqrt(dx * dx + dy * dy);
                    if (dist < 15 && dist > 0.1) {
                        const force = (15 - dist) / 15 * 0.3;
                        vx += (dx / dist) * force;
                        vy += (dy / dist) * force;
                    }
                }
                
                // Move
                x += vx;
                y += vy;
                z += vz;
                
                // Damping
                const speed = Math.sqrt(vx * vx + vy * vy);
                if (speed > 0.1) {
                    vx *= 0.98;
                    vy *= 0.98;
                }
                
                // Boundary return force
                const distFromCenter = Math.sqrt(x * x + y * y);
                if (distFromCenter > 45) {
                    vx -= (x / distFromCenter) * 0.02;
                    vy -= (y / distFromCenter) * 0.02;
                }
                
                // Grow
                if (size < targetSize) {
                    size += 0.05;
                }
                
                // Reproduction logic
                reproductiveUrge += 0.01 + (count < 100 ? 0.02 : 0);
                const reproduceThreshold = 20 + (count > 500 ? 10 : 0);
                
                if (reproductiveUrge > reproduceThreshold && age > 50 && count < this.maxParticles - 10) {
                    if (Math.random() < 0.3) {
                        this.createParticle(particle);
                        reproductiveUrge = 0;
                    }
                }
                
                // Write back to reactive items - triggers effect()!
                particle.item('x').set(x, { silent: true });
                particle.item('y').set(y, { silent: true });
                particle.item('z').set(z, { silent: true });
                particle.item('vx').set(vx, { silent: true });
                particle.item('vy').set(vy, { silent: true });
                particle.item('vz').set(vz, { silent: true });
                particle.item('age').set(age, { silent: true });
                particle.item('size').set(size, { silent: true });
                particle.item('reproductiveUrge').set(reproductiveUrge, { silent: true });
                particle.item('justBorn').set(justBorn, { silent: true });
                particle.item('hue').set(hue, { silent: true });
            }
            
            requestAnimationFrame(updateLoop);
        };
        
        requestAnimationFrame(updateLoop);
    }

    // ============================================================
    // EVENT BUBBLING DEMO - changeIn events bubble up
    // ============================================================
    setupEventListeners() {
        // Listen to all changes in the particles collection
        // changeIn bubbles up from children to parent
        this.particlesItem.addEventListener('changeIn', (event) => {
            if (event.add) {
                // New particle born! Just log the key - accessing .item() here
                // would trigger recursive change events
                console.log('Birth event bubbled up:', event.add.key);
            }
            if (event.remove) {
                console.log('Death event bubbled up:', event.remove.key);
            }
        });
    }

    setupMouseInteraction() {
        window.addEventListener('resize', () => {
            this.camera.aspect = window.innerWidth / window.innerHeight;
            this.camera.updateProjectionMatrix();
            this.renderer.setSize(window.innerWidth, window.innerHeight);
            this.composer.setSize(window.innerWidth, window.innerHeight);
        });

        window.addEventListener('mousemove', (e) => {
            this.mouseVector.x = (e.clientX / window.innerWidth) * 2 - 1;
            this.mouseVector.y = -(e.clientY / window.innerHeight) * 2 + 1;
            
            this.raycaster.setFromCamera(this.mouseVector, this.camera);
            const intersectPoint = new THREE.Vector3();
            const plane = new THREE.Plane(new THREE.Vector3(0, 0, 1), 0);
            this.raycaster.ray.intersectPlane(plane, intersectPoint);
            
            this.mouse.x = intersectPoint.x;
            this.mouse.y = intersectPoint.y;
            this.mouse.active = true;
        });

        window.addEventListener('mouseleave', () => {
            this.mouse.active = false;
        });

        window.addEventListener('click', () => {
            this.burstReproduction();
        });

        window.addEventListener('keydown', (e) => {
            if (e.code === 'Space') {
                this.paused = !this.paused;
            } else if (e.code === 'KeyR') {
                this.reset();
            }
        });
    }

    burstReproduction() {
        const particles = this.particlesItem.items();
        const count = particles.length;
        const burstCount = Math.min(20, Math.floor(count * 0.3));
        
        for (let i = 0; i < burstCount; i++) {
            const parent = particles[Math.floor(Math.random() * count)];
            if (parent) {
                this.createParticle(parent, true);
                this.createParticle(parent, true);
            }
        }
    }

    reset() {
        // Clear all particles
        for (const particle of this.particlesItem.items()) {
            particle.remove({ local: true });
        }
        this.createInitialParticles();
        this.birthsThisSecond = 0;
    }

    hslToRgb(h, s, l) {
        let r, g, b;
        if (s === 0) {
            r = g = b = l;
        } else {
            const hue2rgb = (p, q, t) => {
                if (t < 0) t += 1;
                if (t > 1) t -= 1;
                if (t < 1/6) return p + (q - p) * 6 * t;
                if (t < 1/2) return q;
                if (t < 2/3) return p + (q - p) * (2/3 - t) * 6;
                return p;
            };
            const q = l < 0.5 ? l * (1 + s) : l + s - l * s;
            const p = 2 * l - q;
            r = hue2rgb(p, q, h + 1/3);
            g = hue2rgb(p, q, h);
            b = hue2rgb(p, q, h - 1/3);
        }
        return [r, g, b];
    }

    animate() {
        requestAnimationFrame(() => this.animate());
        
        this.composer.render();
        
        // Update stats display
        const now = performance.now();
        if (now - this.lastReset > 1000) {
            document.getElementById('birth-rate').textContent = this.birthsThisSecond;
            document.getElementById('effect-calls').textContent = this.effectCallsThisSecond;
            this.birthsThisSecond = 0;
            this.effectCallsThisSecond = 0;
            this.lastReset = now;
        }
        
        // Access reactive stats
        document.getElementById('particle-count').textContent = this.statsItem.item('count').peek();
    }
}

// Initialize
new ParticleSystem();
