import * as THREE from 'three';

class EffectShell {
  constructor(container = document.body, itemsWrapper = null) {
    this.container = container;
    this.itemsWrapper = itemsWrapper;
    if (!this.container || !this.itemsWrapper) return;
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
    this.mouse.x = (e.clientX / this.viewport.width) * 2 - 1;
    this.mouse.y = -(e.clientY / this.viewport.height) * 2 + 1;
    this.onMouseMove(e);
  }
  _onMouseOver(i, e) {
    this.tempItemIndex = i;
    this.onMouseOver(i, e);
  }

  onWindowResize() {
    this.camera.aspect = this.viewport.aspectRatio;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(this.viewport.width, this.viewport.height);
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
      uTexture: { value: null },
      uOffset: { value: new THREE.Vector2(0, 0) },
      uAlpha: { value: 0 }
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
        varying vec2 vUv;
        vec3 rgbShift(sampler2D tex, vec2 uv, vec2 offset) {
          float r = texture2D(tex, vUv + offset).r;
          vec2 gb = texture2D(tex, vUv).gb;
          return vec3(r, gb);
        }
        void main() {
          vec3 color = rgbShift(uTexture, vUv, uOffset);
          gl_FragColor = vec4(color, uAlpha);
        }`,
      transparent: true
    });
    this.plane = new THREE.Mesh(this.geometry, this.material);
    this.scene.add(this.plane);
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

  onMouseMove() {
    const vec = new THREE.Vector3(this.mouse.x, this.mouse.y, 0.5);
    vec.unproject(this.camera);

    const dir = vec.sub(this.camera.position).normalize();
    const distance = -this.camera.position.z / dir.z;
    const pos = this.camera.position.clone().add(dir.multiplyScalar(distance));

    this.position.copy(pos);

    gsap.to(this.plane.position, {
      x: pos.x,
      y: pos.y,
      duration: 0.4,
      ease: 'power4.out',
      onUpdate: this.onPositionUpdate.bind(this)
    });
  }

  onPositionUpdate() {
    let offset = this.plane.position
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

    let img = this.currentItem.img;
    let tex = this.currentItem.texture;

    let iw = img.naturalWidth;
    let ih = img.naturalHeight;
    let imageAspect = iw / ih;

    let targetWidth = 288;
    let targetHeight = 250;
    let targetAspect = targetWidth / targetHeight;

    // cover logic
    let coverScaleX = 1, coverScaleY = 1;
    if (imageAspect > targetAspect) {
      coverScaleX = imageAspect / targetAspect;
    } else {
      coverScaleY = targetAspect / imageAspect;
    }

    // convert px to world units
    let worldHeight =
      2 * Math.tan((this.camera.fov * Math.PI) / 360) *
      Math.abs(this.camera.position.z);
    let worldWidth = worldHeight * this.viewport.aspectRatio;

    let planeScaleX = (targetWidth / this.viewport.width) * worldWidth;
    let planeScaleY = (targetHeight / this.viewport.height) * worldHeight;

    // ✅ Final scale (288x250 px, cover fit)
    this.plane.scale.set(planeScaleX * coverScaleX, planeScaleY * coverScaleY, 1);

    this.uniforms.uTexture.value = tex;
  }
}

// init
const wrapper = document.querySelector('.portfolio20_list');
new RGBShiftEffect(wrapper, wrapper, { strength: 0.3 });
