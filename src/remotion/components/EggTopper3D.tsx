// Ilustracao 3D propria do TIPO de aparelho (nao e foto nem replica de um modelo comercial especifico).
// O estado da cena (posicao do aparelho, esfera, casca) e a camera sao funcoes do quadro absoluto e das
// deixas do roteiro, para que planos 3D separados por cartelas mantenham a continuidade.
import React, {useMemo} from 'react';
import * as THREE from 'three';
import {useThree} from '@react-three/fiber';
import {RoomEnvironment} from 'three/examples/jsm/environments/RoomEnvironment.js';
import {interpolate, Easing} from 'remotion';

import type {CueSeg} from '../track.js';
export type {CueSeg};

// ---------------------------------------------------------------------------------------------
// Geometria (unidades ~ 10 cm)
// ---------------------------------------------------------------------------------------------
const EGG_X = 0.3;
const STAND_X = -0.42;
const CUP_TOP = 0.38;
const EGG_HALF = 0.3;
const EGG_A = 0.21;
const EGG_CY = 0.5;
const SEAT_Y = 0.68; // linha onde a borda da capsula toca a casca
const BELL_H = 0.3;
const ROD_LEN = 1.1;
const BALL_R = 0.11;
const BALL_REST = BELL_H + BALL_R - 0.03;
const BALL_LIFT = BALL_REST + 0.75;

/** Raio do ovo na altura y (perfil de ovo: mais estreito em cima). */
function eggRadius(y: number): number {
  const u = (y - EGG_CY) / EGG_HALF;
  if (Math.abs(u) >= 1) return 0;
  return EGG_A * Math.sqrt(1 - u * u) * (1 - 0.14 * u);
}

function eggProfile(fromY: number, toY: number, n = 48): THREE.Vector2[] {
  const pts: THREE.Vector2[] = [];
  for (let i = 0; i <= n; i++) {
    const y = fromY + ((toY - fromY) * i) / n;
    pts.push(new THREE.Vector2(Math.max(0.0001, eggRadius(y)), y - EGG_CY));
  }
  return pts;
}

const CUP_PROFILE = [
  [0.0001, 0],
  [0.15, 0],
  [0.155, 0.025],
  [0.075, 0.06],
  [0.062, 0.15],
  [0.12, 0.2],
  [0.19, 0.29],
  [0.212, CUP_TOP],
  [0.198, CUP_TOP + 0.004],
  [0.18, 0.3],
  [0.11, 0.225],
  [0.0001, 0.205],
].map(([x, y]) => new THREE.Vector2(x, y));

const BELL_PROFILE = (() => {
  // Sino: boca do tamanho do ovo na linha de ruptura, afinando ate o colar da haste.
  const key: Array<[number, number]> = [
    [0.192, 0],
    [0.19, 0.03],
    [0.178, 0.09],
    [0.15, 0.16],
    [0.108, 0.225],
    [0.068, 0.27],
    [0.042, 0.3],
  ];
  const curve = new THREE.SplineCurve(key.map(([x, y]) => new THREE.Vector2(x, y)));
  const outer = curve.getPoints(28);
  const inner = outer
    .slice()
    .reverse()
    .map((p) => new THREE.Vector2(Math.max(0.03, p.x - 0.012), Math.max(0.004, p.y - 0.014)));
  return [...outer, ...inner];
})();

// ---------------------------------------------------------------------------------------------
// Utilidades de animacao
// ---------------------------------------------------------------------------------------------
type V3 = [number, number, number];
const ease = Easing.bezier(0.42, 0, 0.58, 1);
const clamp = {extrapolateLeft: 'clamp', extrapolateRight: 'clamp'} as const;
const lerp = (a: number, b: number, t: number) => a + (b - a) * t;
const lerp3 = (a: V3, b: V3, t: number): V3 => [lerp(a[0], b[0], t), lerp(a[1], b[1], t), lerp(a[2], b[2], t)];
const prog = (f: number, a: number, b: number, e = ease) => interpolate(f, [a, b], [0, 1], {...clamp, easing: e});

