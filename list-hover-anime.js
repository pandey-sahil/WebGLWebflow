document.addEventListener("DOMContentLoaded", () => {
  // Add canvas to each image wrapper
  document.querySelectorAll(".portfolio20_image-wrapper").forEach(wrapper => {
    const canvas = document.createElement("canvas");
    canvas.classList.add("portfolio20-canvas");
    wrapper.appendChild(canvas);
    // Hide the native image
    const img = wrapper.querySelector(".portfolio20_image");
    if (img) img.style.display = "none";
  });

  // extend EffectShell get items
  class EffectShell {
    constructor(container = document.body, itemsWrapper = null) {
      this.container = container
      this.itemsWrapper = itemsWrapper
      if (!this.container || !this.itemsWrapper) return
      this.setup()
      this.initEffectShell().then(() => {
        this.isLoaded = true
        if (this.isMouseOver) this.onMouseOver(this.tempItemIndex)
        this.tempItemIndex = null
      })
      this.createEventsListeners()
    }

    setup() {
      window.addEventListener('resize', this.onWindowResize.bind(this), false)
      this.renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, canvas: this.getCanvas() })
      this.renderer.setSize(this.viewport.width, this.viewport.height)
      this.renderer.setPixelRatio(window.devicePixelRatio)

      this.scene = new THREE.Scene()
      this.camera = new THREE.PerspectiveCamera(40, this.viewport.aspectRatio, 0.1, 100)
      this.camera.position.set(0, 0, 3)
      this.mouse = new THREE.Vector2()
      this.timeSpeed = 2
      this.time = 0
      this.clock = new THREE.Clock()
      this.renderer.setAnimationLoop(this.render.bind(this))
    }

    getCanvas() {
      // get the first canvas we injected
      return this.itemsWrapper.querySelector(".portfolio20-canvas")
    }

    render() {
      this.time += this.clock.getDelta() * this.timeSpeed
      this.renderer.render(this.scene, this.camera)
    }

    initEffectShell() {
      let promises = []
      this.items = this.itemsElements
      const loader = new THREE.TextureLoader()
      this.items.forEach((item, index) => {
        const url = item.img ? item.img.src : null
        promises.push(this.loadTexture(loader, url, index))
      })
      return Promise.all(promises).then(promises => {
        promises.forEach((p, i) => {
          this.items[i].texture = p.texture
        })
      })
    }

    get itemsElements() {
      const items = [...this.itemsWrapper.querySelectorAll('.portfolio20_item-link')]
      return items.map((item, index) => ({
        element: item,
        img: item.querySelector('.portfolio20_image') || null,
        index
      }))
    }

    loadTexture(loader, url, index) {
      return new Promise((resolve, reject) => {
        if (!url) { resolve({ texture: null, index }); return }
        loader.load(url, tex => resolve({ texture: tex, index }), undefined, err => reject(err))
      })
    }
  }

  // RGBShiftEffect stays same...

  const wrapper = document.querySelector('.portfolio20_list')
  new RGBShiftEffect(wrapper, wrapper, { strength: 0.3 })
})
