import * as THREE from 'three';

window.addEventListener('load', () => {
  document.querySelectorAll('[webgl-anime="water"]').forEach(section => {
    const canvas = document.createElement('canvas');
    canvas.style.position = 'absolute';
    canvas.style.top = 0;
    canvas.style.left = 0;
    canvas.style.width = '100%';
    canvas.style.height = '100%';
    canvas.style.zIndex = 0;
    canvas.style.pointerEvents = 'none';
    section.style.position = 'relative';
    section.prepend(canvas);

    const renderer = new THREE.WebGLRenderer({ canvas, alpha: true });
    const scene = new THREE.Scene();
    const camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);

    const loader = new THREE.TextureLoader();
    const rippleTexture = loader.load('https://raw.githubusercontent.com/Jam3/glsl-fast-gaussian-blur/master/examples/images/ripple.png'); // A small radial ripple texture

    const uniforms = {
      u_time: { value: 0 },
      u_mouse: { value: new THREE.Vector2(-10, -10) },
      u_resolution: { value: new THREE.Vector2(window.innerWidth, window.innerHeight) },
      u_texture: { value: rippleTexture },
    };

    const vertexShader = `
      varying vec2 vUv;
      void main() {
        vUv = uv;
        gl_Position = vec4(position, 1.0);
      }
    `;

    const fragmentShader = `
      varying vec2 vUv;
      uniform float u_time;
      uniform vec2 u_mouse;
      uniform vec2 u_resolution;
      uniform sampler2D u_texture;

      void main() {
        vec2 uv = vUv;
        vec2 rippleUV = uv - u_mouse;
        float dist = length(rippleUV);
        float ripple = 0.03 * sin(30.0 * dist - u_time * 5.0) / dist;

        vec3 color = vec3(0.0, 0.5, 1.0) + ripple;
        gl_FragColor = vec4(color, 0.3);
      }
    `;

    const geometry = new THREE.PlaneGeometry(2, 2);
    const material = new THREE.ShaderMaterial({
      uniforms,
      vertexShader,
      fragmentShader,
      transparent: true,
    });

    const mesh = new THREE.Mesh(geometry, material);
    scene.add(mesh);

    function resize() {
      const bounds = section.getBoundingClientRect();
      renderer.setSize(bounds.width, bounds.height);
      uniforms.u_resolution.value.set(bounds.width, bounds.height);
    }

    resize();
    window.addEventListener('resize', resize);

    section.addEventListener('mousemove', (e) => {
      const bounds = section.getBoundingClientRect();
      uniforms.u_mouse.value.x = (e.clientX - bounds.left) / bounds.width;
      uniforms.u_mouse.value.y = 1.0 - (e.clientY - bounds.top) / bounds.height;
    });

    function animate() {
      requestAnimationFrame(animate);
      uniforms.u_time.value += 0.05;
      renderer.render(scene, camera);
    }
    animate();
  });
});
