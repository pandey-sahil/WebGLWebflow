import * as THREE from 'three';

// Requires GSAP on the page (global `gsap`)

class EffectShell {
  constructor(container = document.body, itemsWrapper = null) {
    this.container = container;
    this.itemsWrapper = itemsWrapper;
    if (!this.container || !this.itemsWrapper) return;

    // target plane size in CSS pixels
    this.targetSize = { w: 288, h: 250 };

    this.setup();
    this.initEffectShell().then(() => {
      this.isLoaded = true;
      if (this.isMouseOver) this.onMouseOver(this.tempItemIndex);
      this.tempItemIndex = null;
    });
    this.createEventsListeners();
  }

  setup() {
    window.addEventListener('resize', this.onWindowResize.bind(this), false);
    this.renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    this.renderer.setSize(this.viewport.width, this.viewport.height);
    this.renderer.setPixelRatio(window.devicePixelRatio);
    this.container.appendChild(this.renderer.domElement);

    this.scene = new THREE.Scene();
    this.camera = new THREE.PerspectiveCamera(
      40,
      this.viewport.aspectRatio,
      0.1,
      100
    );
    this.camera.position.set(0, 0, 3);
    this.mouse = new THREE.Vector2();
    this.timeSpeed = 2;
    this.time = 0;
    this.clock = new THREE.Clock();
    this.renderer.setAnimationLoop(this.render.bind(this));
  }

  render() {
    this.time += this.clock.getDelta() * this.timeSpeed;
    this.renderer.render(this.scene, this.camera);
  }

  initEffectShell() {
    let promises = [];
    this.items = this.itemsElements;
    const loader = new THREE.TextureLoader();
    this.items.forEach((item, index) => {
      promises.push(
        this.loadTexture(loader, item.img ? item.img.src : null, index)
      );
    });
    return Promise.all(promises).then(promises => {
      promises.forEach((p, i) => {
        this.items[i].texture = p.texture;
      });
    });
  }

  createEventsListeners() {
    this.items.forEach((item, index) => {
      item.element.addEventListener(
        'mouseover',
        this._onMouseOver.bind(this, index),
        false
      );
    });
    this.container.addEventListener(
      'mousemove',
      this._onMouseMove.bind(this),
      false
    );
    this.itemsWrapper.addEventListener(
      'mouseleave',
      this._onMouseLeave.bind(this),
      false
    );
  }

  _onMouseLeave(e) {
    this.isMouseOver = false;
    this.onMouseLeave(e);
  }
  _onMouseMove(e) {
    const rect = this.container.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    
    this.mouse.x = (x / this.viewport.width) * 2 - 1;
    this.mouse.y = -(y / this.viewport.height) * 2 + 1;
    this.onMouseMove(e, x, y);
  }
  _onMouseOver(i, e) {
    this.tempItemIndex = i;
    this.onMouseOver(i, e);
  }

  onWindowResize() {
    this.camera.aspect = this.viewport.aspectRatio;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(this.viewport.width, this.viewport.height);

    // keep plane locked to 288x250 on resize
    if (this.plane) this.applyPlanePixelSize(this.targetSize.w, this.targetSize.h);
  }

  get viewport() {
    let w = this.container.clientWidth,
      h = this.container.clientHeight;
    return { width: w, height: h, aspectRatio: w / h };
  }

  get itemsElements() {
    const items = [
      ...this.itemsWrapper.querySelectorAll('.portfolio20_item-link')
    ];
    return items.map((item, index) => ({
      element: item,
      img: item.querySelector('.portfolio20_image') || null,
      index
    }));
  }

  loadTexture(loader, url, index) {
    return new Promise((resolve, reject) => {
      if (!url) {
        resolve({ texture: null, index });
        return;
      }
      loader.load(
        url,
        tex => {
          tex.minFilter = THREE.LinearFilter;
          tex.generateMipmaps = false;
          tex.wrapS = tex.wrapT = THREE.ClampToEdgeWrapping;
          resolve({ texture: tex, index });
        },
        undefined,
        err => reject(err)
      );
    });
  }

  // convert a pixel size to world scale and apply to plane (no extra cover scaling)
  applyPlanePixelSize(pxW, pxH) {
    const distance = Math.abs(this.camera.position.z); // plane at z=0
    const worldHeight = 2 * Math.tan((this.camera.fov * Math.PI) / 360) * distance;
    const worldWidth = worldHeight * this.viewport.aspectRatio;

    const scaleX = (pxW / this.viewport.width) * worldWidth;
    const scaleY = (pxH / this.viewport.height) * worldHeight;

    this.plane.scale.set(scaleX, scaleY, 1);
  }

  // helper to get world position of a DOM element
  getWorldPositionFromDOM(element) {
    const rect = element.getBoundingClientRect();

    const x = (rect.left + rect.width / 2) / this.viewport.width * 2 - 1;
    const y = -((rect.top + rect.height / 2) / this.viewport.height * 2 - 1);

    const vec = new THREE.Vector3(x, y, 0.5);
    vec.unproject(this.camera);

    const dir = vec.sub(this.camera.position).normalize();
    const distance = -this.camera.position.z / dir.z;
    return this.camera.position.clone().add(dir.multiplyScalar(distance));
  }

  onMouseEnter() {}
  onMouseLeave() {}
  onMouseMove() {}
  onMouseOver() {}
}

class RGBShiftEffect extends EffectShell {
  constructor(container, itemsWrapper, options = {}) {
    super(container, itemsWrapper);
    if (!this.container || !this.itemsWrapper) return;
    options.strength = options.strength || 0.25;
    this.options = options;
    this.init();
  }

