import * as THREE from "three";
import { GLTFLoader } from "three/addons/loaders/GLTFLoader.js";

// Scene
const scene = new THREE.Scene();

// Camera
const camera = new THREE.PerspectiveCamera(30, 1, 0.1, 100);

// Renderer
const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
document.getElementById("three-container").appendChild(renderer.domElement);

// Ambient light (soft base illumination)
const ambientLight = new THREE.AmbientLight(0xffffff, 1.5);
scene.add(ambientLight);

// Direct light (acts like sunlight / main directional light)
const directLight = new THREE.DirectionalLight(0xffffff, 1.5);
directLight.position.set(2, 5, 10); // 👈 pick a diagonal angle
scene.add(directLight);
scene.add(directLight.target);

// Pivot group
const pivot = new THREE.Group();
scene.add(pivot);

// Loader
const loader = new GLTFLoader();
let model, spinTween;
loader.load(
  "https://web-gl-webflow.vercel.app/qr-machine.glb",
  (gltf) => {
    model = gltf.scene;
    pivot.add(model);

    // Center model
    const box = new THREE.Box3().setFromObject(model);
    const center = box.getCenter(new THREE.Vector3());
    model.position.sub(center);

    // Enable shadows
    model.traverse((child) => {
      if (child.isMesh && child.material) {
        if (
          child.material.isMeshStandardMaterial ||
          child.material.isMeshPhysicalMaterial
        ) {
          child.material.metalness = 0.01; // no metallic shine
          child.material.roughness = 0.1; // fully matte
        }
      }
    });

    // Initial camera
    camera.position.set(-0.5, -0.15, 2.5);
    camera.lookAt(0, -0.15, 0);

    // GSAP + ScrollTrigger
    gsap.registerPlugin(ScrollTrigger);

    // Section 1 → move camera slightly
    gsap.to(camera.position, {
      scrollTrigger: {
        trigger: "#section1",
        start: "top center",
        end: "bottom center",
        scrub: true,
      },
      x: 1,
      y: 1,
      z: 2.7,
      onUpdate: () => camera.lookAt(0, -0.15, 0),
    });

    // Section 2 → shift model down
    gsap.to(pivot.position, {
      scrollTrigger: {
        trigger: "#section2",
        start: "top center",
        end: "bottom center",
        // scrub: true,
      },
      y: -0.01,
      onUpdate: () => camera.lookAt(0, -0.15, 0),
    });

    //Section2 rotation
    gsap.to(pivot.rotation, {
      scrollTrigger: {
        trigger: "#section2",
        start: "top center",
        end: "bottom center",
        scrub: true,
      },
      y: THREE.MathUtils.degToRad(-30), // 60° rotation
      ease: "linear",
    });

    let savedRotationY;

    ScrollTrigger.create({
      trigger: "#section3",
      start: "top center",
      end: "bottom center",
      markers: true,
      onEnter: () => {
        savedRotationY = pivot.rotation.y; // position save
        gsap.to(pivot.position, { y: -0.08, duration: 1 });
        gsap.to(pivot.rotation, {
          y: "-=6.283",
          duration: 15,
          ease: "linear",
          repeat: -1,
        });
      },
      onLeave: () => {
        gsap.killTweensOf(pivot.rotation);
        // Smooth transition back to saved position
        gsap.to(pivot.rotation, {
          y: savedRotationY,
          duration: 0.5,
          ease: "power2.out",
        });
      },
      onLeaveBack: () => {
        gsap.killTweensOf(pivot.rotation);
        gsap.to(pivot.rotation, {
          y: savedRotationY,
          duration: 0.5,
          ease: "power2.out",
        });
      },
    });
  },
  undefined,
  (err) => console.error("GLTF load error", err)
);

// Animate
function animate() {
  requestAnimationFrame(animate);
  renderer.render(scene, camera);
}
animate();

// Responsive resize
function resizeRenderer() {
  const wrap = document.querySelector(".wrap");
  const width = wrap.clientWidth;
  const height = wrap.clientHeight;

  camera.aspect = width / height;
  camera.updateProjectionMatrix();
  renderer.setSize(width, height);
}

window.addEventListener("resize", resizeRenderer);
resizeRenderer();
