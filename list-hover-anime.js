import * as THREE from 'three';

const vertexShader = `
uniform vec2 uOffset;
varying vec2 vUv;

float M_PI = 3.141529;

vec3 deformationCurve(vec3 position, vec2 uv, vec2 offset){
    position.x += (sin(uv.y * M_PI) * offset.x);
    position.y += (sin(uv.x * M_PI) * offset.y);
    return position;
}

void main(){
    vUv = uv;
    vec3 newPosition = deformationCurve(position, uv, uOffset);
    gl_Position = projectionMatrix * modelViewMatrix * vec4(newPosition, 1.0);
}
`;

const fragmentShader = `
uniform sampler2D uTexture;
uniform sampler2D uPrevTexture;
uniform float uAlpha;
uniform float uMixFactor;  // controls crossfade
uniform vec2 uRGBOffset;
varying vec2 vUv;

void main(){
    // RGB split sampling
    vec2 rUV = vUv + uRGBOffset * 0.005;
    vec2 gUV = vUv;
    vec2 bUV = vUv - uRGBOffset * 0.005;

    vec3 newColor = vec3(
        texture2D(uTexture, rUV).r,
        texture2D(uTexture, gUV).g,
        texture2D(uTexture, bUV).b
    );

    vec3 prevColor = vec3(
        texture2D(uPrevTexture, rUV).r,
        texture2D(uPrevTexture, gUV).g,
        texture2D(uPrevTexture, bUV).b
    );

    // crossfade between previous and new texture
    vec3 finalColor = mix(prevColor, newColor, uMixFactor);

    gl_FragColor = vec4(finalColor, uAlpha);
}
`;

function lerp(start, end, t) {
    return start * (1.0 - t) + end * t;
}

let targetX = 0;
let targetY = 0;

class WebGL {
    constructor(wrapper) {
        this.container = wrapper;
        this.links = [...wrapper.querySelectorAll('[webgl-anime="list-item"]')];
        this.scene = new THREE.Scene();
        this.perspective = 1000;
        this.offset = new THREE.Vector2(0, 0);
        this.currentIndex = -1;
        this.transitioning = false;

        this.uniforms = {
            uTexture: { value: null },
            uPrevTexture: { value: null },
            uAlpha: { value: 0.0 },
            uOffset: { value: new THREE.Vector2(0.0, 0.0) },
            uMixFactor: { value: 1.0 },
            uRGBOffset: { value: new THREE.Vector2(0.0, 0.0) }
        };

        // Load textures
        this.textures = this.links.map(link => {
            const img = link.querySelector('[webgl-anime="image-src"]');
            if (!img) return null;
            const tex = new THREE.TextureLoader().load(img.src);
            tex.minFilter = THREE.LinearFilter;
            tex.generateMipmaps = false;
            return tex;
        });

        this.links.forEach((link, idx) => {
            link.addEventListener('mouseenter', () => this.showImage(idx, link));
            link.addEventListener('mouseleave', () => {
                this.uniforms.uAlpha.value = 0.0;
            });
        });

        this.addEventListeners();
        this.setUpCamera();
        this.onMouseMove();
        this.createMesh();
        this.render();
    }

    showImage(idx, link) {
        if (!this.textures[idx]) return;

        // set previous texture for crossfade
        this.uniforms.uPrevTexture.value = this.uniforms.uTexture.value;
        this.uniforms.uTexture.value = this.textures[idx];
        this.uniforms.uAlpha.value = 1.0;
        this.uniforms.uMixFactor.value = 0.0; // start transition

        this.currentIndex = idx;
        this.transitioning = true;

        // Scale mesh based on image aspect ratio
        const img = link.querySelector('[webgl-anime="image-src"]');
        if (img) {
            const aspect = img.naturalWidth / img.naturalHeight;
            const baseSize = 300;
            this.mesh.scale.set(baseSize * aspect, baseSize, 1);
        }
    }

    get viewport() {
        return {
            width: window.innerWidth,
            height: window.innerHeight,
            aspectRatio: window.innerWidth / window.innerHeight
        };
    }

    addEventListeners() {
        window.addEventListener('mouseenter', () => this.linkHovered = true);
        window.addEventListener('mouseleave', () => this.linkHovered = false);
    }

    setUpCamera() {
        window.addEventListener('resize', this.onWindowResize.bind(this));
        const fov = (180 * (2 * Math.atan(this.viewport.height / 2 / this.perspective))) / Math.PI;
        this.camera = new THREE.PerspectiveCamera(fov, this.viewport.aspectRatio, 0.1, 1000);
        this.camera.position.set(0, 0, this.perspective);

        this.renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
        this.renderer.setSize(this.viewport.width, this.viewport.height);
        this.renderer.setPixelRatio(window.devicePixelRatio);
        this.renderer.domElement.classList.add("list-webgl-canvas");
        this.renderer.domElement.style.position = 'sticky';
        this.renderer.domElement.style.top = 0;
        this.renderer.domElement.style.left = 0;
        this.container.appendChild(this.renderer.domElement);
    }

    createMesh() {
        this.geometry = new THREE.PlaneGeometry(1, 1, 20, 20);
        this.material = new THREE.ShaderMaterial({
            uniforms: this.uniforms,
            vertexShader,
            fragmentShader,
            transparent: true
        });
        this.mesh = new THREE.Mesh(this.geometry, this.material);
        this.scene.add(this.mesh);
    }

    onWindowResize() {
        this.camera.aspect = this.viewport.aspectRatio;
        this.camera.fov = (180 * (2 * Math.atan(this.viewport.height / 2 / this.perspective))) / Math.PI;
        this.renderer.setSize(this.viewport.width, this.viewport.height);
        this.camera.updateProjectionMatrix();
    }

    onMouseMove() {
        window.addEventListener('mousemove', (e) => {
            targetX = e.clientX;
            targetY = e.clientY;
        });
    }

    render() {
        this.offset.x = lerp(this.offset.x, targetX, 0.1);
        this.offset.y = lerp(this.offset.y, targetY, 0.1);

        this.uniforms.uOffset.value.set(
            (targetX - this.offset.x) * 0.0005,
            -(targetY - this.offset.y) * 0.0005
        );

        // RGB split subtle movement
        this.uniforms.uRGBOffset.value.set(
            Math.sin(Date.now() * 0.002) * 0.5,
            Math.cos(Date.now() * 0.002) * 0.5
        );

        // Smooth crossfade transition
        if (this.transitioning && this.uniforms.uMixFactor.value < 1.0) {
            this.uniforms.uMixFactor.value += 0.05; // speed of transition
            if (this.uniforms.uMixFactor.value >= 1.0) {
                this.transitioning = false;
                this.uniforms.uPrevTexture.value = null;
            }
        }

        // Position so image follows mouse naturally
        this.mesh.position.set(
            this.offset.x - (this.viewport.width / 2) + this.mesh.scale.x / 2,
            (this.viewport.height / 2) - this.offset.y - this.mesh.scale.y / 2,
            0
        );

        this.renderer.render(this.scene, this.camera);
        requestAnimationFrame(this.render.bind(this));
    }
}

// multiple wrappers support
document.addEventListener("DOMContentLoaded", () => {
    const wrappers = document.querySelectorAll('[webgl-anime="list-hover-wrapper"]');
    wrappers.forEach(wrapper => new WebGL(wrapper));
});
