import { useEffect, useRef, useState, useCallback } from 'react'
import * as THREE from 'three'
import * as CANNON from 'cannon-es'
import type { Die } from '@dice-game/core'

const HALF = 0.5
const GRAB_Y = 2.2
const IDLE_Y = 6
const GRAB_SPIN = 24
const RESULT_Y = 1.8

// 충돌 그룹: 내 주사위 / 상대 주사위 / 환경(벽·바닥·분리벽)은 서로 다른 그룹
// 내 주사위 ↔ 상대 주사위 충돌을 막고 각자 환경하고만 충돌
const GRP_MY  = 1
const GRP_OPP = 2
const GRP_ENV = 4

const COLORS = ['#fef9c3', '#dbeafe', '#dcfce7', '#fee2e2', '#ede9fe', '#fed7aa']
const FI_TO_MAT = [2, 1, 4, 0, 5, 3]
const FACE_NORMALS_C = [
  new CANNON.Vec3(0, 1, 0),
  new CANNON.Vec3(-1, 0, 0),
  new CANNON.Vec3(0, 0, 1),
  new CANNON.Vec3(1, 0, 0),
  new CANNON.Vec3(0, 0, -1),
  new CANNON.Vec3(0, -1, 0),
]
const OPPOSITE_FACE_INDEX = [5, 3, 4, 1, 2, 0] as const
const SQ2 = Math.SQRT1_2
const SNAP_QUATS: [number, number, number, number][] = [
  [0, 0, 0, 1],
  [0, 0, -SQ2, SQ2],
  [-SQ2, 0, 0, SQ2],
  [0, 0, SQ2, SQ2],
  [SQ2, 0, 0, SQ2],
  [1, 0, 0, 0],
]

// 결과 공개 단계
type RevealStage = 'idle' | 'rolling' | 'suspense' | 'revealing' | 'done'

function makeTexture(value: number, color: string): THREE.CanvasTexture {
  const c = document.createElement('canvas')
  c.width = c.height = 256
  const ctx = c.getContext('2d')!
  ctx.fillStyle = color
  ctx.beginPath()
  ctx.roundRect(4, 4, 248, 248, 28)
  ctx.fill()
  ctx.strokeStyle = 'rgba(0,0,0,0.18)'
  ctx.lineWidth = 5
  ctx.stroke()
  ctx.fillStyle = '#1e293b'
  ctx.font = 'bold 120px system-ui'
  ctx.textAlign = 'center'
  ctx.textBaseline = 'middle'
  ctx.fillText(String(value), 128, 134)
  return new THREE.CanvasTexture(c)
}

function createDieMesh(die: Die): THREE.Mesh {
  const geo = new THREE.BoxGeometry(HALF * 2, HALF * 2, HALF * 2)
  const mats: THREE.MeshStandardMaterial[] = new Array(6)
  die.faces.forEach((val, fi) => {
    mats[FI_TO_MAT[fi]] = new THREE.MeshStandardMaterial({
      map: makeTexture(val, COLORS[fi]),
      roughness: 0.55,
      metalness: 0.05,
    })
  })
  return new THREE.Mesh(geo, mats)
}

function createDieBody(x: number, z: number): CANNON.Body {
  const body = new CANNON.Body({
    mass: 1,
    shape: new CANNON.Box(new CANNON.Vec3(HALF, HALF, HALF)),
    linearDamping: 0.35,
    angularDamping: 0.4,
  })
  body.position.set(x, HALF + 0.01, z)
  body.quaternion.setFromEuler(
    Math.random() * Math.PI, Math.random() * Math.PI, Math.random() * Math.PI
  )
  return body
}

function readSettledTopFace(body: CANNON.Body, die: Die): number | null {
  const down = new CANNON.Vec3(0, -1, 0)
  let best = -Infinity, bottomFi = 0
  FACE_NORMALS_C.forEach((n, fi) => {
    const d = body.quaternion.vmult(n).dot(down)
    if (d > best) { best = d; bottomFi = fi }
  })
  if (body.position.y > HALF + 0.08 || best < 0.96) return null
  return die.faces[OPPOSITE_FACE_INDEX[bottomFi]]
}

interface PhysicsDiceProps {
  myDie: Die
  oppDie: Die
  onResult: (myVal: number, oppVal: number) => void
}

