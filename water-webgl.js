import WebGLFluid from 'https://cdn.jsdelivr.net/npm/webgl-fluid@0.3/dist/webgl-fluid.mjs';

window.addEventListener('load', () => {
  const canvas = document.querySelector('canvas');
  const section = document.querySelector('[webgl-anime="water"]');
  if (!canvas || !section) return;

  // Make canvas full‑screen and fixed behind the section
  canvas.style.position = 'fixed';
  canvas.style.top = '0';
  canvas.style.left = '0';
  canvas.style.width = '100vw';
  canvas.style.height = '100vh';
  canvas.style.pointerEvents = 'none';
  canvas.style.zIndex = '0';
  section.style.position = 'relative';

  // Initialize fluid simulation
  const fluid = WebGLFluid(canvas, {
    TRIGGER: 'hover',
    SIM_RESOLUTION: 128,
    DYE_RESOLUTION: 512,
    VELOCITY_DISSIPATION: 0.3,
    DENSITY_DISSIPATION: 1.0,
    PRESSURE: 0.8,
    PRESSURE_ITERATIONS: 20,
    COLORFUL: false,
    BACK_COLOR: { r: 0, g: 0, b: 0 },
    TRANSPARENT: true,
    AUTO: false,
  });

  // Only trigger splats when pointer moves *within* section
  const bounds = () => section.getBoundingClientRect();

  section.addEventListener('mousemove', (e) => {
    const r = bounds();
    const x = (e.clientX - r.left) / r.width;
    const y = (e.clientY - r.top) / r.height;
    if (x >= 0 && x <= 1 && y >= 0 && y <= 1) {
      fluid.splat(x * canvas.width, (1 - y) * canvas.height, 200, 200, 0);
    }
  });

  section.addEventListener('mouseenter', () => {
    fluid.opts.TRIGGER = 'hover';
  });

  section.addEventListener('mouseleave', () => {
    fluid.opts.TRIGGER = 'none';
  });
});
