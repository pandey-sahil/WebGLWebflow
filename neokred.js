import * as THREE from "three";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";
import gsap from "gsap";
import ScrollTrigger from "gsap/ScrollTrigger";

gsap.registerPlugin(ScrollTrigger);

let scene, camera, renderer, pivot;

// Save rotation states
let savedRotationSection1 = 0;
let savedRotationSection2 = 0;
let savedRotationSection3 = 0;

function init() {
  scene = new THREE.Scene();

  camera = new THREE.PerspectiveCamera(
    75,
    window.innerWidth / window.innerHeight,
    0.1,
    1000
  );

  // ✅ Centered camera
  camera.position.set(0, -0.15, 2.5);
  camera.lookAt(0, -0.15, 0);

  renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
  renderer.setSize(window.innerWidth, window.innerHeight);
  document.body.appendChild(renderer.domElement);

  const loader = new GLTFLoader();
  loader.load(
    "model.gltf",
    (gltf) => {
      pivot = new THREE.Object3D();
      scene.add(pivot);

      pivot.add(gltf.scene);
      gltf.scene.position.set(0, -0.25, 0);
      gltf.scene.scale.set(1.2, 1.2, 1.2);

      // === SECTION 1 ===
      ScrollTrigger.create({
        trigger: "#section1",
        start: "top center",
        end: "bottom center",
        onEnter: () => {
          savedRotationSection1 = pivot.rotation.y;
          console.log("Saved rotation Section 1:", savedRotationSection1);

          gsap.to(pivot.rotation, {
            y: -Math.PI / 6, // -30°
            duration: 1.5,
            ease: "power2.out"
          });
        },
        onLeaveBack: () => {
          console.log("Leaving Section 1 → restore initial rotation");
          gsap.to(pivot.rotation, {
            y: savedRotationSection1,
            duration: 0.5,
            ease: "power2.out"
          });
        }
      });

      // === SECTION 2 ===
      ScrollTrigger.create({
        trigger: "#section2",
        start: "top center",
        end: "bottom center",
        onEnter: () => {
          savedRotationSection2 = pivot.rotation.y;
          console.log("Saved rotation Section 2:", savedRotationSection2);

          gsap.to(pivot.rotation, {
            y: Math.PI / 6, // +30°
            duration: 1.5,
            ease: "power2.out"
          });
        },
        onLeave: () => {
          console.log("Leaving Section 2 → restore Section 2 rotation");
          gsap.killTweensOf(pivot.rotation);
          gsap.to(pivot.rotation, {
            y: savedRotationSection2,
            duration: 0.5,
            ease: "power2.out"
          });
        },
        onLeaveBack: () => {
          console.log("Scrolling back from Section 2 → restore Section 1 rotation");
          gsap.killTweensOf(pivot.rotation);
          gsap.to(pivot.rotation, {
            y: savedRotationSection1,
            duration: 0.5,
            ease: "power2.out"
          });
        }
      });

      // === SECTION 3 (Infinite Spin) ===
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
        onLeaveBack: () => {
          console.log("Scrolling back from Section 3 → restore Section 2 rotation");
          gsap.killTweensOf(pivot.rotation);
          gsap.to(pivot.rotation, {
            y: savedRotationSection2,
            duration: 0.5,
            ease: "power2.out"
          });
        }
        // ⚠️ No onLeave → spin continues when scrolling down
      });

      animate();
    },
    undefined,
    (err) => console.error("GLTF load error", err)
  );
}

function animate() {
  requestAnimationFrame(animate);
  renderer.render(scene, camera);
}

init();
