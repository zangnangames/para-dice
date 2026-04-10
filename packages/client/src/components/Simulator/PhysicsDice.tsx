import { useEffect, useRef, useState } from 'react'
import * as THREE from 'three'
import * as CANNON from 'cannon-es'
import type { Die } from '@dice-game/core'

const HALF = 0.5
const GRAB_Y = 2.2   // 잡았을 때 높이
const IDLE_Y = 6
const GRAB_SPIN = 24
const RESULT_Y = 1.8
const RESULT_DELAY_MS = 1100

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

// 각 면(fi)이 위를 향하도록 만드는 스냅 쿼터니언 (axis-angle 공식으로 검증)
// fi=0: (0,1,0)→up identity / fi=1: (-1,0,0)→up rotateZ(-90°)
// fi=2: (0,0,1)→up rotateX(-90°) / fi=3: (1,0,0)→up rotateZ(90°)
// fi=4: (0,0,-1)→up rotateX(90°) / fi=5: (0,-1,0)→up rotateX(180°)
const SQ2 = Math.SQRT1_2
const SNAP_QUATS: [number, number, number, number][] = [
  [0, 0, 0, 1],
  [0, 0, -SQ2, SQ2],
  [-SQ2, 0, 0, SQ2],
  [0, 0, SQ2, SQ2],
  [SQ2, 0, 0, SQ2],
  [1, 0, 0, 0],
]

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
  const mesh = new THREE.Mesh(geo, mats)
  return mesh
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
  const bodyNearFloor = body.position.y <= HALF + 0.08
  const faceFlatOnFloor = best >= 0.96
  if (!bodyNearFloor || !faceFlatOnFloor) return null
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
  const [centerValue, setCenterValue] = useState<number | null>(null)
  const resultFired = useRef(false)

  useEffect(() => {
    const mount = mountRef.current!
    const W = mount.clientWidth
    const H = mount.clientHeight
    const TW = 5, TD = 8.5

    // ── Renderer ─────────────────────────────────────────
    const renderer = new THREE.WebGLRenderer({ antialias: true })
    renderer.setSize(W, H)
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2))
    renderer.setClearColor(0xdde3ee)
    mount.appendChild(renderer.domElement)

    const scene = new THREE.Scene()

    // ── 탑뷰 오쏘그래픽 카메라 (왜곡 없음) ──────────────
    function makeCamera(w: number, h: number) {
      const a = w / h
      const hH = TD / 2 + 0.4
      const hW = hH * a
      const cam = new THREE.OrthographicCamera(-hW, hW, hH, -hH, 0.1, 100)
      cam.up.set(0, 0, -1)   // 화면 위 = 월드 -Z (상대방 쪽)
      cam.position.set(0, 30, 0)
      cam.lookAt(0, 0, 0)
      return cam
    }
    const camera = makeCamera(W, H)
    scene.add(camera)

    // ── 조명 ─────────────────────────────────────────────
    scene.add(new THREE.AmbientLight(0xffffff, 1.1))
    const dir = new THREE.DirectionalLight(0xffffff, 1.4)
    dir.position.set(3, 12, 4)
    scene.add(dir)

    // ── 테이블 ────────────────────────────────────────────
    const tableMesh = new THREE.Mesh(
      new THREE.PlaneGeometry(TW, TD),
      new THREE.MeshStandardMaterial({ color: 0xe2e8f2, roughness: 0.92 })
    )
    tableMesh.rotation.x = -Math.PI / 2
    scene.add(tableMesh)

    // 그리드
    const grid = new THREE.GridHelper(Math.max(TW, TD), 10, 0xb8c3d4, 0xb8c3d4)
    grid.position.y = 0.001
    scene.add(grid)

    // 구분선
    const divPts = [new THREE.Vector3(-TW / 2, 0.003, 0), new THREE.Vector3(TW / 2, 0.003, 0)]
    scene.add(new THREE.Line(
      new THREE.BufferGeometry().setFromPoints(divPts),
      new THREE.LineBasicMaterial({ color: 0x7c8fa8, linewidth: 2 })
    ))

    // ── Cannon world ──────────────────────────────────────
    const world = new CANNON.World({ gravity: new CANNON.Vec3(0, -28, 0) })
    world.broadphase = new CANNON.NaiveBroadphase()
    world.allowSleep = true

    const phyMat = new CANNON.Material({ friction: 0.55, restitution: 0.22 })

    const ground = new CANNON.Body({ mass: 0, material: phyMat })
    ground.addShape(new CANNON.Plane())
    ground.quaternion.setFromEuler(-Math.PI / 2, 0, 0)
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
      world.addBody(b)
    })

    // ── 주사위 생성 ───────────────────────────────────────
    const myBody = createDieBody(0, 0)
    world.addBody(myBody)
    const myMesh = createDieMesh(myDie)
    scene.add(myMesh)
    myBody.position.set(0, IDLE_Y, 0)
    myBody.velocity.setZero()
    myBody.angularVelocity.setZero()
    myBody.sleep()

    const oppBody = createDieBody(0, -2.8)
    world.addBody(oppBody)

    // 상대 자동 투척
    setTimeout(() => {
      oppBody.velocity.set((Math.random() - 0.5) * 5, 4, 3.5 + Math.random() * 2)
      oppBody.angularVelocity.set(
        (Math.random() - 0.5) * 22, (Math.random() - 0.5) * 22, (Math.random() - 0.5) * 22
      )
      oppBody.wakeUp()
    }, 400)

    // ── 인터랙션 ─────────────────────────────────────────
    const raycaster = new THREE.Raycaster()
    const ptr = new THREE.Vector2()
    const grabPlane = new THREE.Plane(new THREE.Vector3(0, 1, 0), -GRAB_Y)

    let grabbed = false
    let myThrown = false
    const grabPos = new THREE.Vector3()   // 현재 잡은 월드 좌표

    // 던지기 속도 추적
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

      // 위로 들어올리기
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
      pt.z = Math.max(-TD / 2 + HALF, Math.min(TD / 2 - HALF, pt.z))
      grabPos.copy(pt)
      samples.push({ x: pt.x, z: pt.z, t: performance.now() })
      if (samples.length > 8) samples.shift()
    }

    const onUp = () => {
      if (!grabbed) return
      grabbed = false

      // 최근 두 샘플로 속도 계산
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
        const cap = 15
        myBody.velocity.set(
          Math.max(-cap, Math.min(cap, vx)),
          0,
          Math.max(-cap, Math.min(cap, vz)),
        )
        myBody.angularVelocity.set(
          (Math.random() - 0.5) * 24, (Math.random() - 0.5) * 24, (Math.random() - 0.5) * 24
        )
        myBody.wakeUp()
      } else {
        // 제자리에서 떨구기
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

    // ── 정착 감지 ─────────────────────────────────────────
    let mySettled = false, oppSettled = false
    let myVal = 0, oppVal = 0
    let myF = 0, oppF = 0
    let resultRevealStart = 0
    const revealTarget = new THREE.Vector3(0, RESULT_Y, 0)
    const settledQuaternion = new THREE.Quaternion()

    // 던진 후 경과 프레임 (타임아웃 강제 정착용)
    let myThrownFrames = 0

    // 현재 가장 위를 향한 면으로 자세를 스냅하고 해당 면의 값을 반환
    function forceSettleDie(body: CANNON.Body, die: Die): number {
      const up = new CANNON.Vec3(0, 1, 0)
      let bestDot = -Infinity, topFi = 0
      FACE_NORMALS_C.forEach((n, fi) => {
        const d = body.quaternion.vmult(n).dot(up)
        if (d > bestDot) { bestDot = d; topFi = fi }
      })
      // 바닥 위 안전한 범위로 위치 고정
      body.position.set(
        Math.max(-TW / 2 + HALF + 0.3, Math.min(TW / 2 - HALF - 0.3, body.position.x)),
        HALF + 0.01,
        Math.max(-TD / 2 + HALF + 0.3, Math.min(TD / 2 - HALF - 0.3, body.position.z)),
      )
      // 90° 단위 랜덤 Y회전 + 면 스냅
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

    // ── 애니메이션 루프 ───────────────────────────────────
    const clock = new THREE.Clock()
    let rafId: number

    let spinT = 0

    function animate() {
      rafId = requestAnimationFrame(animate)
      const dt = Math.min(clock.getDelta(), 0.05)
      spinT += dt

      world.step(1 / 60, dt, 3)

      // 벽 끼임 보정: 거의 정지 상태인데 바닥에 없으면 중앙 방향으로 밀기
      const pushToCenter = (body: CANNON.Body) => {
        if (body.velocity.lengthSquared() < 0.8 &&
            body.angularVelocity.lengthSquared() < 0.8 &&
            body.position.y > HALF + 0.25) {
          body.velocity.set(-body.position.x * 2, -3, -body.position.z * 2)
          body.wakeUp()
        }
      }
      if (myThrown && !mySettled) pushToCenter(myBody)
      if (!oppSettled) pushToCenter(oppBody)

      // 잡은 동안: 위치 강제 고정 + 자연스러운 회전
      if (grabbed) {
        myBody.position.set(grabPos.x, GRAB_Y, grabPos.z)
        myBody.velocity.setZero()
        myBody.angularVelocity.set(
          GRAB_SPIN * 0.8,
          GRAB_SPIN,
          GRAB_SPIN * 0.9
        )
        myBody.wakeUp()
      }

      myMesh.position.copy(myBody.position as unknown as THREE.Vector3)
      myMesh.quaternion.copy(myBody.quaternion as unknown as THREE.Quaternion)

      if (resultRevealStart > 0) {
        const revealT = Math.min((performance.now() - resultRevealStart) / 260, 1)
        myMesh.position.lerp(revealTarget, revealT)
        myMesh.quaternion.slerp(settledQuaternion, revealT)
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

        // 타임아웃 강제 정착: 4초(~240프레임) 이상 미해결 시 가장 가까운 면으로 스냅
        if (!mySettled && myThrownFrames > 240) {
          myVal = forceSettleDie(myBody, myDie)
          mySettled = true
        }
        if (!oppSettled && myThrownFrames > 240) {
          oppVal = forceSettleDie(oppBody, oppDie)
          oppSettled = true
        }

        if (mySettled && oppSettled) {
          resultFired.current = true
          setHint('done')
          resultRevealStart = performance.now()
          settledQuaternion.copy(myMesh.quaternion)
          setCenterValue(myVal)
          setTimeout(() => onResult(myVal, oppVal), RESULT_DELAY_MS)
        }
      }

      renderer.render(scene, camera)
    }
    animate()

    // ── 리사이즈 ──────────────────────────────────────────
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
      ro.disconnect()
      renderer.dispose()
      if (mount.contains(renderer.domElement)) mount.removeChild(renderer.domElement)
    }
  }, [])  // eslint-disable-line react-hooks/exhaustive-deps

  const hintText = {
    grab: '주사위를 잡고 던지세요',
    hold: '드래그해서 던지세요',
    wait: '...',
    done: '',
  }

  return (
    <div style={{ position: 'relative', width: '100%', height: '100%' }}>
      <div ref={mountRef} style={{ position: 'fixed', inset: 0, touchAction: 'none', zIndex: 0 }} />

      {hint !== 'done' && (
        <div style={{
          position: 'fixed', bottom: 48, left: '50%', transform: 'translateX(-50%)',
          background: 'rgba(0,0,0,0.55)', color: '#fff',
          padding: '5px 14px', borderRadius: 20, fontSize: 13, fontWeight: 500,
          pointerEvents: 'none', whiteSpace: 'nowrap', zIndex: 1,
        }}>{hintText[hint]}</div>
      )}

      {centerValue !== null && (
        <div style={{
          position: 'fixed',
          top: '50%',
          left: '50%',
          transform: 'translate(-50%, -150%)',
          minWidth: 72,
          height: 72,
          padding: '0 20px',
          borderRadius: 24,
          background: 'rgba(255,255,255,0.95)',
          border: '1px solid rgba(37,99,235,0.15)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          fontSize: 34,
          fontWeight: 900,
          color: '#1d4ed8',
          pointerEvents: 'none',
          zIndex: 3,
          backdropFilter: 'blur(8px)',
        }}>
          {centerValue}
        </div>
      )}

    </div>
  )
}