interface Pose {
  pos: V3;
  target: V3;
}
/** Camera de cada deixa: move de 'from' para 'to' ao longo do trecho. */
const CAMERA: Record<string, {from: Pose; to: Pose; snap?: boolean}> = {
  hero: {from: {pos: [-0.05, 0.75, 4.4], target: [-0.05, 0.38, 0]}, to: {pos: [EGG_X, 0.95, 1.55], target: [EGG_X, 0.6, 0]}},
  place: {from: {pos: [0.45, 1.2, 3.9], target: [0.12, 0.85, 0]}, to: {pos: [0.4, 1.35, 3.4], target: [0.28, 0.9, 0]}},
  lift: {from: {pos: [0.4, 1.35, 3.3], target: [0.28, 0.9, 0]}, to: {pos: [0.42, 1.45, 3.1], target: [EGG_X, 1.0, 0]}},
  drop: {from: {pos: [0.42, 1.45, 3.1], target: [EGG_X, 1.0, 0]}, to: {pos: [0.42, 1.42, 3.05], target: [EGG_X, 0.98, 0]}},
  hold: {from: {pos: [0.42, 1.42, 3.05], target: [EGG_X, 0.98, 0]}, to: {pos: [0.38, 1.1, 2.4], target: [EGG_X, 0.72, 0]}},
  open: {from: {pos: [0.38, 1.1, 2.4], target: [EGG_X, 0.72, 0]}, to: {pos: [EGG_X + 0.08, 1.25, 1.45], target: [EGG_X, 0.58, 0]}},
  gem: {from: {pos: [STAND_X + 1.3, 0.85, 2.3], target: [STAND_X, 0.42, 0]}, to: {pos: [STAND_X + 0.55, 0.8, 2.5], target: [STAND_X, 0.4, 0]}},
  gemClose: {from: {pos: [STAND_X + 0.4, 0.55, 1.0], target: [STAND_X, 0.32, 0]}, to: {pos: [STAND_X + 0.28, 0.5, 0.82], target: [STAND_X, 0.32, 0]}},
  gemEgg: {from: {pos: [STAND_X + 0.3, 0.6, 1.6], target: [STAND_X + 0.3, 0.36, 0]}, to: {pos: [-0.05, 0.8, 4.1], target: [-0.05, 0.4, 0]}},
  still: {from: {pos: [-0.05, 0.8, 4.3], target: [-0.05, 0.4, 0]}, to: {pos: [-0.05, 0.8, 4.3], target: [-0.05, 0.4, 0]}},
  snap: {from: {pos: [-0.05, 0.8, 4.3], target: [-0.05, 0.4, 0]}, to: {pos: [STAND_X + 0.06, 0.75, 1.5], target: [STAND_X, 0.42, 0]}, snap: true},
};

function cameraAt(f: number, track: CueSeg[]): Pose {
  const seg = [...track].reverse().find((s) => f >= s.start) ?? track[0];
  const cam = CAMERA[seg.cue] ?? CAMERA.still;
  const t = cam.snap ? prog(f, seg.start, seg.start + 6, Easing.out(Easing.cubic)) : prog(f, seg.start, seg.end);
  return {pos: lerp3(cam.from.pos, cam.to.pos, t), target: lerp3(cam.from.target, cam.to.target, t)};
}

function findSeg(track: CueSeg[], cue: string): CueSeg | undefined {
  return track.find((s) => s.cue === cue);
}