  init() {
    this.position = new THREE.Vector3(0, 0, 0);
    this.scale = new THREE.Vector3(1, 1, 1);
    this.geometry = new THREE.PlaneGeometry(1, 1, 32, 32);
    this.uniforms = {
      uTexture:   { value: null },
      uOffset:    { value: new THREE.Vector2(0, 0) },
      uAlpha:     { value: 0 },
      uUVScale:   { value: new THREE.Vector2(1, 1) },
      uUVOffset:  { value: new THREE.Vector2(0, 0) }
    };
    this.material = new THREE.ShaderMaterial({
      uniforms: this.uniforms,
      vertexShader: `
        uniform vec2 uOffset;
        varying vec2 vUv;
        vec3 deformationCurve(vec3 pos, vec2 uv, vec2 offset) {
          float M_PI = 3.141592653589793;
          pos.x += (sin(uv.y * M_PI) * offset.x);
          pos.y += (sin(uv.x * M_PI) * offset.y);
          return pos;
        }
        void main() {
          vUv = uv;
          vec3 newPos = deformationCurve(position, uv, uOffset);
          gl_Position = projectionMatrix * modelViewMatrix * vec4(newPos, 1.0);
        }`,
      fragmentShader: `
        uniform sampler2D uTexture;
        uniform float uAlpha;
        uniform vec2 uOffset;
        uniform vec2 uUVScale;
        uniform vec2 uUVOffset;
        varying vec2 vUv;

        vec3 rgbShift(sampler2D tex, vec2 baseUV, vec2 offset) {
          float r = texture2D(tex, baseUV + offset).r;
          vec2 gb = texture2D(tex, baseUV).gb;
          return vec3(r, gb);
        }

        void main() {
          vec2 baseUV = vUv * uUVScale + uUVOffset;
          vec3 color = rgbShift(uTexture, baseUV, uOffset);
          gl_FragColor = vec4(color, uAlpha);
        }`,
      transparent: true
    });
    this.plane = new THREE.Mesh(this.geometry, this.material);
    this.scene.add(this.plane);

    // Ensure initial size is exactly 288x250
    this.applyPlanePixelSize(this.targetSize.w, this.targetSize.h);
  }

  onMouseEnter() {
    if (!this.currentItem || !this.isMouseOver) {
      this.isMouseOver = true;
      gsap.to(this.uniforms.uAlpha, {
        value: 1,
        duration: 0.5,
        ease: 'power4.out'
      });
    }
  }

  onMouseLeave() {
    gsap.to(this.uniforms.uAlpha, {
      value: 0,
      duration: 0.5,
      ease: 'power4.out'
    });
  }

  onMouseMove(e) {
    if (!this.currentItem) return;
    
    // Convert mouse pixel position directly to world coordinates
    const distance = Math.abs(this.camera.position.z);
    const worldHeight = 2 * Math.tan((this.camera.fov * Math.PI) / 360) * distance;
    const worldWidth = worldHeight * this.viewport.aspectRatio;
    
    // Use actual mouse pixel coordinates
    const mouseX = (e.clientX / this.viewport.width) * 2 - 1;
    const worldX = (mouseX * worldWidth) / 2;
    
    this.position.set(worldX, this.plane.position.y, 0);

    gsap.to(this.plane.position, {
      x: worldX,
      y: this.plane.position.y, // keep Y position from DOM element
      duration: 0.4,
      ease: 'power4.out',
      onUpdate: this.onPositionUpdate.bind(this)
    });
  }

  onPositionUpdate() {
    const offset = this.plane.position
      .clone()
      .sub(this.position)
      .multiplyScalar(-this.options.strength);
    this.uniforms.uOffset.value = offset;
  }

  onMouseOver(index) {
    if (!this.isLoaded) return;
    this.onMouseEnter();
    if (this.currentItem && this.currentItem.index === index) return;
    this.onTargetChange(index);
  }

  onTargetChange(index) {
    this.currentItem = this.items[index];
    if (!this.currentItem.texture) return;

    const img = this.currentItem.img;
    const tex = this.currentItem.texture;

    // lock plane to 288x250
    this.applyPlanePixelSize(this.targetSize.w, this.targetSize.h);

    // animate plane position to DOM element
    const targetPos = this.getWorldPositionFromDOM(this.currentItem.element);
    gsap.to(this.plane.position, {
      x: targetPos.x,
      y: targetPos.y,
      duration: 0.6,
      ease: "power4.out",
      onUpdate: this.onPositionUpdate.bind(this)
    });

    // ---- COVER in UV space ----
    const iw = img.naturalWidth;
    const ih = img.naturalHeight;
    const imageAspect = iw / ih;
    const targetAspect = this.targetSize.w / this.targetSize.h;

    let uvScaleX = 1.0, uvScaleY = 1.0;
    let uvOffsetX = 0.0, uvOffsetY = 0.0;

    if (imageAspect > targetAspect) {
      uvScaleX = targetAspect / imageAspect;
      uvOffsetX = (1.0 - uvScaleX) * 0.5;
    } else if (imageAspect < targetAspect) {
      uvScaleY = imageAspect / targetAspect;
      uvOffsetY = (1.0 - uvScaleY) * 0.5;
    }

    this.uniforms.uUVScale.value.set(uvScaleX, uvScaleY);
    this.uniforms.uUVOffset.value.set(uvOffsetX, uvOffsetY);
    this.uniforms.uTexture.value = tex;
  }
}

// init
const wrapper = document.querySelector('.portfolio20_list');
new RGBShiftEffect(wrapper, wrapper, { strength: 0.3 });
