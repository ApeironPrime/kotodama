import { useEffect, useRef } from 'react'
import * as THREE from 'three'

const vertexShader = `
varying vec2 vUv;

void main() {
  vUv = uv;
  gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
}
`

const fragmentShader = `
uniform sampler2D uTexture;
uniform sampler2D uDepthMap;
uniform float uTime;
uniform vec2 uMouse;
uniform vec2 uPointer;
uniform float uRipple;
uniform mat3 uUvTransform;
uniform vec2 uTexelSize;
varying vec2 vUv;

// Subtle procedural washi paper fiber noise
float hash(vec2 p) {
  return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453);
}

void main() {
  vec2 uv = (uUvTransform * vec3(vUv, 1.0)).xy;
  
  // 1. Depth Map Parallax Layering (2.5D Spatial Diorama)
  float depth = texture2D(uDepthMap, uv).r;
  
  // A continuous, restrained displacement keeps the painting in one piece.
  vec2 parallax = uMouse * (depth * 0.018);
  vec2 pUv = clamp(uv + parallax, 0.001, 0.999);
  
  // Refraction belongs to the lake, below the buildings and the mountain ridges.
  float waterMask = (1.0 - smoothstep(0.06, 0.17, uv.y))
    * smoothstep(0.35, 0.48, uv.x)
    * (1.0 - smoothstep(0.75, 0.87, uv.x));
  if (waterMask > 0.0) {
    
    // Ambient undulating water current
    float wave1 = sin(pUv.y * 36.0 + uTime * 2.2) * 0.0015;
    float wave2 = cos(pUv.x * 28.0 + uTime * 1.8 + sin(uTime * 0.9)) * 0.0012;
    
    // Interactive mouse ripple wavefront (visibly undulating caustics)
    vec2 pointer = (uUvTransform * vec3(uPointer, 1.0)).xy;
    float dist = length((uv - pointer) * vec2(1.6, 1.0));
    float waveRipple = sin(dist * 44.0 - uTime * 7.5) * exp(-dist * 4.2) * uRipple * 0.006;
    
    pUv.x += (wave1 + waveRipple) * waterMask;
    pUv.y += (wave2 + waveRipple * 0.65) * waterMask;
  }

  // 3. Crisp Video Frame Sampling
  vec4 color = texture2D(uTexture, pUv);
  vec3 neighbors = texture2D(uTexture, pUv + vec2(uTexelSize.x, 0.0)).rgb
    + texture2D(uTexture, pUv - vec2(uTexelSize.x, 0.0)).rgb
    + texture2D(uTexture, pUv + vec2(0.0, uTexelSize.y)).rgb
    + texture2D(uTexture, pUv - vec2(0.0, uTexelSize.y)).rgb;
  color.rgb = clamp(color.rgb + (color.rgb - neighbors * 0.25) * 0.35, 0.0, 1.0);

  // 4. Subtle Shimmering Light Caustics on Water Surface
  if (waterMask > 0.0) {
    float sparkle = pow(max(0.0, sin(pUv.y * 50.0 + uTime * 2.8) * sin(pUv.x * 40.0 + uTime * 2.0)), 4.0);
    color.rgb += vec3(0.96, 0.92, 0.85) * sparkle * 0.06 * waterMask;
  }

  // 5. Authentic Washi Fiber Grain
  float grain = (hash(uv * 700.0 + fract(uTime * 0.02)) - 0.5) * 0.004;
  color.rgb += grain;

  // Leave a paper margin instead of cropping the calligraphy at the image edge.
  vec2 edge = smoothstep(vec2(0.0), vec2(0.018), pUv)
    * (1.0 - smoothstep(vec2(0.982), vec2(1.0), pUv));
  color.a *= edge.x * edge.y;
  gl_FragColor = color;
}
`

/**
 * Build a smooth depth field without rectangular regions or luminance edges.
 */
function createProceduralDepthMap(image: HTMLImageElement): THREE.CanvasTexture {
  const canvas = document.createElement('canvas')
  const w = 512
  const h = 512
  canvas.width = w
  canvas.height = h
  const ctx = canvas.getContext('2d')
  if (!ctx) return new THREE.CanvasTexture(canvas)

  ctx.drawImage(image, 0, 0, w, h)
  const imgData = ctx.getImageData(0, 0, w, h)
  const d = imgData.data

  for (let i = 0; i < d.length; i += 4) {
    const y = Math.floor(i / 4 / w) / h // 0 top, 1 bottom
    const x = ((i / 4) % w) / w
    const foreground = y * y * (3 - 2 * y)
    const sideDepth = Math.pow(Math.abs(x - 0.5) * 2, 2)
    const depth = foreground * (0.7 + sideDepth * 0.3)
    const finalVal = Math.round(depth * 255)
    d[i] = finalVal
    d[i + 1] = finalVal
    d[i + 2] = finalVal
  }

  ctx.putImageData(imgData, 0, 0)
  const texture = new THREE.CanvasTexture(canvas)
  texture.wrapS = THREE.ClampToEdgeWrapping
  texture.wrapT = THREE.ClampToEdgeWrapping
  texture.minFilter = THREE.LinearFilter
  texture.magFilter = THREE.LinearFilter
  return texture
}

