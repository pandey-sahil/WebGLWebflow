<script type="module">
import * as THREE from "three";
import { EffectComposer } from "three/addons/postprocessing/EffectComposer.js";
import { RenderPass } from "three/addons/postprocessing/RenderPass.js";
import { ShaderPass } from "three/addons/postprocessing/ShaderPass.js";
import { RGBShiftShader } from "three/addons/shaders/RGBShiftShader.js";

// Each item gets its own effect instance
class RGBShiftEffect {
  constructor(wrapper, img, { strength = 0.003 } = {}) {
    this.wrapper = wrapper;
    this.img = img;

    // create canvas inside wrapper
    this.canvas = document.createElement("canvas");
    this.canvas.classList.add("portfolio20-canvas");
    this.wrapper.appendChild(this.canvas);

    // hide the native img
    this.img.style.display = "none";

    // setup renderer, scene, camera
    this.renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, canvas: this.canvas });
    this.renderer.setSize(this.wrapper.clientWidth, this.wrapper.clientHeight);
    this.renderer.setPixelRatio(window.devicePixelRatio);

    this.scene = new THREE.Scene();
    this.camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);

    // load texture from <img>
    const tex = new THREE.TextureLoader().load(this.img.src);
    const geometry = new THREE.PlaneGeometry(2, 2);
    const material = new THREE.MeshBasicMaterial({ map: tex });
    this.scene.add(new THREE.Mesh(geometry, material));

    // composer
    this.composer = new EffectComposer(this.renderer);
    this.composer.addPass(new RenderPass(this.scene, this.camera));

    const rgbPass = new ShaderPass(RGBShiftShader);
    rgbPass.uniforms["amount"].value = strength;
    this.composer.addPass(rgbPass);

    // start loop
    this.animate();
  }

  animate() {
    requestAnimationFrame(() => this.animate());
    this.composer.render();
  }
}

// Init for all items
document.addEventListener("DOMContentLoaded", () => {
  document.querySelectorAll(".portfolio20_item-link").forEach(item => {
    const img = item.querySelector(".portfolio20_image");
    if (img) {
      new RGBShiftEffect(item, img, { strength: 0.003 });
    }
  });
});
</script>
