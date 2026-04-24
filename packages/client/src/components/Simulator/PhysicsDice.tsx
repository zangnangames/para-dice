import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import * as THREE from 'three'
import * as CANNON from 'cannon-es'
import { rollDie } from '@dice-game/core'
import type { Die } from '@dice-game/core'

const FACE_COLORS = ['#fef9c3', '#dbeafe', '#dcfce7', '#fee2e2', '#ede9fe', '#fed7aa']

interface PhysicsDiceProps {
  myDice: Die[]
  oppDice: Die[]
  onResult: (myVals: number[], oppVals: number[]) => void
}

export function PhysicsDice({ myDice, oppDice, onResult }: PhysicsDiceProps) {
  if (myDice.length === 1 && oppDice.length === 1) {
    return (
      <SingleDiePhysicsDice3D
        myDie={myDice[0]}
        oppDie={oppDice[0]}
        onResult={(myVal, oppVal) => onResult([myVal], [oppVal])}
      />
    )
  }

  return <MultiDieBattle2D myDice={myDice} oppDice={oppDice} onResult={onResult} />
}

function MultiDieBattle2D({ myDice, oppDice, onResult }: PhysicsDiceProps) {
  const [myPreview, setMyPreview] = useState<number[]>(() => myDice.map(() => 1))
  const [oppPreview, setOppPreview] = useState<number[]>(() => oppDice.map(() => 1))
  const [revealed, setRevealed] = useState(false)
  const finalMy = useMemo(() => myDice.map(rollDie), [myDice])
  const finalOpp = useMemo(() => oppDice.map(rollDie), [oppDice])

  useEffect(() => {
    setRevealed(false)
    const previewInterval = setInterval(() => {
      setMyPreview(myDice.map(() => 1 + Math.floor(Math.random() * 6)))
      setOppPreview(oppDice.map(() => 1 + Math.floor(Math.random() * 6)))
    }, 90)

    const revealTimer = setTimeout(() => {
      clearInterval(previewInterval)
      setMyPreview(finalMy)
      setOppPreview(finalOpp)
      setRevealed(true)
    }, 1200)

    const resultTimer = setTimeout(() => {
      onResult(finalMy, finalOpp)
    }, 1750)

    return () => {
      clearInterval(previewInterval)
      clearTimeout(revealTimer)
      clearTimeout(resultTimer)
    }
  }, [finalMy, finalOpp, myDice, onResult, oppDice])

  return (
    <div style={{
      minHeight: '100%',
      background: 'linear-gradient(180deg, #f8fbff 0%, #eef4ff 38%, #fff8ef 100%)',
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      padding: '96px 20px 72px',
      gap: 32,
      overflow: 'hidden',
    }}>
      <BattleLane
        label="상대"
        color="#c2410c"
        bg="rgba(255,247,237,0.88)"
        dice={oppDice}
        values={oppPreview}
        revealed={revealed}
      />
      <div style={{
        width: 72,
        height: 72,
        borderRadius: '50%',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        background: revealed ? 'rgba(37,99,235,0.12)' : 'rgba(148,163,184,0.12)',
        color: revealed ? '#1d4ed8' : '#64748b',
        fontSize: 20,
        fontWeight: 900,
        letterSpacing: '0.08em',
        transition: 'all 0.2s ease',
      }}>
        VS
      </div>
      <BattleLane
        label="나"
        color="#1d4ed8"
        bg="rgba(239,246,255,0.92)"
        dice={myDice}
        values={myPreview}
        revealed={revealed}
      />
    </div>
  )
}