export default function HeroCreativeWebGL({ imageSrc, videoSrc }: { imageSrc: string; videoSrc?: string }) {
  const containerRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const container = containerRef.current
    if (!container || typeof window === 'undefined') return

    if (window.matchMedia?.('(prefers-reduced-motion: reduce)').matches) return

    let isVisible = true
    let reqId = 0
    let mouseX = 0
    let mouseY = 0
    let targetMouseX = 0
    let targetMouseY = 0
    let pointerUvX = 0.5
    let pointerUvY = 0.2
    let rippleStrength = 0

    const scene = new THREE.Scene()
    const camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1)

    let renderer: THREE.WebGLRenderer
    try {
      renderer = new THREE.WebGLRenderer({
        alpha: true,
        antialias: false,
        powerPreference: 'high-performance',
        stencil: false,
        depth: false,
      })
      renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2))
    } catch {
      return
    }

    let imageAspect = 16 / 9

    // Fit the entire painting, including the topmost calligraphy, inside the frame.
    const updateCover = (texture: THREE.Texture, width: number, height: number) => {
      const containerAspect = width / height
      const zoom = 0.94

      if (containerAspect > imageAspect) {
        const repX = containerAspect / imageAspect / zoom
        texture.repeat.set(repX, 1 / zoom)
        texture.offset.set((1 - repX) * 0.5, (1 - 1 / zoom) * 0.5)
      } else {
        const repY = imageAspect / containerAspect / zoom
        texture.repeat.set(1 / zoom, repY)
        texture.offset.set((1 - 1 / zoom) * 0.5, (1 - repY) * 0.5)
      }
      // ShaderMaterial does not apply Texture.repeat/offset automatically.
      texture.updateMatrix()
      material.uniforms['uUvTransform']?.value.copy(texture.matrix)
    }

    let activeTexture: THREE.Texture | null = null

    const updateSize = () => {
      const width = container.clientWidth || window.innerWidth
      const height = container.clientHeight || window.innerHeight
      renderer.setSize(width, height)
      if (activeTexture) {
        updateCover(activeTexture, width, height)
      }
    }

    container.appendChild(renderer.domElement)

    // Set up Video or Image Texture
    let videoEl: HTMLVideoElement | null = null
    const textureLoader = new THREE.TextureLoader()

    const geometry = new THREE.PlaneGeometry(2, 2)
    const material = new THREE.ShaderMaterial({
      vertexShader,
      fragmentShader,
      uniforms: {
        uTexture: { value: null },
        uDepthMap: { value: null },
        uTime: { value: 0 },
        uMouse: { value: new THREE.Vector2(0, 0) },
        uPointer: { value: new THREE.Vector2(0.5, 0.2) },
        uRipple: { value: 0 },
        uUvTransform: { value: new THREE.Matrix3() },
        uTexelSize: { value: new THREE.Vector2(1 / 1920, 1 / 1080) },
      },
      transparent: true,
    })

    const plane = new THREE.Mesh(geometry, material)
    scene.add(plane)

    let depthTexture: THREE.CanvasTexture | null = null
    const depthImg = new Image()
    depthImg.crossOrigin = 'anonymous'
    depthImg.src = imageSrc
    depthImg.onload = () => {
      depthTexture = createProceduralDepthMap(depthImg)
      if (material.uniforms['uDepthMap']) {
        material.uniforms['uDepthMap'].value = depthTexture
      }
      renderer.render(scene, camera)
    }

    if (videoSrc) {
      videoEl = document.createElement('video')
      videoEl.src = videoSrc
      videoEl.crossOrigin = 'anonymous'
      videoEl.loop = true
      videoEl.muted = true
      videoEl.playsInline = true
      videoEl.autoplay = true
      videoEl.preload = 'auto'

      const videoTex = new THREE.VideoTexture(videoEl)
      videoTex.wrapS = THREE.ClampToEdgeWrapping
      videoTex.wrapT = THREE.ClampToEdgeWrapping
      videoTex.minFilter = THREE.LinearFilter
      videoTex.magFilter = THREE.LinearFilter

      activeTexture = videoTex
      if (material.uniforms['uTexture']) {
        material.uniforms['uTexture'].value = activeTexture
      }

      videoEl.addEventListener('loadedmetadata', () => {
        if (videoEl && videoEl.videoWidth && videoEl.videoHeight) {
          imageAspect = videoEl.videoWidth / videoEl.videoHeight
          material.uniforms['uTexelSize']?.value.set(1 / videoEl.videoWidth, 1 / videoEl.videoHeight)
        }
        updateSize()
        void videoEl?.play().catch(() => {})
      })

      void videoEl.play().catch(() => {})
    } else {
      activeTexture = textureLoader.load(imageSrc, (loadedImg) => {
        loadedImg.wrapS = THREE.ClampToEdgeWrapping
        loadedImg.wrapT = THREE.ClampToEdgeWrapping
        loadedImg.minFilter = THREE.LinearFilter
        loadedImg.magFilter = THREE.LinearFilter
        if (loadedImg.image instanceof HTMLImageElement) {
          imageAspect = loadedImg.image.naturalWidth / loadedImg.image.naturalHeight
          material.uniforms['uTexelSize']?.value.set(
            1 / loadedImg.image.naturalWidth,
            1 / loadedImg.image.naturalHeight
          )
        }
        if (material.uniforms['uTexture']) {
          material.uniforms['uTexture'].value = activeTexture
        }
        updateSize()
        renderer.render(scene, camera)
      })
    }

    updateSize()

    const handlePointerMove = (e: MouseEvent) => {
      const rect = container.getBoundingClientRect()
      const nx = (e.clientX - rect.left) / rect.width
      const ny = 1.0 - (e.clientY - rect.top) / rect.height

      targetMouseX = (nx - 0.5) * 2.0
      targetMouseY = (ny - 0.5) * 2.0

      pointerUvX = nx
      pointerUvY = ny

      if (ny < 0.46) {
        rippleStrength = Math.min(1.0, rippleStrength + 0.38)
      }
    }

    window.addEventListener('mousemove', handlePointerMove, { passive: true })
    window.addEventListener('resize', updateSize)

    const observer = new IntersectionObserver(([entry]) => {
      isVisible = entry?.isIntersecting ?? false
      if (isVisible) {
        if (videoEl && videoEl.paused) void videoEl.play().catch(() => {})
        if (!reqId) {
          lastTime = performance.now()
          reqId = requestAnimationFrame(tick)
        }
      } else {
        if (videoEl && !videoEl.paused) videoEl.pause()
        if (reqId) {
          cancelAnimationFrame(reqId)
          reqId = 0
        }
      }
    })
    observer.observe(container)

    let lastTime = performance.now()
    const tick = (now: number) => {
      if (!isVisible || document.hidden) {
        reqId = 0
        return
      }

      const delta = (now - lastTime) / 1000
      lastTime = now

      const uTime = material.uniforms['uTime']
      if (uTime) uTime.value += delta

      mouseX += (targetMouseX - mouseX) * 0.06
      mouseY += (targetMouseY - mouseY) * 0.06
      const uMouse = material.uniforms['uMouse']
      if (uMouse) uMouse.value.set(mouseX, mouseY)

      const uPointer = material.uniforms['uPointer']
      if (uPointer) uPointer.value.set(pointerUvX, pointerUvY)
      rippleStrength *= 0.95
      const uRipple = material.uniforms['uRipple']
      if (uRipple) uRipple.value = rippleStrength

      renderer.render(scene, camera)
      reqId = requestAnimationFrame(tick)
    }

    reqId = requestAnimationFrame(tick)

    const handleVisibility = () => {
      if (document.hidden) {
        if (videoEl) videoEl.pause()
        if (reqId) {
          cancelAnimationFrame(reqId)
          reqId = 0
        }
      } else if (!document.hidden && isVisible) {
        if (videoEl) void videoEl.play().catch(() => {})
        if (!reqId) {
          lastTime = performance.now()
          reqId = requestAnimationFrame(tick)
        }
      }
    }
    document.addEventListener('visibilitychange', handleVisibility)

    return () => {
      observer.disconnect()
      window.removeEventListener('mousemove', handlePointerMove)
      window.removeEventListener('resize', updateSize)
      document.removeEventListener('visibilitychange', handleVisibility)
      if (reqId) cancelAnimationFrame(reqId)
      if (videoEl) {
        videoEl.pause()
        videoEl.src = ''
        videoEl.remove()
      }
      renderer.dispose()
      geometry.dispose()
      material.dispose()
      activeTexture?.dispose()
      depthTexture?.dispose()
      if (container.contains(renderer.domElement)) {
        container.removeChild(renderer.domElement)
      }
    }
  }, [imageSrc, videoSrc])

  return (
    <div
      ref={containerRef}
      className="showcase-hero__webgl-stage"
      style={{
        position: 'absolute',
        inset: 0,
        zIndex: 1,
        pointerEvents: 'none',
        width: '100%',
        height: '100%',
        overflow: 'hidden',
      }}
      aria-hidden="true"
    />
  )
}
