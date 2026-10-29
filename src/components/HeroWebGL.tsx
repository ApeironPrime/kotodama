import { useEffect, useRef } from 'react'
import * as THREE from 'three'

const vertexShader = `
varying vec2 vUv;
uniform vec2 uMouse;

void main() {
  vUv = uv;
  vec3 pos = position;
  // Parallax displacement on vertex
  pos.x += uMouse.x * 0.05 * (1.0 - uv.y);
  pos.y += uMouse.y * 0.04 * (1.0 - uv.y);
  gl_Position = projectionMatrix * modelViewMatrix * vec4(pos, 1.0);
}
`

const fragmentShader = `
uniform sampler2D uTexture;
uniform float uTime;
varying vec2 vUv;

void main() {
  vec2 uv = vUv;
  // Gentle water ripple in bottom 28% of the scene
  if (uv.y < 0.28) {
    float wave = sin(uv.y * 28.0 + uTime * 2.2) * 0.006;
    float wave2 = cos(uv.x * 35.0 + uTime * 1.8) * 0.004;
    uv.x += wave;
    uv.y += wave2;
  }
  gl_FragColor = texture2D(uTexture, uv);
}
`

export default function HeroWebGL({ imageSrc }: { imageSrc: string }) {
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

    const scene = new THREE.Scene()
    const camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1)

    // Performance-first renderer configuration (capped at 1.25 dpr to prevent GPU lag)
    const renderer = new THREE.WebGLRenderer({
      alpha: true,
      antialias: false,
      powerPreference: 'high-performance',
      stencil: false,
      depth: false,
    })
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.25))

    const updateSize = () => {
      const width = container.clientWidth || window.innerWidth
      const height = container.clientHeight || window.innerHeight
      renderer.setSize(width, height)
      const aspect = width / height
      camera.left = -aspect
      camera.right = aspect
      camera.top = 1
      camera.bottom = -1
      camera.updateProjectionMatrix()
    }

    updateSize()
    container.appendChild(renderer.domElement)

    const textureLoader = new THREE.TextureLoader()
    const texture = textureLoader.load(imageSrc, () => {
      texture.minFilter = THREE.LinearFilter
      texture.magFilter = THREE.LinearFilter
      renderer.render(scene, camera)
    })

    const geometry = new THREE.PlaneGeometry(2 * 1.35, 2 * 1.35)
    const material = new THREE.ShaderMaterial({
      vertexShader,
      fragmentShader,
      uniforms: {
        uTexture: { value: texture },
        uTime: { value: 0 },
        uMouse: { value: new THREE.Vector2(0, 0) },
      },
      transparent: true,
    })

    const plane = new THREE.Mesh(geometry, material)
    scene.add(plane)

    const handlePointerMove = (e: MouseEvent) => {
      targetMouseX = (e.clientX / window.innerWidth) * 2 - 1
      targetMouseY = -(e.clientY / window.innerHeight) * 2 + 1
    }

    window.addEventListener('mousemove', handlePointerMove, { passive: true })
    window.addEventListener('resize', updateSize)

    // PAUSE RAF WHEN HERO IS OFF-SCREEN (Zero background lag)
    const observer = new IntersectionObserver(([entry]) => {
      isVisible = entry?.isIntersecting ?? false
      if (isVisible && !reqId) {
        lastTime = performance.now()
        reqId = requestAnimationFrame(tick)
      } else if (!isVisible && reqId) {
        cancelAnimationFrame(reqId)
        reqId = 0
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

      // Smooth mouse interpolation
      mouseX += (targetMouseX - mouseX) * 0.08
      mouseY += (targetMouseY - mouseY) * 0.08
      const uMouse = material.uniforms['uMouse']
      if (uMouse) uMouse.value.set(mouseX, mouseY)

      renderer.render(scene, camera)
      reqId = requestAnimationFrame(tick)
    }

    reqId = requestAnimationFrame(tick)

    const handleVisibility = () => {
      if (document.hidden && reqId) {
        cancelAnimationFrame(reqId)
        reqId = 0
      } else if (!document.hidden && isVisible && !reqId) {
        lastTime = performance.now()
        reqId = requestAnimationFrame(tick)
      }
    }
    document.addEventListener('visibilitychange', handleVisibility)

    return () => {
      observer.disconnect()
      window.removeEventListener('mousemove', handlePointerMove)
      window.removeEventListener('resize', updateSize)
      document.removeEventListener('visibilitychange', handleVisibility)
      if (reqId) cancelAnimationFrame(reqId)
      renderer.dispose()
      geometry.dispose()
      material.dispose()
      texture.dispose()
      if (container.contains(renderer.domElement)) {
        container.removeChild(renderer.domElement)
      }
    }
  }, [imageSrc])

  return (
    <div
      ref={containerRef}
      style={{
        width: '100%',
        height: '100%',
        position: 'absolute',
        inset: 0,
        zIndex: 0,
        pointerEvents: 'none',
      }}
    />
  )
}
