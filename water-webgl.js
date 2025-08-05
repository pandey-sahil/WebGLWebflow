 import WebGLFluid from 'webgl-fluid';

  const canvas = document.querySelector('canvas');
  const section = document.querySelector('[webgl-anime="water"]');
  if (!canvas || !section) return console.log(canvas, section);

  // Style canvas behind section
  canvas.style.position = 'fixed';
  canvas.style.top = '0';
  canvas.style.left = '0';
  canvas.style.width = '100vw';
  canvas.style.height = '100vh';
  canvas.style.pointerEvents = 'none';
  canvas.style.zIndex = '0';

  section.style.position = 'relative';

  const fluid = WebGLFluid(canvas, {
    TRIGGER: 'hover',
    SIM_RESOLUTION: 128,
    DYE_RESOLUTION: 512,
    PRESSURE_ITERATIONS: 20,
    COLORFUL: false,
    TRANSPARENT: true,
    BACK_COLOR: { r: 0, g: 0, b: 0 },
    AUTO: false,
  });

  section.addEventListener('mousemove', (e) => {
    const rect = section.getBoundingClientRect();
    const x = (e.clientX - rect.left) / rect.width;
    const y = (e.clientY - rect.top) / rect.height;

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
