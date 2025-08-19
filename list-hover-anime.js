
import * as THREE from "three";
import { EffectComposer } from "three/addons/postprocessing/EffectComposer.js";
import { RenderPass } from "three/addons/postprocessing/RenderPass.js";
import { ShaderPass } from "three/addons/postprocessing/ShaderPass.js";
import { RGBShiftShader } from "three/addons/shaders/RGBShiftShader.js";

class RGBShiftEffect {
  constructor(container, itemsWrapper, { strength = 0.002 } = {}) {
    this.container = container;
    this.itemsWrapper = itemsWrapper;

    // setup renderer, scene, camera
    this.renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    this.renderer.setSize(window.innerWidth, window.innerHeight);
    this.container.appendChild(this.renderer.domElement);

    this.scene = new THREE.Scene();
    this.camera = new THREE.PerspectiveCamera(
      45,
      window.innerWidth / window.innerHeight,
      0.1,
      100
    );
    this.camera.position.z = 2;

    // composer
    this.composer = new EffectComposer(this.renderer);
    this.composer.addPass(new RenderPass(this.scene, this.camera));

    const rgbPass = new ShaderPass(RGBShiftShader);
    rgbPass.uniforms["amount"].value = strength;
    this.composer.addPass(rgbPass);

    this.animate();
  }

  animate() {
    requestAnimationFrame(() => this.animate());
    this.composer.render();
  }
}

// Example usage
const wrapper = document.querySelector(".portfolio20_list");
new RGBShiftEffect(wrapper, wrapper, { strength: 0.003 });
