import * as THREE from "three";

/* =====================================================
   GLOBAL WEBGL MANAGER (SINGLE RENDERER)
===================================================== */
window.WebGLEffects = (() => {
  let renderer, scene, camera;
  let currentTab = "Tab 1";
  let raf = null;
  let activeEffects = [];
  let needsRender = false;

  const DPR = Math.min(window.devicePixelRatio || 1, 1.5);

  function init() {
    renderer = new THREE.WebGLRenderer({
      alpha: true,
      antialias: true,
      powerPreference: "high-performance"
    });

    renderer.setPixelRatio(DPR);
    renderer.setSize(window.innerWidth, window.innerHeight);
    renderer.domElement.style.position = "fixed";
    renderer.domElement.style.inset = "0";
    renderer.domElement.style.pointerEvents = "none";
    renderer.domElement.style.zIndex = "1";
    document.body.appendChild(renderer.domElement);

    scene = new THREE.Scene();

    camera = new THREE.PerspectiveCamera(
      45,
      window.innerWidth / window.innerHeight,
      0.1,
      1000
    );
    camera.position.z = 600;

    window.addEventListener("resize", onResize);
    document.addEventListener("visibilitychange", onVisibility);
    initTabListener();
  }

  function onResize() {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
    requestRender();
  }

  function onVisibility() {
    if (document.hidden) stop();
    else requestRender();
  }

  function animate(time) {
    raf = requestAnimationFrame(animate);
    activeEffects.forEach(e => e.update?.(time));
    renderer.render(scene, camera);
    needsRender = false;
  }

  function requestRender() {
    if (!raf) animate();
    needsRender = true;
  }

  function stop() {
    cancelAnimationFrame(raf);
    raf = null;
  }

  function clearEffects() {
    activeEffects.forEach(e => e.dispose?.());
    activeEffects.length = 0;
    scene.clear();
    stop();
  }

  function initTab(tab) {
    clearEffects();
    currentTab = tab;

    if (tab === "Tab 1") {
      activeEffects.push(initBulgeGrid(scene));
    }

    if (tab === "Tab 2") {
      activeEffects.push(initHoverList(scene));
    }

    requestRender();
  }

  function initTabListener() {
    document.addEventListener("click", e => {
      const tab = e.target.closest("[data-w-tab]");
      if (!tab) return;
      const name = tab.getAttribute("data-w-tab");
      if (name !== currentTab) initTab(name);
    });

    const active = document.querySelector(".w-tab-link.w--current");
    if (active) initTab(active.getAttribute("data-w-tab"));
  }

  init();

  return {
    requestRender,
    scene,
    camera
  };
})();

/* =====================================================
   SHARED HELPERS
===================================================== */
function loadTexture(src) {
  return new Promise(resolve => {
    new THREE.TextureLoader().load(src, tex => {
      tex.minFilter = THREE.LinearFilter;
      tex.generateMipmaps = false;
      resolve(tex);
    });
  });
}

