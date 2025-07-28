
  import * as THREE from 'https://cdn.jsdelivr.net/npm/three@0.160.1/build/three.module.js';
  // Renderer
  const renderer = new THREE.WebGLRenderer({ antialias: true });
  renderer.setSize(window.innerWidth, window.innerHeight);
  document.body.appendChild(renderer.domElement);

  // Scene
  const scene = new THREE.Scene();

  // Camera setup
  const camera = new THREE.PerspectiveCamera(70, window.innerWidth / window.innerHeight, 0.1, 200);
  const cameraState = {
    position: { x: 0, y: 8, z: 4 },
    target: { x: 0, y: 0, z: 0 }
  };
  camera.position.set(cameraState.position.x, cameraState.position.y, cameraState.position.z);
  camera.lookAt(cameraState.target.x, cameraState.target.y, cameraState.target.z);

  // Tunnel parameters
  const params = {
    radius: 10,
    length: 60,
    radialSegs: 32,
    heightSegs: 40,
    rotationSpeed: 0.002
  };

  // Shader material
  const tunnelMaterial = new THREE.ShaderMaterial({
    uniforms: {
      uLength: { value: params.length },
      color: { value: new THREE.Color(0xffffff) }
    },
    vertexShader: `
      uniform float uLength;
      varying float vZ;
      void main() {
        vZ = position.z;
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
      }
    `,
    fragmentShader: `
      precision mediump float;
      uniform vec3 color;
      uniform float uLength;
      varying float vZ;
      void main() {
        float fade = 1.0 - smoothstep(-uLength/2.0 + 5.0, -uLength/2.0, vZ);
        fade *= 1.0 - smoothstep(uLength/2.0 - 5.0, uLength/2.0, vZ);
        gl_FragColor = vec4(color, fade);
      }
    `,
    transparent: true
  });

  // Generate tunnel geometry
  function createTunnelGeometry(radius, length, radialSegs, heightSegs) {
    const positions = [];

    // Radial segments (circle rings along the tunnel)
    for (let h = 0; h <= heightSegs; h++) {
      const z = (h / heightSegs) * length - length / 2;
      for (let i = 0; i < radialSegs; i++) {
        const a1 = (i / radialSegs) * Math.PI * 2;
        const a2 = ((i + 1) / radialSegs) * Math.PI * 2;
        positions.push(
          Math.cos(a1) * radius, Math.sin(a1) * radius, z,
          Math.cos(a2) * radius, Math.sin(a2) * radius, z
        );
      }
    }

    // Longitudinal lines
    for (let i = 0; i < radialSegs; i++) {
      const angle = (i / radialSegs) * Math.PI * 2;
      const x = Math.cos(angle) * radius;
      const y = Math.sin(angle) * radius;
      for (let h = 0; h < heightSegs; h++) {
        const z1 = (h / heightSegs) * length - length / 2;
        const z2 = ((h + 1) / heightSegs) * length - length / 2;
        positions.push(x, y, z1, x, y, z2);
      }
    }

    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
    return geometry;
  }

  // Create tunnel mesh
  const tunnelGeometry = createTunnelGeometry(params.radius, params.length, params.radialSegs, params.heightSegs);
  const tunnelMesh = new THREE.LineSegments(tunnelGeometry, tunnelMaterial);
  scene.add(tunnelMesh);

  // Handle resize
  window.addEventListener('resize', () => {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
  });

  // Animation loop
  function animate() {
    requestAnimationFrame(animate);
    tunnelMesh.rotation.z += params.rotationSpeed;
    renderer.render(scene, camera);
  }

  animate();