function BattleLane({
  label,
  color,
  bg,
  dice,
  values,
  revealed,
}: {
  label: string
  color: string
  bg: string
  dice: Die[]
  values: number[]
  revealed: boolean
}) {
  const total = values.reduce((sum, value) => sum + value, 0)

  return (
    <div style={{
      width: 'min(92vw, 420px)',
      padding: '18px 16px 16px',
      borderRadius: 24,
      background: bg,
      border: '1px solid rgba(148,163,184,0.2)',
      boxShadow: '0 12px 34px rgba(15,23,42,0.08)',
    }}>
      <div style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        marginBottom: 14,
      }}>
        <span style={{ fontSize: 13, fontWeight: 800, color, letterSpacing: '0.08em' }}>{label}</span>
        <span style={{
          minWidth: 58,
          textAlign: 'center',
          padding: '6px 12px',
          borderRadius: 999,
          background: revealed ? color : '#cbd5e1',
          color: '#fff',
          fontSize: 13,
          fontWeight: 800,
          transition: 'background 0.2s ease',
        }}>
          합 {total}
        </span>
      </div>

      <div style={{
        display: 'grid',
        gridTemplateColumns: `repeat(${dice.length}, minmax(0, 1fr))`,
        gap: 12,
      }}>
        {dice.map((die, index) => (
          <AnimatedDieCard
            key={die.id}
            die={die}
            value={values[index] ?? 1}
            revealed={revealed}
            accent={color}
          />
        ))}
      </div>
    </div>
  )
}

function AnimatedDieCard({
  die,
  value,
  revealed,
  accent,
}: {
  die: Die
  value: number
  revealed: boolean
  accent: string
}) {
  return (
    <div style={{
      borderRadius: 18,
      padding: '14px 10px 12px',
      background: '#fff',
      border: `1.5px solid ${revealed ? accent : '#e2e8f0'}`,
      transform: revealed ? 'translateY(0)' : `translateY(${Math.sin(value) * 4}px) rotate(${(value - 3) * 2}deg)`,
      transition: 'transform 0.12s linear, border-color 0.2s ease',
    }}>
      <div style={{
        width: 60,
        height: 60,
        margin: '0 auto 10px',
        borderRadius: 18,
        background: revealed ? accent : '#0f172a',
        color: '#fff',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        fontSize: 30,
        fontWeight: 900,
        boxShadow: revealed ? `0 10px 20px ${accent}33` : '0 10px 20px rgba(15,23,42,0.18)',
        transition: 'background 0.2s ease, box-shadow 0.2s ease',
      }}>
        {value}
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 4 }}>
        {[...die.faces].sort((a, b) => b - a).map((face, index) => (
          <span
            key={`${die.id}-${index}`}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              justifyContent: 'center',
              height: 22,
              borderRadius: 6,
              background: FACE_COLORS[index],
              border: '1px solid rgba(15,23,42,0.08)',
              fontSize: 10,
              fontWeight: 800,
              color: '#1e293b',
            }}
          >
            {face}
          </span>
        ))}
      </div>
    </div>
  )
}

const HALF = 0.5
const GRAB_Y = 2.2
const IDLE_Y = 6
const GRAB_SPIN = 24
const RESULT_Y = 1.8
const GRP_MY = 1
const GRP_OPP = 2
const GRP_ENV = 4
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

type RevealStage = 'idle' | 'rolling' | 'suspense' | 'revealing' | 'done'

function makeTexture(value: number, color: string): THREE.CanvasTexture {
  const canvas = document.createElement('canvas')
  canvas.width = canvas.height = 256
  const ctx = canvas.getContext('2d')!
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
  return new THREE.CanvasTexture(canvas)
}