/** Estado fisico da cena no quadro absoluto f. */
function sceneState(f: number, track: CueSeg[]) {
  const place = findSeg(track, 'place');
  const lift = findSeg(track, 'lift');
  const drop = findSeg(track, 'drop');
  const open = findSeg(track, 'open');
  const gem = findSeg(track, 'gem');
  const gemEgg = findSeg(track, 'gemEgg');
  const impact = drop?.impact ?? Infinity;

  const stand: V3 = [STAND_X, 0, 0];
  const onEgg: V3 = [EGG_X, SEAT_Y, 0];
  let device: V3 = stand;
  if (place && f >= place.start) {
    const p0 = place.start;
    const up = prog(f, p0 + 2, p0 + 14);
    const across = prog(f, p0 + 12, p0 + 30);
    const down = prog(f, p0 + 28, p0 + 40, Easing.out(Easing.cubic));
    device = [lerp(stand[0], onEgg[0], across), lerp(lerp(0, SEAT_Y + 0.5, up), onEgg[1], down), 0];
  }
  if (open && f >= open.start) {
    const o0 = open.start;
    const up = prog(f, o0 + 3, o0 + 14);
    const across = prog(f, o0 + 12, o0 + 30);
    const down = prog(f, o0 + 28, o0 + 40, Easing.out(Easing.cubic));
    device = [lerp(onEgg[0], stand[0], across), lerp(lerp(onEgg[1], SEAT_Y + 0.5, up), 0, down), 0];
  }
  const shake = f >= impact && f < impact + 5 ? (f % 2 === 0 ? 0.006 : -0.006) : 0;
  device = [device[0] + shake, device[1], device[2]];

  const liftT = lift ? prog(f, lift.start + 3, lift.start + 24) : 0;
  const dropT = interpolate(f, [impact - 7, impact], [0, 1], {...clamp, easing: Easing.in(Easing.quad)});
  const ball = lerp(BALL_REST, BALL_LIFT, liftT * (1 - dropT));

  const ring = f >= impact ? interpolate(f, [impact, impact + 5], [1.12, 1], clamp) : 0;
  const capT = open ? prog(f, open.start + 18, open.start + 36, Easing.out(Easing.cubic)) : 0;
  // Edicao com pedra preciosa: a esfera vira ametista durante os trechos "gem" e volta ao aco depois.
  const gemT = gem && gemEgg ? prog(f, gem.start + 8, gem.start + 26) * (1 - prog(f, gemEgg.end, gemEgg.end + 1)) : 0;
  return {device, ball, ring, capT, gemT};
}

// ---------------------------------------------------------------------------------------------
// Componentes
// ---------------------------------------------------------------------------------------------
const Environment: React.FC = () => {
  const {gl, scene} = useThree();
  useMemo(() => {
    const pmrem = new THREE.PMREMGenerator(gl);
    scene.environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
    scene.environmentIntensity = 0.55;
    scene.background = new THREE.Color('#ECE8DF');
    scene.fog = new THREE.Fog('#ECE8DF', 7, 13);
  }, [gl, scene]);
  return null;
};

const CameraRig: React.FC<{pose: Pose}> = ({pose}) => {
  const {camera} = useThree();
  camera.position.set(...pose.pos);
  camera.lookAt(...pose.target);
  camera.updateMatrixWorld();
  return null;
};

const steel = new THREE.MeshStandardMaterial({color: '#cfd4db', metalness: 1, roughness: 0.26});
const darkKnob = new THREE.MeshStandardMaterial({color: '#23272f', metalness: 0.2, roughness: 0.45});
const eggMat = new THREE.MeshStandardMaterial({color: '#EADCC8', roughness: 0.7});
const albumen = new THREE.MeshStandardMaterial({color: '#FBF6EC', roughness: 0.35});
const yolk = new THREE.MeshStandardMaterial({color: '#F0A92E', roughness: 0.3});
const eggInside = new THREE.MeshStandardMaterial({color: '#FBF7F0', roughness: 0.8, side: THREE.BackSide});
const eggShellIn = new THREE.MeshStandardMaterial({color: '#F7EFE3', roughness: 0.8, side: THREE.DoubleSide});
const cupMat = new THREE.MeshStandardMaterial({color: '#1C2333', roughness: 0.32, metalness: 0.05});
const crackMat = new THREE.MeshStandardMaterial({color: '#4a3526', roughness: 0.9});
const tableMat = new THREE.MeshStandardMaterial({color: '#E4DDD0', roughness: 0.95});

