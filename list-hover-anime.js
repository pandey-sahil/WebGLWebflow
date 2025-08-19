import * as THREE from "three";

class WebGLDistortion {
  constructor() {
    this.container = document.querySelector("[data-webgl-container]");
    this.canvas = this.container?.querySelector(".g_canvas_distortion");
    this.images = document.querySelectorAll("[distorted-image]");

    if (!this.container || !this.canvas || !this.images.length) return;

    this.scene = new THREE.Scene();
    this.camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 10);
    this.camera.position.z = 1;

    this.renderer = new THREE.WebGLRenderer({
      canvas: this.canvas,
      alpha: true,
      antialias: true,
    });
    this.renderer.setSize(window.innerWidth, window.innerHeight);
    this.renderer.setPixelRatio(window.devicePixelRatio);

    this.viewport = {
      width: window.innerWidth,
      height: window.innerHeight,
      aspectRatio: window.innerWidth / window.innerHeight,
    };

    this.mouse = new THREE.Vector2(0, 0);
    this.targetSize = { width: 288, height: 250 };

    this.items = [];
    this.textures = [];
    this.currentItem = null;

    this.clock = new THREE.Clock();
    this.uniforms = {
      uTime: { value: 0 },
      uTexture: { value: null },
    };

    this.init();
  }

  init() {
    this.loadTextures();
    this.createPlane();
    this.addEventListeners();
    this.animate();
  }

  loadTextures() {
    const loader = new THREE.TextureLoader();
    this.images.forEach((img, index) => {
      const texture = loader.load(img.src);
      texture.minFilter = THREE.LinearFilter;
      texture.magFilter = THREE.LinearFilter;
      this.items.push({ img, texture });
    });
  }

  createPlane() {
    const geometry = new THREE.PlaneGeometry(2, 2, 1, 1);
    const material = new THREE.ShaderMaterial({
      uniforms: this.uniforms,
      vertexShader: `
        varying vec2 vUv;
        void main() {
          vUv = uv;
          gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
        }
      `,
      fragmentShader: `
        varying vec2 vUv;
        uniform sampler2D uTexture;
        void main() {
          vec4 color = texture2D(uTexture, vUv);
          gl_FragColor = color;
        }
      `,
      transparent: true,
    });

    this.plane = new THREE.Mesh(geometry, material);
    this.scene.add(this.plane);

    // force fixed pixel size
    this.updatePlaneSize();
  }

  updatePlaneSize() {
    const { width, height } = this.targetSize;
    const worldHeight =
      2 * Math.tan((this.camera.fov * Math.PI) / 360) *
      Math.abs(this.camera.position.z);
    const worldWidth = worldHeight * this.viewport.aspectRatio;

    // Convert px → world units
    const planeScaleX = (width / this.viewport.width) * worldWidth;
    const planeScaleY = (height / this.viewport.height) * worldHeight;

    this.plane.scale.set(planeScaleX, planeScaleY, 1);
  }

  addEventListeners() {
    window.addEventListener("mousemove", (e) => {
      // map px → world coords
      this.mouse.x = (e.clientX / this.viewport.width) * 2 - 1;
      this.mouse.y = -(e.clientY / this.viewport.height) * 2 + 1;

      const worldX = (e.clientX / this.viewport.width) * 2 - 1;
      const worldY = -(e.clientY / this.viewport.height) * 2 + 1;

      this.plane.position.set(worldX, worldY, 0);
    });

    window.addEventListener("resize", () => {
      this.viewport.width = window.innerWidth;
      this.viewport.height = window.innerHeight;
      this.viewport.aspectRatio =
        this.viewport.width / this.viewport.height;

      this.renderer.setSize(this.viewport.width, this.viewport.height);
      this.updatePlaneSize();
    });
  }

  onTargetChange(index) {
    this.currentItem = this.items[index];
    if (!this.currentItem.texture) return;
    this.uniforms.uTexture.value = this.currentItem.texture;
  }

  animate() {
    requestAnimationFrame(() => this.animate());
    this.uniforms.uTime.value = this.clock.getElapsedTime();
    this.renderer.render(this.scene, this.camera);
  }
}

document.addEventListener("DOMContentLoaded", () => {
  const distortion = new WebGLDistortion();
});