function createDieMesh(die: Die): THREE.Mesh {
  const geo = new THREE.BoxGeometry(HALF * 2, HALF * 2, HALF * 2)
  const mats: THREE.MeshStandardMaterial[] = new Array(6)
  die.faces.forEach((val, fi) => {
    mats[FI_TO_MAT[fi]] = new THREE.MeshStandardMaterial({
      map: makeTexture(val, FACE_COLORS[fi]),
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
    Math.random() * Math.PI,
    Math.random() * Math.PI,
    Math.random() * Math.PI,
  )
  return body
}

function readSettledTopFace(body: CANNON.Body, die: Die): number | null {
  const down = new CANNON.Vec3(0, -1, 0)
  let best = -Infinity
  let bottomFi = 0
  FACE_NORMALS_C.forEach((n, fi) => {
    const d = body.quaternion.vmult(n).dot(down)
    if (d > best) {
      best = d
      bottomFi = fi
    }
  })
  if (body.position.y > HALF + 0.08 || best < 0.96) return null
  return die.faces[OPPOSITE_FACE_INDEX[bottomFi]]
}

interface SingleDiePhysicsDice3DProps {
  myDie: Die
  oppDie: Die
  onResult: (myVal: number, oppVal: number) => void
}

function SingleDiePhysicsDice3D({ myDie, oppDie, onResult }: SingleDiePhysicsDice3DProps) {
  const mountRef = useRef<HTMLDivElement>(null)
  const onResultRef = useRef(onResult)
  const [hint, setHint] = useState<'grab' | 'hold' | 'wait' | 'done'>('grab')
  const [revealStage, setRevealStage] = useState<RevealStage>('idle')
  const [displayValue, setDisplayValue] = useState<number | null>(null)
  const resultFired = useRef(false)
  const [flipCount, setFlipCount] = useState(0)

  useEffect(() => {
    onResultRef.current = onResult
  }, [onResult])

  const triggerReveal = useCallback((myVal: number, oppVal: number) => {
    setRevealStage('suspense')
    setDisplayValue(null)

    setTimeout(() => {
      setRevealStage('revealing')
      let count = 0
      const interval = window.setInterval(() => {
        setFlipCount((value) => value + 1)
        count += 1
        if (count >= 5) {
          clearInterval(interval)
          setDisplayValue(myVal)
          setRevealStage('done')
          setHint('done')
          setTimeout(() => onResultRef.current(myVal, oppVal), 600)
        }
      }, 80)
    }, 700)
  }, [])

  useEffect(() => {
    const mount = mountRef.current
    if (!mount) return
    const mountEl = mount

    const width = mountEl.clientWidth
    const height = mountEl.clientHeight
    const tableWidth = 5
    const tableDepth = 8.5

    const renderer = new THREE.WebGLRenderer({ antialias: true })
    renderer.setSize(width, height)
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2))
    renderer.setClearColor(0xdde3ee)
    mountEl.appendChild(renderer.domElement)

    const scene = new THREE.Scene()

    function makeCamera(w: number, h: number) {
      const aspect = w / h
      const halfH = tableDepth / 2 + 0.4
      const halfW = halfH * aspect
      const cam = new THREE.OrthographicCamera(-halfW, halfW, halfH, -halfH, 0.1, 100)
      cam.up.set(0, 0, -1)
      cam.position.set(0, 30, 0)
      cam.lookAt(0, 0, 0)
      return cam
    }

    const camera = makeCamera(width, height)
    scene.add(camera)

    scene.add(new THREE.AmbientLight(0xffffff, 1.1))
    const dir = new THREE.DirectionalLight(0xffffff, 1.4)
    dir.position.set(3, 12, 4)
    scene.add(dir)

    const tableMesh = new THREE.Mesh(
      new THREE.PlaneGeometry(tableWidth, tableDepth),
      new THREE.MeshStandardMaterial({ color: 0xe2e8f2, roughness: 0.92 }),
    )
    tableMesh.rotation.x = -Math.PI / 2
    scene.add(tableMesh)

    const grid = new THREE.GridHelper(Math.max(tableWidth, tableDepth), 10, 0xb8c3d4, 0xb8c3d4)
    grid.position.y = 0.001
    scene.add(grid)

    const dividerPoints = [
      new THREE.Vector3(-tableWidth / 2, 0.003, 0),
      new THREE.Vector3(tableWidth / 2, 0.003, 0),
    ]
    scene.add(new THREE.Line(
      new THREE.BufferGeometry().setFromPoints(dividerPoints),
      new THREE.LineBasicMaterial({ color: 0x7c8fa8, linewidth: 2 }),
    ))

    const world = new CANNON.World({ gravity: new CANNON.Vec3(0, -28, 0) })
    world.broadphase = new CANNON.NaiveBroadphase()
    world.allowSleep = true

    const phyMat = new CANNON.Material({ friction: 0.55, restitution: 0.22 })

    const ground = new CANNON.Body({ mass: 0, material: phyMat })
    ground.addShape(new CANNON.Plane())
    ground.quaternion.setFromEuler(-Math.PI / 2, 0, 0)
    ground.collisionFilterGroup = GRP_ENV
    ground.collisionFilterMask = GRP_MY | GRP_OPP | GRP_ENV
    world.addBody(ground)

    const wallDefs: [number, number, number, number, number, number][] = [
      [-tableWidth / 2, 2, 0, 0, Math.PI / 2, 0],
      [tableWidth / 2, 2, 0, 0, -Math.PI / 2, 0],
      [0, 2, tableDepth / 2, 0, Math.PI, 0],
      [0, 2, -tableDepth / 2, 0, 0, 0],
    ]
    wallDefs.forEach(([px, py, pz, ex, ey, ez]) => {
      const body = new CANNON.Body({ mass: 0, material: phyMat })
      body.addShape(new CANNON.Plane())
      body.position.set(px, py, pz)
      body.quaternion.setFromEuler(ex, ey, ez)
      body.collisionFilterGroup = GRP_ENV
      body.collisionFilterMask = GRP_MY | GRP_OPP | GRP_ENV
      world.addBody(body)
    })

    const dividerBody = new CANNON.Body({ mass: 0, material: phyMat })
    dividerBody.addShape(new CANNON.Box(new CANNON.Vec3(tableWidth / 2 + 0.1, 2, 0.04)))
    dividerBody.position.set(0, 1, 0)
    dividerBody.collisionFilterGroup = GRP_ENV
    dividerBody.collisionFilterMask = GRP_MY | GRP_OPP | GRP_ENV
    world.addBody(dividerBody)

    const myBody = createDieBody(0, tableDepth / 4)
    myBody.collisionFilterGroup = GRP_MY
    myBody.collisionFilterMask = GRP_ENV
    world.addBody(myBody)
    const myMesh = createDieMesh(myDie)
    scene.add(myMesh)
    myBody.position.set(0, IDLE_Y, tableDepth / 4)
    myBody.velocity.setZero()
    myBody.angularVelocity.setZero()
    myBody.sleep()

    const oppBody = createDieBody(0, -tableDepth / 4)
    oppBody.collisionFilterGroup = GRP_OPP
    oppBody.collisionFilterMask = GRP_ENV
    world.addBody(oppBody)
    const oppMesh = createDieMesh(oppDie)
    scene.add(oppMesh)
    oppBody.position.set((Math.random() - 0.5) * 1.2, IDLE_Y + 1, -tableDepth / 2 + 0.5)
    oppBody.sleep()

    const oppDelay = 300 + Math.random() * 300
    const oppTimeout = window.setTimeout(() => {
      const vx = (Math.random() - 0.5) * 6
      const vz = 3.5 + Math.random() * 3
      const spin = 18 + Math.random() * 14
      oppBody.velocity.set(vx, 3 + Math.random() * 2, vz)
      oppBody.angularVelocity.set(
        (Math.random() - 0.5) * spin,
        (Math.random() - 0.5) * spin,
        (Math.random() - 0.5) * spin,
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
      const rect = mountEl.getBoundingClientRect()
      ptr.x = ((clientX - rect.left) / rect.width) * 2 - 1
      ptr.y = -((clientY - rect.top) / rect.height) * 2 + 1
      raycaster.setFromCamera(ptr, camera)
      const point = new THREE.Vector3()
      return raycaster.ray.intersectPlane(grabPlane, point) ? point : null
    }

    function hitMyDie(clientX: number, clientY: number): boolean {
      const rect = mountEl.getBoundingClientRect()
      ptr.x = ((clientX - rect.left) / rect.width) * 2 - 1
      ptr.y = -((clientY - rect.top) / rect.height) * 2 + 1
      raycaster.setFromCamera(ptr, camera)
      return raycaster.intersectObject(myMesh).length > 0
    }

    const onDown = (e: PointerEvent) => {
      if (myThrown) return
      if (!hitMyDie(e.clientX, e.clientY)) return
      grabbed = true
      mountEl.setPointerCapture(e.pointerId)
      setHint('hold')
      myBody.velocity.setZero()
      myBody.angularVelocity.set(
        (Math.random() - 0.5) * GRAB_SPIN,
        (Math.random() - 0.5) * GRAB_SPIN,
        (Math.random() - 0.5) * GRAB_SPIN,
      )
      myBody.wakeUp()
      const point = toWorld(e.clientX, e.clientY)
      if (point) {
        grabPos.copy(point)
        samples.length = 0
      }
    }

    const onMove = (e: PointerEvent) => {
      if (!grabbed) return
      const point = toWorld(e.clientX, e.clientY)
      if (!point) return
      point.x = Math.max(-tableWidth / 2 + HALF, Math.min(tableWidth / 2 - HALF, point.x))
      point.z = Math.max(HALF + 0.1, Math.min(tableDepth / 2 - HALF, point.z))
      grabPos.copy(point)
      samples.push({ x: point.x, z: point.z, t: performance.now() })
      if (samples.length > 8) samples.shift()
    }

    const onUp = () => {
      if (!grabbed) return
      grabbed = false
      let vx = 0
      let vz = 0
      if (samples.length >= 2) {
        const a = samples[samples.length - 2]
        const b = samples[samples.length - 1]
        const dt = Math.max((b.t - a.t) / 1000, 0.008)
        vx = (b.x - a.x) / dt
        vz = (b.z - a.z) / dt
      }
      const speed = Math.sqrt(vx * vx + vz * vz)
      samples.length = 0

      if (speed > 0.8) {
        myThrown = true
        setHint('wait')
        setRevealStage('rolling')
        const cap = 15
        const dominant = 20 + Math.random() * 10
        myBody.velocity.set(
          Math.max(-cap, Math.min(cap, vx)),
          0.5 + Math.random() * 0.5,
          Math.max(-cap, Math.min(cap, vz)),
        )
        myBody.angularVelocity.set(
          (Math.random() - 0.5) * dominant,
          (Math.random() - 0.5) * dominant * 0.6,
          (Math.random() - 0.5) * dominant,
        )
        myBody.wakeUp()
      } else {
        myBody.velocity.setZero()
        myBody.wakeUp()
        setHint('grab')
      }
    }

    mountEl.addEventListener('pointerdown', onDown)
    mountEl.addEventListener('pointermove', onMove)
    mountEl.addEventListener('pointerup', onUp)
    mountEl.addEventListener('pointerleave', onUp)
    mountEl.addEventListener('pointercancel', onUp)

    let mySettled = false
    let oppSettled = false
    let myVal = 0
    let oppVal = 0
    let myFrames = 0
    let oppFrames = 0
    let resultRevealStart = 0
    const revealTarget = new THREE.Vector3(0, RESULT_Y, 0)
    const settledQuaternion = new THREE.Quaternion()
    let myThrownFrames = 0
    let wobbleActive = false
    let wobbleT = 0
    const WOBBLE_DURATION = 0.45

    function forceSettleDie(body: CANNON.Body, die: Die, zMin: number, zMax: number): number {
      const up = new CANNON.Vec3(0, 1, 0)
      let bestDot = -Infinity
      let topFi = 0
      FACE_NORMALS_C.forEach((n, fi) => {
        const d = body.quaternion.vmult(n).dot(up)
        if (d > bestDot) {
          bestDot = d
          topFi = fi
        }
      })
      body.position.set(
        Math.max(-tableWidth / 2 + HALF + 0.3, Math.min(tableWidth / 2 - HALF - 0.3, body.position.x)),
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

    const MY_Z_MIN = HALF + 0.3
    const MY_Z_MAX = tableDepth / 2 - HALF - 0.3
    const OPP_Z_MIN = -tableDepth / 2 + HALF + 0.3
    const OPP_Z_MAX = -(HALF + 0.3)
    const clock = new THREE.Clock()
    let rafId = 0

    function animate() {
      rafId = requestAnimationFrame(animate)
      const dt = Math.min(clock.getDelta(), 0.05)

      world.step(1 / 60, dt, 3)

      const pushToHalfCenter = (body: CANNON.Body, targetZ: number) => {
        if (
          body.velocity.lengthSquared() < 0.8 &&
          body.angularVelocity.lengthSquared() < 0.8 &&
          body.position.y > HALF + 0.25
        ) {
          body.velocity.set(-body.position.x * 2, -3, -(body.position.z - targetZ) * 2)
          body.wakeUp()
        }
      }
      if (myThrown && !mySettled) pushToHalfCenter(myBody, tableDepth / 4)
      if (!oppSettled) pushToHalfCenter(oppBody, -tableDepth / 4)

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

      if (resultRevealStart > 0) {
        const revealT = Math.min((performance.now() - resultRevealStart) / 260, 1)
        myMesh.position.lerp(revealTarget, revealT)
        myMesh.quaternion.slerp(settledQuaternion, revealT)
      }

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
        myThrownFrames += 1

        const myStill = myBody.velocity.lengthSquared() < 0.02 && myBody.angularVelocity.lengthSquared() < 0.02
        myFrames = myStill ? myFrames + 1 : 0
        if (!mySettled && myFrames > 45) {
          const topFace = readSettledTopFace(myBody, myDie)
          if (topFace !== null) {
            mySettled = true
            myVal = topFace
            wobbleActive = true
            wobbleT = 0
          }
        }

        const oppStill = oppBody.velocity.lengthSquared() < 0.02 && oppBody.angularVelocity.lengthSquared() < 0.02
        oppFrames = oppStill ? oppFrames + 1 : 0
        if (!oppSettled && oppFrames > 45) {
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
          mountEl.dispatchEvent(new CustomEvent('diceSettled', { detail: { myVal, oppVal } }))
        }
      }

      renderer.render(scene, camera)
    }
    animate()

    const onSettled = (event: Event) => {
      const detail = (event as CustomEvent<{ myVal: number; oppVal: number }>).detail
      triggerReveal(detail.myVal, detail.oppVal)
    }
    mountEl.addEventListener('diceSettled', onSettled)

    const resizeObserver = new ResizeObserver(() => {
      const w = mountEl.clientWidth
      const h = mountEl.clientHeight
      const aspect = w / h
      const halfH = tableDepth / 2 + 0.4
      const halfW = halfH * aspect
      const cam = camera as THREE.OrthographicCamera
      cam.left = -halfW
      cam.right = halfW
      cam.top = halfH
      cam.bottom = -halfH
      cam.updateProjectionMatrix()
      renderer.setSize(w, h)
    })
    resizeObserver.observe(mountEl)

    return () => {
      window.clearTimeout(oppTimeout)
      cancelAnimationFrame(rafId)
      mountEl.removeEventListener('pointerdown', onDown)
      mountEl.removeEventListener('pointermove', onMove)
      mountEl.removeEventListener('pointerup', onUp)
      mountEl.removeEventListener('pointerleave', onUp)
      mountEl.removeEventListener('pointercancel', onUp)
      mountEl.removeEventListener('diceSettled', onSettled)
      resizeObserver.disconnect()
      renderer.dispose()
      if (mountEl.contains(renderer.domElement)) mountEl.removeChild(renderer.domElement)
    }
  }, [myDie, oppDie, triggerReveal])

  const hintText: Record<typeof hint, string> = {
    grab: '주사위를 잡고 던지세요',
    hold: '드래그해서 던지세요',
    wait: '...',
    done: '',
  }

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
          position: 'fixed',
          bottom: 48,
          left: '50%',
          transform: 'translateX(-50%)',
          background: 'rgba(0,0,0,0.55)',
          color: '#fff',
          padding: '5px 14px',
          borderRadius: 20,
          fontSize: 13,
          fontWeight: 500,
          pointerEvents: 'none',
          whiteSpace: 'nowrap',
          zIndex: 1,
        }}>{hintText[hint]}</div>
      )}

      {revealStage === 'suspense' && (
        <div style={{
          position: 'fixed',
          bottom: 48,
          left: '50%',
          transform: 'translateX(-50%)',
          background: 'rgba(0,0,0,0.7)',
          color: '#fbbf24',
          padding: '6px 18px',
          borderRadius: 20,
          fontSize: 14,
          fontWeight: 700,
          pointerEvents: 'none',
          whiteSpace: 'nowrap',
          zIndex: 1,
          animation: 'suspensePulse 0.35s ease-in-out infinite alternate',
        }}>결과 공개 중...</div>
      )}

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
          background: revealStage === 'done' ? 'rgba(255,255,255,0.97)' : 'rgba(30,30,30,0.88)',
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
          to   { opacity: 1; transform: translateX(-50%) scale(1.03); }
        }
        @keyframes badgePop {
          0% { transform: translate(-50%, -150%) scale(0.7); }
          60% { transform: translate(-50%, -150%) scale(1.12); }
          100% { transform: translate(-50%, -150%) scale(1); }
        }
      `}</style>
    </div>
  )
}