/* =====================================================
   TAB 2 — HOVER LIST EFFECT (LAZY)
===================================================== */
function initHoverList(scene) {
  const wrapper =
    document.querySelector('[data-w-tab="Tab 2"]') ||
    document.querySelector("#tab-list-pane");

  if (!wrapper) return;

  const geometry = new THREE.PlaneGeometry(1, 1, 20, 20);
  const uniforms = {
    uTex: { value: null },
    uAlpha: { value: 0 },
    uOffset: { value: new THREE.Vector2() }
  };

  const material = new THREE.ShaderMaterial({
    transparent: true,
    uniforms,
    vertexShader: `
      varying vec2 vUv;
      uniform vec2 uOffset;
      void main(){
        vUv = uv;
        vec3 p = position;
        p.xy += uOffset * 30.0;
        gl_Position = projectionMatrix * modelViewMatrix * vec4(p,1.);
      }
    `,
    fragmentShader: `
      varying vec2 vUv;
      uniform sampler2D uTex;
      uniform float uAlpha;
      void main(){
        vec4 c = texture2D(uTex, vUv);
        gl_FragColor = vec4(c.rgb, c.a * uAlpha);
      }
    `
  });

  const mesh = new THREE.Mesh(geometry, material);
  scene.add(mesh);

  let target = new THREE.Vector2();
  let pos = new THREE.Vector2();
  let active = false;

  wrapper.querySelectorAll("[webgl-anime='list-item']").forEach(link => {
    const img = link.querySelector("img");
    let texture;

    link.addEventListener("mouseenter", async e => {
      if (!texture) texture = await loadTexture(img.src);
      uniforms.uTex.value = texture;
      uniforms.uAlpha.value = 1;
      const r = wrapper.getBoundingClientRect();
      mesh.scale.set(img.naturalWidth, img.naturalHeight, 1);
      target.set(e.clientX - r.left, r.height - (e.clientY - r.top));
      active = true;
      window.WebGLEffects.requestRender();
    });

    link.addEventListener("mouseleave", () => {
      uniforms.uAlpha.value = 0;
      active = false;
    });
  });

  wrapper.addEventListener("mousemove", e => {
    if (!active) return;
    const r = wrapper.getBoundingClientRect();
    target.set(e.clientX - r.left, r.height - (e.clientY - r.top));
  });

  return {
    update() {
      pos.lerp(target, 0.1);
      mesh.position.set(pos.x - window.innerWidth / 2, pos.y - window.innerHeight / 2, 0);
      uniforms.uOffset.value.lerp(
        new THREE.Vector2(
          (target.x - pos.x) * 0.001,
          (target.y - pos.y) * 0.001
        ),
        0.1
      );
    },
    dispose() {
      geometry.dispose();
      material.dispose();
    }
  };
}

/* =====================================================
   TAB 1 — GRID BULGE EFFECT (SINGLE SCENE)
===================================================== */
function initBulgeGrid(scene) {
  const cards = document.querySelectorAll(
    '[data-w-tab="Tab 1"] [webgl-anime="image-hover"]'
  );

  const group = new THREE.Group();
  scene.add(group);

  cards.forEach(async card => {
    const img = card.querySelector("img");
    if (!img) return;

    const tex = await loadTexture(img.src);
    img.style.opacity = "0";

    const geo = new THREE.PlaneGeometry(
      card.offsetWidth,
      card.offsetHeight,
      1,
      1
    );

    const mat = new THREE.ShaderMaterial({
      uniforms: {
        uTex: { value: tex },
        uMouse: { value: new THREE.Vector2(0.5, 0.5) },
        uHover: { value: 0 }
      },
      vertexShader: `
        varying vec2 vUv;
        void main(){ vUv = uv;
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.);}
      `,
      fragmentShader: `
        varying vec2 vUv;
        uniform sampler2D uTex;
        uniform vec2 uMouse;
        uniform float uHover;
        void main(){
          vec2 d = vUv - uMouse;
          vec2 uv = vUv - d * uHover * 0.25;
          gl_FragColor = texture2D(uTex, uv);
        }
      `
    });

    const mesh = new THREE.Mesh(geo, mat);
    group.add(mesh);

    const r = card.getBoundingClientRect();
    mesh.position.set(
      r.left + r.width / 2 - window.innerWidth / 2,
      window.innerHeight / 2 - (r.top + r.height / 2),
      0
    );

    card.addEventListener("mousemove", e => {
      const b = card.getBoundingClientRect();
      mat.uniforms.uMouse.value.set(
        (e.clientX - b.left) / b.width,
        1 - (e.clientY - b.top) / b.height
      );
      mat.uniforms.uHover.value = 1;
      window.WebGLEffects.requestRender();
    });

    card.addEventListener("mouseleave", () => {
      mat.uniforms.uHover.value = 0;
    });
  });

  return {
    update() {},
    dispose() {
      scene.remove(group);
    }
  };
}