export function PhysicsDice({ myDie, oppDie, onResult }: PhysicsDiceProps) {
  const mountRef = useRef<HTMLDivElement>(null)
  const [hint, setHint] = useState<'grab' | 'hold' | 'wait' | 'done'>('grab')
  const [revealStage, setRevealStage] = useState<RevealStage>('idle')
  const [displayValue, setDisplayValue] = useState<number | null>(null)
  const resultFired = useRef(false)
  const pendingResult = useRef<{ my: number; opp: number } | null>(null)

  // 플립 카운터 (? → 숫자 깜빡임용)
  const [flipCount, setFlipCount] = useState(0)

  // 긴장 → 공개 시퀀스
  const triggerReveal = useCallback((myVal: number, oppVal: number) => {
    pendingResult.current = { my: myVal, opp: oppVal }
    setRevealStage('suspense')
    setDisplayValue(null)

    // 0.7s suspense → flip 시작
    setTimeout(() => {
      setRevealStage('revealing')
      let count = 0
      const interval = setInterval(() => {
        setFlipCount(c => c + 1)
        count++
        if (count >= 5) {
          clearInterval(interval)
          setDisplayValue(myVal)
          setRevealStage('done')
          setHint('done')
          setTimeout(() => onResult(myVal, oppVal), 600)
        }
      }, 80)
    }, 700)
  }, [onResult])

  useEffect(() => {
    const mount = mountRef.current!
    const W = mount.clientWidth
    const H = mount.clientHeight
    const TW = 5, TD = 8.5

    const renderer = new THREE.WebGLRenderer({ antialias: true })
    renderer.setSize(W, H)
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2))
    renderer.setClearColor(0xdde3ee)
    mount.appendChild(renderer.domElement)

    const scene = new THREE.Scene()

    function makeCamera(w: number, h: number) {
      const a = w / h
      const hH = TD / 2 + 0.4
      const hW = hH * a
      const cam = new THREE.OrthographicCamera(-hW, hW, hH, -hH, 0.1, 100)
      cam.up.set(0, 0, -1)
      cam.position.set(0, 30, 0)
      cam.lookAt(0, 0, 0)
      return cam
    }
    const camera = makeCamera(W, H)
    scene.add(camera)

    scene.add(new THREE.AmbientLight(0xffffff, 1.1))
    const dir = new THREE.DirectionalLight(0xffffff, 1.4)
    dir.position.set(3, 12, 4)
    scene.add(dir)

    const tableMesh = new THREE.Mesh(
      new THREE.PlaneGeometry(TW, TD),
      new THREE.MeshStandardMaterial({ color: 0xe2e8f2, roughness: 0.92 })
    )
    tableMesh.rotation.x = -Math.PI / 2
    scene.add(tableMesh)

    const grid = new THREE.GridHelper(Math.max(TW, TD), 10, 0xb8c3d4, 0xb8c3d4)
    grid.position.y = 0.001
    scene.add(grid)

    const divPts = [new THREE.Vector3(-TW / 2, 0.003, 0), new THREE.Vector3(TW / 2, 0.003, 0)]
    scene.add(new THREE.Line(
      new THREE.BufferGeometry().setFromPoints(divPts),
      new THREE.LineBasicMaterial({ color: 0x7c8fa8, linewidth: 2 })
    ))

    const world = new CANNON.World({ gravity: new CANNON.Vec3(0, -28, 0) })
    world.broadphase = new CANNON.NaiveBroadphase()
    world.allowSleep = true

    const phyMat = new CANNON.Material({ friction: 0.55, restitution: 0.22 })

    const ground = new CANNON.Body({ mass: 0, material: phyMat })
    ground.addShape(new CANNON.Plane())
    ground.quaternion.setFromEuler(-Math.PI / 2, 0, 0)
    ground.collisionFilterGroup = GRP_ENV
    ground.collisionFilterMask  = GRP_MY | GRP_OPP | GRP_ENV
    world.addBody(ground)

    const wallDefs: [number, number, number, number, number, number][] = [
      [-TW / 2, 2, 0,   0,  Math.PI / 2, 0],
      [ TW / 2, 2, 0,   0, -Math.PI / 2, 0],
      [0, 2,  TD / 2,   0,  Math.PI,     0],
      [0, 2, -TD / 2,   0,  0,           0],
    ]
    wallDefs.forEach(([px, py, pz, ex, ey, ez]) => {
      const b = new CANNON.Body({ mass: 0, material: phyMat })
      b.addShape(new CANNON.Plane())
      b.position.set(px, py, pz)
      b.quaternion.setFromEuler(ex, ey, ez)
      b.collisionFilterGroup = GRP_ENV
      b.collisionFilterMask  = GRP_MY | GRP_OPP | GRP_ENV
      world.addBody(b)
    })

    // 중앙 분리벽: z=0 에 얇은 박스. 내 주사위가 상대 영역으로 넘어가지 않도록
    const dividerBody = new CANNON.Body({ mass: 0, material: phyMat })
    dividerBody.addShape(new CANNON.Box(new CANNON.Vec3(TW / 2 + 0.1, 2, 0.04)))
    dividerBody.position.set(0, 1, 0)
    dividerBody.collisionFilterGroup = GRP_ENV
    dividerBody.collisionFilterMask  = GRP_MY | GRP_OPP | GRP_ENV
    world.addBody(dividerBody)

    // 내 주사위: 내 영역(z > 0, 화면 하단)
    const myBody = createDieBody(0, TD / 4)
    myBody.collisionFilterGroup = GRP_MY
    myBody.collisionFilterMask  = GRP_ENV   // 환경하고만 충돌, 상대 주사위 통과
    world.addBody(myBody)
    const myMesh = createDieMesh(myDie)
    scene.add(myMesh)
    myBody.position.set(0, IDLE_Y, TD / 4)  // z > 0 (내 영역)
    myBody.velocity.setZero()
    myBody.angularVelocity.setZero()
    myBody.sleep()

    // 상대 주사위: 상대 영역(z < 0, 화면 상단)
    const oppBody = createDieBody(0, -TD / 4)
    oppBody.collisionFilterGroup = GRP_OPP
    oppBody.collisionFilterMask  = GRP_ENV   // 환경하고만 충돌, 내 주사위 통과
    world.addBody(oppBody)
    const oppMesh = createDieMesh(oppDie)
    scene.add(oppMesh)
    oppBody.position.set(
      (Math.random() - 0.5) * 1.2,
      IDLE_Y + 1,
      -TD / 2 + 0.5   // 상대 영역 끝에서 시작
    )
    oppBody.sleep()

    // 상대 자동 투척 — 상대 영역(z < 0) 안에서 굴림
    const oppDelay = 300 + Math.random() * 300
    setTimeout(() => {
      const vx  = (Math.random() - 0.5) * 6
      const vz  = 3.5 + Math.random() * 3   // +Z 방향 → 중앙 분리벽에 튕김
      const spin = 18 + Math.random() * 14
      oppBody.velocity.set(vx, 3 + Math.random() * 2, vz)
      oppBody.angularVelocity.set(
        (Math.random() - 0.5) * spin,
        (Math.random() - 0.5) * spin,
        (Math.random() - 0.5) * spin
      )
      oppBody.wakeUp()
    }, oppDelay)

    const raycaster = new THREE.Raycaster()
    const ptr = new THREE.Vector2()
    const grabPlane = new THREE.Plane(new THREE.Vector3(0, 1, 0), -GRAB_Y)

    let grabbed = false
    let myThrown = false
    const grabPos = new THREE.Vector3()
    type VelSample = { x: number; z: number; t: number }
    const samples: VelSample[] = []

    function toWorld(clientX: number, clientY: number): THREE.Vector3 | null {
      const rect = mount.getBoundingClientRect()
      ptr.x = ((clientX - rect.left) / rect.width) * 2 - 1
      ptr.y = -((clientY - rect.top) / rect.height) * 2 + 1
      raycaster.setFromCamera(ptr, camera)
      const pt = new THREE.Vector3()
      return raycaster.ray.intersectPlane(grabPlane, pt) ? pt : null
    }

    function hitMyDie(clientX: number, clientY: number): boolean {
      const rect = mount.getBoundingClientRect()
      ptr.x = ((clientX - rect.left) / rect.width) * 2 - 1
      ptr.y = -((clientY - rect.top) / rect.height) * 2 + 1
      raycaster.setFromCamera(ptr, camera)
      return raycaster.intersectObject(myMesh).length > 0
    }

    const onDown = (e: PointerEvent) => {
      if (myThrown) return
      if (!hitMyDie(e.clientX, e.clientY)) return
      grabbed = true
      mount.setPointerCapture(e.pointerId)
      setHint('hold')
      myBody.velocity.setZero()
      myBody.angularVelocity.set(
        (Math.random() - 0.5) * GRAB_SPIN,
        (Math.random() - 0.5) * GRAB_SPIN,
        (Math.random() - 0.5) * GRAB_SPIN
      )
      myBody.wakeUp()
      const pt = toWorld(e.clientX, e.clientY)
      if (pt) { grabPos.copy(pt); samples.length = 0 }
    }

    const onMove = (e: PointerEvent) => {
      if (!grabbed) return
      const pt = toWorld(e.clientX, e.clientY)
      if (!pt) return
      pt.x = Math.max(-TW / 2 + HALF, Math.min(TW / 2 - HALF, pt.x))
      // 내 영역(z > 0)으로만 드래그 허용 — 분리벽(z=0) 너머로 못 넘어감
      pt.z = Math.max(HALF + 0.1, Math.min(TD / 2 - HALF, pt.z))
      grabPos.copy(pt)
      samples.push({ x: pt.x, z: pt.z, t: performance.now() })
      if (samples.length > 8) samples.shift()
    }

    const onUp = () => {
      if (!grabbed) return
      grabbed = false
      let vx = 0, vz = 0
      if (samples.length >= 2) {
        const a = samples[samples.length - 2]
        const b = samples[samples.length - 1]
        const dt = Math.max((b.t - a.t) / 1000, 0.008)
        vx = (b.x - a.x) / dt
        vz = (b.z - a.z) / dt
      }
      const spd = Math.sqrt(vx * vx + vz * vz)
      samples.length = 0

      if (spd > 0.8) {
        myThrown = true
        setHint('wait')
        setRevealStage('rolling')
        const cap = 15
        // 던질 때 각도 다변화: 주축 + 약간의 다른 축 혼합
        const dominant = 20 + Math.random() * 10
        myBody.velocity.set(
          Math.max(-cap, Math.min(cap, vx)),
          0.5 + Math.random() * 0.5,
          Math.max(-cap, Math.min(cap, vz)),
        )
        myBody.angularVelocity.set(
          (Math.random() - 0.5) * dominant,
          (Math.random() - 0.5) * dominant * 0.6,
          (Math.random() - 0.5) * dominant
        )
        myBody.wakeUp()
      } else {
        myBody.velocity.setZero()
        myBody.wakeUp()
        setHint('grab')
      }
    }

    mount.addEventListener('pointerdown', onDown)
    mount.addEventListener('pointermove', onMove)
    mount.addEventListener('pointerup', onUp)
    mount.addEventListener('pointerleave', onUp)
    mount.addEventListener('pointercancel', onUp)

    let mySettled = false, oppSettled = false
    let myVal = 0, oppVal = 0
    let myF = 0, oppF = 0
    let resultRevealStart = 0
    const revealTarget = new THREE.Vector3(0, RESULT_Y, 0)
    const settledQuaternion = new THREE.Quaternion()
    let myThrownFrames = 0

    // 착지 후 wobble 상태
    let wobbleActive = false
    let wobbleT = 0
    const WOBBLE_DURATION = 0.45

    function forceSettleDie(body: CANNON.Body, die: Die, zMin: number, zMax: number): number {
      const up = new CANNON.Vec3(0, 1, 0)
      let bestDot = -Infinity, topFi = 0
      FACE_NORMALS_C.forEach((n, fi) => {
        const d = body.quaternion.vmult(n).dot(up)
        if (d > bestDot) { bestDot = d; topFi = fi }
      })
      body.position.set(
        Math.max(-TW / 2 + HALF + 0.3, Math.min(TW / 2 - HALF - 0.3, body.position.x)),
        HALF + 0.01,
        Math.max(zMin, Math.min(zMax, body.position.z)),
      )
      const [qx, qy, qz, qw] = SNAP_QUATS[topFi]
      const snapQ = new CANNON.Quaternion(qx, qy, qz, qw)
      const yRot = new CANNON.Quaternion()
      yRot.setFromAxisAngle(new CANNON.Vec3(0, 1, 0), Math.floor(Math.random() * 4) * (Math.PI / 2))
      body.quaternion.copy(yRot.mult(snapQ))
      body.velocity.setZero()
      body.angularVelocity.setZero()
      body.sleep()
      return die.faces[topFi]
    }

    // 각 영역의 Z 범위 상수
    const MY_Z_MIN  = HALF + 0.3
    const MY_Z_MAX  = TD / 2 - HALF - 0.3
    const OPP_Z_MIN = -TD / 2 + HALF + 0.3
    const OPP_Z_MAX = -(HALF + 0.3)

    const clock = new THREE.Clock()
    let rafId: number

    function animate() {
      rafId = requestAnimationFrame(animate)
      const dt = Math.min(clock.getDelta(), 0.05)

      world.step(1 / 60, dt, 3)

      // 낙하 중 공중에 떠 있으면 각 영역 중심으로 유도
      const pushToHalfCenter = (body: CANNON.Body, targetZ: number) => {
        if (body.velocity.lengthSquared() < 0.8 &&
            body.angularVelocity.lengthSquared() < 0.8 &&
            body.position.y > HALF + 0.25) {
          body.velocity.set(-body.position.x * 2, -3, -(body.position.z - targetZ) * 2)
          body.wakeUp()
        }
      }
      if (myThrown && !mySettled) pushToHalfCenter(myBody,  TD / 4)   // 내 절반 중심
      if (!oppSettled)            pushToHalfCenter(oppBody, -TD / 4)  // 상대 절반 중심

      if (grabbed) {
        myBody.position.set(grabPos.x, GRAB_Y, grabPos.z)
        myBody.velocity.setZero()
        myBody.angularVelocity.set(GRAB_SPIN * 0.8, GRAB_SPIN, GRAB_SPIN * 0.9)
        myBody.wakeUp()
      }

      myMesh.position.copy(myBody.position as unknown as THREE.Vector3)
      myMesh.quaternion.copy(myBody.quaternion as unknown as THREE.Quaternion)
      oppMesh.position.copy(oppBody.position as unknown as THREE.Vector3)
      oppMesh.quaternion.copy(oppBody.quaternion as unknown as THREE.Quaternion)

      // 내 주사위 결과 공개 이동 (결과 중앙으로)
      if (resultRevealStart > 0) {
        const revealT = Math.min((performance.now() - resultRevealStart) / 260, 1)
        myMesh.position.lerp(revealTarget, revealT)
        myMesh.quaternion.slerp(settledQuaternion, revealT)
      }

      // wobble 애니메이션: 착지 직후 미세한 Z축 흔들림
      if (wobbleActive) {
        wobbleT += dt
        const progress = wobbleT / WOBBLE_DURATION
        if (progress >= 1) {
          wobbleActive = false
        } else {
          const decay = 1 - progress
          const angle = Math.sin(progress * Math.PI * 5) * 0.08 * decay
          const wobbleQ = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(1, 0, 0), angle)
          myMesh.quaternion.multiply(wobbleQ)
        }
      }

      if (!resultFired.current && myThrown) {
        myThrownFrames++

        const mySt = myBody.velocity.lengthSquared() < 0.02 && myBody.angularVelocity.lengthSquared() < 0.02
        myF = mySt ? myF + 1 : 0
        if (!mySettled && myF > 45) {
          const topFace = readSettledTopFace(myBody, myDie)
          if (topFace !== null) {
            mySettled = true
            myVal = topFace
            // 착지 wobble 트리거
            wobbleActive = true
            wobbleT = 0
          }
        }

        const oppSt = oppBody.velocity.lengthSquared() < 0.02 && oppBody.angularVelocity.lengthSquared() < 0.02
        oppF = oppSt ? oppF + 1 : 0
        if (!oppSettled && oppF > 45) {
          const topFace = readSettledTopFace(oppBody, oppDie)
          if (topFace !== null) {
            oppSettled = true
            oppVal = topFace
          }
        }

        if (!mySettled && myThrownFrames > 240) {
          myVal = forceSettleDie(myBody, myDie, MY_Z_MIN, MY_Z_MAX)
          mySettled = true
        }
        if (!oppSettled && myThrownFrames > 240) {
          oppVal = forceSettleDie(oppBody, oppDie, OPP_Z_MIN, OPP_Z_MAX)
          oppSettled = true
        }

        if (mySettled && oppSettled && !resultFired.current) {
          resultFired.current = true
          resultRevealStart = performance.now()
          settledQuaternion.copy(myMesh.quaternion)
          // triggerReveal은 React 외부에서 직접 호출할 수 없으므로 이벤트로 전달
          mount.dispatchEvent(new CustomEvent('diceSettled', { detail: { myVal, oppVal } }))
        }
      }

      renderer.render(scene, camera)
    }
    animate()

    // 정착 이벤트 수신
    const onSettled = (e: Event) => {
      const { myVal, oppVal } = (e as CustomEvent).detail
      triggerReveal(myVal, oppVal)
    }
    mount.addEventListener('diceSettled', onSettled)

    const ro = new ResizeObserver(() => {
      const w = mount.clientWidth, h = mount.clientHeight
      const a = w / h
      const hH = TD / 2 + 0.4
      const hW = hH * a
      const cam = camera as THREE.OrthographicCamera
      cam.left = -hW; cam.right = hW; cam.top = hH; cam.bottom = -hH
      cam.updateProjectionMatrix()
      renderer.setSize(w, h)
    })
    ro.observe(mount)

    return () => {
      cancelAnimationFrame(rafId)
      mount.removeEventListener('pointerdown', onDown)
      mount.removeEventListener('pointermove', onMove)
      mount.removeEventListener('pointerup', onUp)
      mount.removeEventListener('pointerleave', onUp)
      mount.removeEventListener('pointercancel', onUp)
      mount.removeEventListener('diceSettled', onSettled)
      ro.disconnect()
      renderer.dispose()
      if (mount.contains(renderer.domElement)) mount.removeChild(renderer.domElement)
    }
  }, [])  // eslint-disable-line react-hooks/exhaustive-deps

  const hintText: Record<string, string> = {
    grab: '주사위를 잡고 던지세요',
    hold: '드래그해서 던지세요',
    wait: '...',
    done: '',
  }

  // 뱃지에 표시할 값 계산
  const badgeContent = (() => {
    if (revealStage === 'idle' || revealStage === 'rolling') return null
    if (revealStage === 'suspense') return '?'
    if (revealStage === 'revealing') return flipCount % 2 === 0 ? '?' : (displayValue ?? '?')
    return displayValue
  })()

  return (
    <div style={{ position: 'relative', width: '100%', height: '100%' }}>
      <div ref={mountRef} style={{ position: 'fixed', inset: 0, touchAction: 'none', zIndex: 0 }} />

      {hint !== 'done' && revealStage !== 'suspense' && revealStage !== 'revealing' && (
        <div style={{
          position: 'fixed', bottom: 48, left: '50%', transform: 'translateX(-50%)',
          background: 'rgba(0,0,0,0.55)', color: '#fff',
          padding: '5px 14px', borderRadius: 20, fontSize: 13, fontWeight: 500,
          pointerEvents: 'none', whiteSpace: 'nowrap', zIndex: 1,
        }}>{hintText[hint]}</div>
      )}

      {/* suspense 메시지 */}
      {revealStage === 'suspense' && (
        <div style={{
          position: 'fixed', bottom: 48, left: '50%', transform: 'translateX(-50%)',
          background: 'rgba(0,0,0,0.7)', color: '#fbbf24',
          padding: '6px 18px', borderRadius: 20, fontSize: 14, fontWeight: 700,
          pointerEvents: 'none', whiteSpace: 'nowrap', zIndex: 1,
          animation: 'suspensePulse 0.35s ease-in-out infinite alternate',
        }}>결과 공개 중...</div>
      )}

      {/* 결과 뱃지 */}
      {badgeContent !== null && (
        <div style={{
          position: 'fixed',
          top: '50%',
          left: '50%',
          transform: 'translate(-50%, -150%)',
          minWidth: 72,
          height: 72,
          padding: '0 20px',
          borderRadius: 24,
          background: revealStage === 'done'
            ? 'rgba(255,255,255,0.97)'
            : 'rgba(30,30,30,0.88)',
          border: revealStage === 'done'
            ? '2px solid rgba(37,99,235,0.3)'
            : '2px solid rgba(251,191,36,0.6)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          fontSize: 34,
          fontWeight: 900,
          color: revealStage === 'done' ? '#1d4ed8' : '#fbbf24',
          pointerEvents: 'none',
          zIndex: 3,
          backdropFilter: 'blur(8px)',
          transition: 'background 0.3s, color 0.3s, border-color 0.3s',
          animation: revealStage === 'done' ? 'badgePop 0.3s cubic-bezier(0.34,1.56,0.64,1)' : 'none',
        }}>
          {badgeContent}
        </div>
      )}

      <style>{`
        @keyframes suspensePulse {
          from { opacity: 0.7; transform: translateX(-50%) scale(0.97); }
          to   { opacity: 1;   transform: translateX(-50%) scale(1.03); }
        }
        @keyframes badgePop {
          0%   { transform: translate(-50%, -150%) scale(0.7); }
          60%  { transform: translate(-50%, -150%) scale(1.12); }
          100% { transform: translate(-50%, -150%) scale(1); }
        }
      `}</style>
    </div>
  )
}