export const EggTopperScene: React.FC<{absFrame: number; track: CueSeg[]}> = ({absFrame: f, track}) => {
  const s = sceneState(f, track);
  const pose = cameraAt(f, track);
  const geo = useMemo(
    () => ({
      eggBottom: new THREE.LatheGeometry(eggProfile(EGG_CY - EGG_HALF, SEAT_Y), 96),
      eggTop: new THREE.LatheGeometry(eggProfile(SEAT_Y, EGG_CY + EGG_HALF), 96),
      cup: new THREE.LatheGeometry(CUP_PROFILE, 96),
      bell: new THREE.LatheGeometry(BELL_PROFILE, 96),
      rod: new THREE.CylinderGeometry(0.018, 0.018, ROD_LEN, 32),
      knob: new THREE.SphereGeometry(0.05, 48, 32),
      ball: new THREE.SphereGeometry(BALL_R, 64, 48),
      ring: new THREE.TorusGeometry(eggRadius(SEAT_Y) + 0.002, 0.0045, 12, 128),
      disc: new THREE.CircleGeometry(eggRadius(SEAT_Y) - 0.004, 96),
      yolk: new THREE.SphereGeometry(0.085, 48, 32),
    }),
    [],
  );
  const ballMat = useMemo(() => new THREE.MeshPhysicalMaterial({metalness: 1, roughness: 0.26, clearcoat: 1, clearcoatRoughness: 0.1}), []);
  // Aco → ametista
  ballMat.color.set('#cfd4db').lerp(new THREE.Color('#7B3FB8'), s.gemT);
  ballMat.metalness = 1 - 0.95 * s.gemT;
  ballMat.roughness = 0.26 - 0.18 * s.gemT;

  const rSeat = eggRadius(SEAT_Y);
  return (
    <>
      <Environment />
      <CameraRig pose={pose} />
      <ambientLight intensity={0.18} />
      <directionalLight position={[2.2, 4.5, 3.2]} intensity={2.6} castShadow shadow-mapSize-width={2048} shadow-mapSize-height={2048} shadow-camera-left={-2} shadow-camera-right={2} shadow-camera-top={3} shadow-camera-bottom={-1} shadow-bias={-0.0004} />
      <directionalLight position={[-3, 2.5, 2]} intensity={0.6} />
      <directionalLight position={[0, 3, -4]} intensity={0.9} />

      {/* Mesa */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} receiveShadow material={tableMat}>
        <planeGeometry args={[30, 30]} />
      </mesh>

      {/* Porta-ovo e ovo */}
      <group position={[EGG_X, 0, 0]}>
        <mesh geometry={geo.cup} material={cupMat} castShadow receiveShadow />
        <mesh geometry={geo.eggBottom} material={eggMat} position={[0, EGG_CY, 0]} castShadow receiveShadow />
        {/* Interior do ovo quente (aparece quando a tampa sai): clara e gema */}
        <mesh geometry={geo.disc} material={albumen} position={[0, SEAT_Y - 0.004, 0]} rotation={[-Math.PI / 2, 0, 0]} />
        <mesh geometry={geo.yolk} material={yolk} position={[0, SEAT_Y - 0.03, 0]} scale={[1, 0.45, 1]} />
        {/* Topo da casca: levanta e inclina ao abrir, girando na borda da linha de ruptura */}
        <group position={[rSeat, SEAT_Y, 0]} rotation={[0, 0, -s.capT * 1.05]}>
          <group position={[-rSeat, -SEAT_Y + s.capT * 0.02, 0]}>
            <mesh geometry={geo.eggTop} material={eggMat} position={[0, EGG_CY, 0]} castShadow receiveShadow />
            <mesh geometry={geo.eggTop} material={eggShellIn} position={[0, EGG_CY, 0]} scale={[0.96, 0.99, 0.96]} />
          </group>
        </group>
        {s.ring > 0 ? <mesh geometry={geo.ring} material={crackMat} position={[0, SEAT_Y, 0]} rotation={[Math.PI / 2, 0, 0]} scale={s.ring} /> : null}
      </group>

      {/* Aparelho: capsula, haste, puxador, esfera de impacto */}
      <group position={s.device}>
        <mesh geometry={geo.bell} material={steel} castShadow receiveShadow />
        <mesh geometry={geo.rod} material={steel} position={[0, BELL_H + ROD_LEN / 2 - 0.02, 0]} castShadow />
        <mesh geometry={geo.knob} material={darkKnob} position={[0, BELL_H + ROD_LEN - 0.02, 0]} castShadow />
        <mesh geometry={geo.ball} material={ballMat} position={[0, s.ball, 0]} castShadow />
      </group>
    </>
  );
};
