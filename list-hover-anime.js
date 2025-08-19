
import * as THREE from "three";
import { EffectComposer } from "three/addons/postprocessing/EffectComposer.js";
import { RenderPass } from "three/addons/postprocessing/RenderPass.js";
import { ShaderPass } from "three/addons/postprocessing/ShaderPass.js";
import { RGBShiftShader } from "three/addons/shaders/RGBShiftShader.js";

class RGBShiftEffect {
  constructor(wrapper, img, { strength = 0.003 } = {}) {
    this.wrapper = wrapper;
    this.img = img;

    const canvas = document.createElement("canvas");
    canvas.classList.add("portfolio20-canvas");
    this.wrapper.appendChild(canvas);
    this.img.style.display = "none";

    this.renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, canvas });
    this.renderer.setSize(this.wrapper.clientWidth, this.wrapper.clientHeight);
    this.renderer.setPixelRatio(window.devicePixelRatio);

    this.scene = new THREE.Scene();
    this.camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);

    const tex = new THREE.TextureLoader().load(this.img.src);
    const geometry = new THREE.PlaneGeometry(2, 2);
    const material = new THREE.MeshBasicMaterial({ map: tex });
    this.scene.add(new THREE.Mesh(geometry, material));

    this.composer = new EffectComposer(this.renderer);
    this.composer.addPass(new RenderPass(this.scene, this.camera));

    this.rgbPass = new ShaderPass(RGBShiftShader);
    this.rgbPass.uniforms["amount"].value = strength;
    this.rgbPass.uniforms["angle"].value = 0.0;
    this.composer.addPass(this.rgbPass);

    this.mouse = new THREE.Vector2(0, 0);
    this.addMouseListeners();

    this.animate();
  }

  addMouseListeners() {
    this.wrapper.addEventListener("mousemove", e => {
      const rect = this.wrapper.getBoundingClientRect();
      const x = (e.clientX - rect.left) / rect.width - 0.5;
      const y = (e.clientY - rect.top) / rect.height - 0.5;
      this.mouse.set(x, y);

      // map mouse X/Y to shader values
      this.rgbPass.uniforms["angle"].value = Math.atan2(y, x);
      this.rgbPass.uniforms["amount"].value = 0.002 + Math.sqrt(x * x + y * y) * 0.02;
    });

    this.wrapper.addEventListener("mouseleave", () => {
      // reset on mouse leave
      this.rgbPass.uniforms["amount"].value = 0.0;
    });
  }

  animate() {
    requestAnimationFrame(() => this.animate());
    this.composer.render();
  }
}

document.querySelectorAll(".portfolio20_item-link").forEach(item => {
  const img = item.querySelector(".portfolio20_image");
  if (img) new RGBShiftEffect(item, img, { strength: 0.0 });
});
