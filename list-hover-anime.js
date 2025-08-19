import * as THREE from 'three';
const vertexShader = `
uniform vec2 uOffset;
varying vec2 vUv;

float M_PI = 3.141529;

vec3 deformationCurve(vec3 position, vec2 uv, vec2 offset){
    position.x = position.x + (sin(uv.y * M_PI) * offset.x);
    position.y = position.y + (sin(uv.x * M_PI) * offset.y);
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
uniform float uAlpha;
varying vec2 vUv;

void main(){
    vec3 color = texture2D(uTexture, vUv).rgb;
    gl_FragColor = vec4(color, uAlpha);
}
`;

function lerp(start, end, t){
    return start * ( 1 - t ) + end * t;
}

let targetX = 0;
let targetY = 0;

class WebGL {
    constructor() {
        this.container = document.body; 
        this.links = [...document.querySelectorAll('[webgl-anime="list-hover"]')]; // ✅ lower case
        this.scene = new THREE.Scene();
        this.perspective = 1000;
        this.sizes = new THREE.Vector2(0, 0);
        this.offset = new THREE.Vector2(0, 0);
        this.uniforms = {
            uTexture: { value: null },
            uAlpha: { value: 0.0 },
            uOffset: { value: new THREE.Vector2(0.0, 0.0) }
        };

        // Load textures from images inside each list-hover
        this.textures = this.links.map(link => {
            const img = link.querySelector('[webgl-anime="list-hover-image"]'); // ✅ lower case
            return new THREE.TextureLoader().load(img.src);
        });

        this.links.forEach((link, idx) => {
            link.addEventListener('mouseenter', () => {
                this.uniforms.uTexture.value = this.textures[idx];
                this.uniforms.uAlpha.value = 1.0;
            });

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

    get viewport() {
        let width = window.innerWidth;
        let height = window.innerHeight;
        let aspectRatio = width / height;
        return { width, height, aspectRatio };
    }

    addEventListeners() {
        window.addEventListener('mouseenter', () => {
            this.linkHovered = true;
        });
        window.addEventListener('mouseleave', () => {
            this.linkHovered = false;
        });
    }

    setUpCamera() {
        window.addEventListener('resize', this.onWindowResize.bind(this));

        let fov = (180 * (2 * Math.atan(this.viewport.height / 2 / this.perspective))) / Math.PI;
        this.camera = new THREE.PerspectiveCamera(fov, this.viewport.aspectRatio, 0.1, 1000);
        this.camera.position.set(0, 0, this.perspective);

        this.renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
        this.renderer.setSize(this.viewport.width, this.viewport.height);
        this.renderer.setPixelRatio(window.devicePixelRatio);
        this.renderer.domElement.style.position = 'fixed';
        this.renderer.domElement.style.top = '0';
        this.renderer.domElement.style.left = '0';
        this.container.appendChild(this.renderer.domElement);
    }

    createMesh() {
        this.geometry = new THREE.PlaneGeometry(1, 1, 20, 20);
        this.material = new THREE.ShaderMaterial({
            uniforms: this.uniforms,
            vertexShader: vertexShader,
            fragmentShader: fragmentShader,
            transparent: true
        });
        this.mesh = new THREE.Mesh(this.geometry, this.material);
        this.sizes.set(250, 350, 1);
        this.mesh.scale.set(this.sizes.x, this.sizes.y, 1);
        this.mesh.position.set(this.offset.x, this.offset.y, 0);
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
        this.uniforms.uOffset.value.set((targetX - this.offset.x) * 0.0005, -(targetY - this.offset.y) * 0.0005);
        this.mesh.position.set(this.offset.x - (this.viewport.width / 2), (this.viewport.height / 2) - this.offset.y, 0);

        this.links.forEach(link => {
            link.style.opacity = this.linkHovered ? 0.2 : 1;
        });

        this.renderer.render(this.scene, this.camera);
        window.requestAnimationFrame(this.render.bind(this));
    }
}

new WebGL();

