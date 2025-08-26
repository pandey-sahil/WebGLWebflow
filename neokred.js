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

// Ambient light
const ambientLight = new THREE.AmbientLight(0xffffff, 1.5);
scene.add(ambientLight);

// Direct light
const directLight = new THREE.DirectionalLight(0xffffff, 1.5);
directLight.position.set(2, 5, 10);
scene.add(directLight);
scene.add(directLight.target);

// Pivot group
const pivot = new THREE.Group();
scene.add(pivot);

// Loader
const loader = new GLTFLoader();
let model;

// Saved states
let savedRotationSection1 = 0;
let savedRotationSection2 = 0;
let savedRotationSection3 = 0;

loader.load(
  "https://web-gl-webflow.vercel.app/qr-machine.glb",
  (gltf) => {
    model = gltf.scene;
    pivot.add(model);

    // Center model
    const box = new THREE.Box3().setFromObject(model);
    const center = box.getCenter(new THREE.Vector3());
    model.position.sub(center);

    // ✅ Reset rotation so it's perfectly front-facing
    model.rotation.set(0, 1, 0);

    // Material cleanup
    model.traverse((child) => {
      if (child.isMesh && child.material) {
        if (
          child.material.isMeshStandardMaterial ||
          child.material.isMeshPhysicalMaterial
        ) {
          child.material.metalness = 0.01;
          child.material.roughness = 0.1;
        }
      }
    });

    // ✅ Initial camera (dead center, no tilt)
    camera.position.set(0, -0.15, 2.7);
    camera.lookAt(0, -0.15, 0);

    // -----------------
    // GSAP + ScrollTrigger
    // -----------------
    gsap.registerPlugin(ScrollTrigger);

    // Section 1 → Camera move
    ScrollTrigger.create({
      trigger: "#section1",
      start: "top center",
      end: "bottom center",
      scrub: true,
      onEnter: () => {
        savedRotationSection1 = pivot.rotation.y;
        console.log("Saved rotation Section 1:", savedRotationSection1);
        gsap.to(camera.position, {
          x: 1,
          y: 1,
          z: 2.7,
          onUpdate: () => camera.lookAt(0, 0, 0),
          overwrite: "auto"
        });
      },
      onLeaveBack: () => {
        console.log("Returning to initial (before Section 1)");
        gsap.to(camera.position, {
          x: 0,
          y: 0,
          z: 2.5,
          onUpdate: () => camera.lookAt(0, 0, 0),
          overwrite: "auto"
        });
      }
    });

    // Section 2 → Pivot shift + rotation
    ScrollTrigger.create({
      trigger: "#section2",
      start: "top center",
      end: "bottom center",
      scrub: true,
      onEnter: () => {
        console.log("Entering Section 2");
        gsap.to(pivot.position, {
          y: -0.01,
          overwrite: "auto"
        });
        gsap.to(pivot.rotation, {
          y: THREE.MathUtils.degToRad(-30),
          ease: "linear",
          overwrite: "auto",
          onComplete: () => {
            savedRotationSection2 = pivot.rotation.y;
            console.log(
              "✅ Saved rotation Section 2 (after tween):",
              savedRotationSection2
            );
          }
        });
      },
      onLeave: () => {
        console.log("Leaving Section 2 → restore Section 2 rotation", savedRotationSection2);
        gsap.killTweensOf(pivot.rotation);
        gsap.to(pivot.rotation, {
          y: savedRotationSection2,
          duration: 0.5,
          ease: "power2.out"
        });
      },
      onLeaveBack: () => {
        console.log("Scrolling back from Section 2 → restore Section 1 rotation", savedRotationSection1);
        gsap.killTweensOf(pivot.rotation);
        gsap.to(pivot.rotation, {
          y: savedRotationSection1,
          duration: 0.5,
          ease: "power2.out"
        });
      }
    });

    // Section 3 → Infinite spin
    ScrollTrigger.create({
      trigger: "#section3",
      start: "top center",
      end: "bottom center",
      onEnter: () => {
        savedRotationSection3 = pivot.rotation.y;
        console.log("Saved rotation Section 3:", savedRotationSection3);

        gsap.to(pivot.position, { y: -0.08, duration: 1 });

        gsap.to(pivot.rotation, {
          y: "-=6.283", // full spin
          duration: 15,
          ease: "linear",
          repeat: -1
        });
      },
      // 👇 Only stop spin when scrolling back up
      onLeaveBack: () => {
        console.log("Scrolling back from Section 3 → restore Section 2 rotation");
        gsap.killTweensOf(pivot.rotation);
        gsap.to(pivot.rotation, {
          y: savedRotationSection2,
          duration: 0.5,
          ease: "power2.out"
        });
      }
    });
  } // closes (gltf) => { ... }
);   // closes loader.load(...)

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
