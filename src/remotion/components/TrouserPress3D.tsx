// Ilustracao 3D propria do TIPO de aparelho (prensa de calcas eletrica de pe), nao e foto nem replica de um
// modelo comercial. Como na cena do piloto, o estado (porta, calca, mostrador, vapor) e a camera sao funcoes do
// quadro absoluto e das deixas do roteiro, para manter a continuidade entre planos separados por cartelas.
//
// Deixas: hero, open, insert, close, c15/c30/c45 (botoes do ciclo; depois o mostrador conta), run, finish (acabamentos),
// bathroom (calca no cabide, no vapor do banho), still (os dois no mesmo quadro), snap (zoom de reacao no
// mostrador), iron (ferro de passar ao lado da prensa).
import React, {useMemo} from 'react';
import * as THREE from 'three';
import {useThree} from '@react-three/fiber';
import {RoomEnvironment} from 'three/examples/jsm/environments/RoomEnvironment.js';
import {interpolate, Easing} from 'remotion';
import type {CueSeg} from '../track.js';

const FPS = 30;
export const BG = '#E9E4DA';

// ---------------------------------------------------------------------------------------------
// Geometria (metros). Proporcoes de uma prensa de pe tipica: ~1,1 m de altura, ~0,46 m de largura.
// ---------------------------------------------------------------------------------------------
const PRESS_X = -0.36;
const BODY_W = 0.44;
const BODY_H = 0.92;
const BODY_Y0 = 0.1; // base do corpo (acima dos pes)
const DOOR_W = 0.4;
const DOOR_H = 0.84;
const DOOR_T = 0.024;
const DOOR_Z = 0.045; // frente do corpo
const BAR_Y = BODY_Y0 + BODY_H; // topo do corpo, onde fica a barra de controle
const OPEN_ANGLE = 0.42; // rad, porta inclinada para a frente (dobradica embaixo)

const BATH_X = 0.43; // cabide no "banheiro", a direita
const RAIL_Y = 1.44;

// Na ordem em que o vendedor cita: nogueira, mogno, freixo preto, faia, carvalho.
const FINISHES = ['#5B3221', '#6E2418', '#2A2A2C', '#C99B6A', '#A27B4E'];

// ---------------------------------------------------------------------------------------------
// Animacao
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
const WIDE: Pose = {pos: [0.05, 0.98, 4.6], target: [0.05, 0.68, 0]};
const PRESS_MID: Pose = {pos: [PRESS_X + 0.15, 0.95, 3.1], target: [PRESS_X, 0.66, 0]};
const LED_X = 0.1;
const DISPLAY: Pose = {pos: [PRESS_X + LED_X - 0.02, BAR_Y + 0.07, 0.9], target: [PRESS_X + LED_X, BAR_Y + 0.03, 0]};
const CAMERA: Record<string, {from: Pose; to: Pose; snap?: boolean}> = {
  hero: {from: {pos: [PRESS_X + 0.35, 0.75, 4.2], target: [PRESS_X, 0.62, 0]}, to: PRESS_MID},
  open: {from: PRESS_MID, to: {pos: [PRESS_X + 0.3, 1.05, 2.7], target: [PRESS_X, 0.62, 0]}},
  insert: {from: {pos: [PRESS_X + 0.3, 1.05, 2.7], target: [PRESS_X, 0.62, 0]}, to: {pos: [PRESS_X + 0.25, 1.0, 2.6], target: [PRESS_X, 0.66, 0]}},
  close: {from: {pos: [PRESS_X + 0.25, 1.0, 2.6], target: [PRESS_X, 0.66, 0]}, to: {pos: [PRESS_X + 0.12, 1.05, 2.0], target: [PRESS_X, 0.85, 0]}},
  c15: {from: {pos: [PRESS_X + 0.06, BAR_Y + 0.12, 1.35], target: [PRESS_X + 0.04, BAR_Y, 0]}, to: DISPLAY},
  c30: {from: DISPLAY, to: DISPLAY},
  c45: {from: DISPLAY, to: {pos: DISPLAY.pos.map((v, i) => (i === 2 ? v - 0.12 : v)) as V3, target: DISPLAY.target}},
  run: {from: DISPLAY, to: {pos: [PRESS_X + 0.2, 0.95, 2.9], target: [PRESS_X, 0.7, 0]}},
  finish: {from: {pos: [PRESS_X + 0.45, 0.98, 2.7], target: [PRESS_X, 0.7, 0]}, to: {pos: [PRESS_X + 0.2, 0.95, 2.45], target: [PRESS_X, 0.7, 0]}},
  // Barra do box abaixo da faixa institucional e do rotulo da ilustracao (~20% do quadro).
  bathroom: {from: {pos: [BATH_X + 0.02, 1.2, 3.15], target: [BATH_X + 0.08, 0.97, 0]}, to: {pos: [BATH_X + 0.04, 1.17, 2.9], target: [BATH_X + 0.1, 0.98, 0]}},
  still: {from: WIDE, to: WIDE},
  snap: {from: WIDE, to: DISPLAY, snap: true},
  iron: {from: {pos: [PRESS_X + 0.22, 1.32, 2.15], target: [PRESS_X, 1.0, 0]}, to: {pos: [PRESS_X + 0.18, 1.3, 1.9], target: [PRESS_X, 1.0, 0]}},
};

function cameraAt(f: number, track: CueSeg[]): Pose {
  const seg = [...track].reverse().find((s) => f >= s.start) ?? track[0];
  const cam = CAMERA[seg.cue] ?? CAMERA.still;
  const t = cam.snap ? prog(f, seg.start, seg.start + 6, Easing.out(Easing.cubic)) : prog(f, seg.start, seg.end);
  return {pos: lerp3(cam.from.pos, cam.to.pos, t), target: lerp3(cam.from.target, cam.to.target, t)};
}

const findSeg = (track: CueSeg[], cue: string) => track.find((s) => s.cue === cue);

/** Estado fisico da cena no quadro absoluto f. */
function sceneState(f: number, track: CueSeg[]) {
  const open = findSeg(track, 'open');
  const insert = findSeg(track, 'insert');
  const close = findSeg(track, 'close');
  const c15 = findSeg(track, 'c15');
  const c30 = findSeg(track, 'c30');
  const c45 = findSeg(track, 'c45');
  const finish = findSeg(track, 'finish');
  const bath = findSeg(track, 'bathroom');
  const iron = findSeg(track, 'iron');

  const opening = open ? prog(f, open.start + 3, open.start + 24) : 0;
  const closing = close ? prog(f, close.start + 2, close.start + 18, Easing.in(Easing.quad)) : 0;
  const door = OPEN_ANGLE * opening * (1 - closing);
  // A calca desce do alto ate a placa aquecida.
  const trousers = insert ? prog(f, insert.start + 2, insert.start + 26, Easing.out(Easing.cubic)) : 0;

  // Mostrador: apagado ate o primeiro botao; 15 → 30 → 45 min; ao fim de c45, contagem regressiva em tempo real.
  let display: string | null = null;
  if (c45 && f >= c45.end) {
    const left = Math.max(0, 45 * 60 - Math.floor((f - c45.end) / FPS));
    display = `${Math.floor(left / 60)}:${String(left % 60).padStart(2, '0')}`;
  } else if (c45 && f >= c45.start) display = '45:00';
  else if (c30 && f >= c30.start) display = '30:00';
  else if (c15 && f >= c15.start) display = '15:00';

  // Acabamentos: o painel troca de cor ao longo do trecho "finish" e volta a nogueira depois.
  let finishIdx = 0;
  if (finish && f >= finish.start && f < finish.end) {
    finishIdx = Math.min(FINISHES.length - 1, Math.floor(((f - finish.start) / (finish.end - finish.start)) * FINISHES.length));
  }

  // Banheiro: vapor sobe e os amassados da calca no cabide somem.
  const steam = bath ? prog(f, bath.start, bath.start + 20) : 0;
  const smooth = bath ? prog(f, bath.start + 12, bath.start + 60) : 0;
  const ironIn = iron ? prog(f, iron.start + 2, iron.start + 12, Easing.out(Easing.bounce)) : 0;
  return {door, trousers, display, finishIdx, steam, smooth, ironIn};
}

// ---------------------------------------------------------------------------------------------
// Texturas desenhadas no navegador (mostrador de LED e azulejos)
// ---------------------------------------------------------------------------------------------
function useCanvasTexture(w: number, h: number) {
  return useMemo(() => {
    const canvas = document.createElement('canvas');
    canvas.width = w;
    canvas.height = h;
    const tex = new THREE.CanvasTexture(canvas);
    tex.colorSpace = THREE.SRGBColorSpace;
    tex.anisotropy = 4;
    return {canvas, tex};
  }, [w, h]);
}

function drawDisplay(canvas: HTMLCanvasElement, text: string | null) {
  const g = canvas.getContext('2d')!;
  g.fillStyle = '#0d0f12';
  g.fillRect(0, 0, canvas.width, canvas.height);
  g.font = `700 ${Math.round(canvas.height * 0.72)}px "IBM Plex Mono", monospace`;
  g.textAlign = 'center';
  g.textBaseline = 'middle';
  g.fillStyle = 'rgba(255,60,40,0.10)';
  g.fillText('88:88', canvas.width / 2, canvas.height / 2 + 4);
  if (text) {
    g.shadowColor = 'rgba(255,40,20,0.9)';
    g.shadowBlur = 18;
    g.fillStyle = '#FF4A2E';
    g.fillText(text.padStart(5, ' '), canvas.width / 2, canvas.height / 2 + 4);
    g.shadowBlur = 0;
  }
}

function drawTiles(canvas: HTMLCanvasElement) {
  const g = canvas.getContext('2d')!;
  g.fillStyle = '#F4F6F7';
  g.fillRect(0, 0, canvas.width, canvas.height);
  g.strokeStyle = '#C9D2D6';
  g.lineWidth = 6;
  const n = 8;
  for (let i = 0; i <= n; i++) {
    const p = (i / n) * canvas.width;
    g.beginPath();
    g.moveTo(p, 0);
    g.lineTo(p, canvas.height);
    g.stroke();
    g.beginPath();
    g.moveTo(0, p);
    g.lineTo(canvas.width, p);
    g.stroke();
  }
}

/** Pseudoaleatorio deterministico (mesmo vapor em todo render). */
function rand(i: number): number {
  const x = Math.sin(i * 127.1 + 311.7) * 43758.5453;
  return x - Math.floor(x);
}

// ---------------------------------------------------------------------------------------------
// Componentes
// ---------------------------------------------------------------------------------------------
const Environment: React.FC = () => {
  const {gl, scene} = useThree();
  useMemo(() => {
    const pmrem = new THREE.PMREMGenerator(gl);
    scene.environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
    scene.environmentIntensity = 0.5;
    scene.background = new THREE.Color(BG);
    scene.fog = new THREE.Fog(BG, 9, 18);
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

const wallMat = new THREE.MeshStandardMaterial({color: '#E9E4DA', roughness: 0.95});
const carpetMat = new THREE.MeshStandardMaterial({color: '#7C6A5A', roughness: 1});
const bathFloorMat = new THREE.MeshStandardMaterial({color: '#D9DEE0', roughness: 0.6});
const bodyMat = new THREE.MeshStandardMaterial({color: '#25272B', roughness: 0.55, metalness: 0.1});
const padMat = new THREE.MeshStandardMaterial({color: '#3A3D42', roughness: 0.95});
const metalMat = new THREE.MeshStandardMaterial({color: '#B9BEC4', roughness: 0.3, metalness: 1});
const waterMat = new THREE.MeshStandardMaterial({color: '#BFD8E6', roughness: 0.2, transparent: true, opacity: 0.55});
const trouserMat = new THREE.MeshStandardMaterial({color: '#2F3A52', roughness: 0.85, side: THREE.DoubleSide});
const wrinkleMat = new THREE.MeshStandardMaterial({color: '#151B2B', roughness: 1, transparent: true});
const creaseMat = new THREE.MeshStandardMaterial({color: '#1F2840', roughness: 1});
const ironBodyMat = new THREE.MeshStandardMaterial({color: '#2E7FA8', roughness: 0.35});
const ironSoleMat = new THREE.MeshStandardMaterial({color: '#C7CCD2', roughness: 0.25, metalness: 1});

/** Silhueta de calca pendurada pelo cos (largura w, altura h), com abertura entre as pernas. */
function trouserShape(w: number, h: number): THREE.Shape {
  const s = new THREE.Shape();
  const crotch = h * 0.3;
  const gap = w * 0.05;
  s.moveTo(-w / 2, 0);
  s.lineTo(w / 2, 0);
  s.lineTo(w / 2 + w * 0.03, -h);
  s.lineTo(gap / 2 + w * 0.02, -h);
  s.lineTo(gap / 2, -crotch);
  s.lineTo(-gap / 2, -crotch);
  s.lineTo(-gap / 2 - w * 0.02, -h);
  s.lineTo(-w / 2 - w * 0.03, -h);
  s.lineTo(-w / 2, 0);
  return s;
}

/** Calca pendurada: silhueta com cos, vincos das pernas e amassados que podem sumir (wrinkles 0..1). */
const Trousers: React.FC<{w: number; h: number; wrinkles: number; seed: number}> = ({w, h, wrinkles, seed}) => {
  const geo = useMemo(() => new THREE.ExtrudeGeometry(trouserShape(w, h), {depth: 0.012, bevelEnabled: false}), [w, h]);
  const mat = useMemo(() => wrinkleMat.clone(), []);
  mat.opacity = 0.85 * wrinkles;
  // Amassados: zigue-zagues curtos nas pernas.
  const lines = useMemo(
    () =>
      Array.from({length: 14}, (_, i) => {
        const leg = i % 2 === 0 ? -1 : 1;
        return {
          x: leg * w * (0.12 + 0.2 * rand(seed + i)),
          y: -h * (0.25 + 0.7 * rand(seed + 40 + i)),
          r: (rand(seed + 80 + i) - 0.5) * 1.4,
          l: w * (0.14 + 0.18 * rand(seed + 120 + i)),
        };
      }),
    [w, h, seed],
  );
  return (
    <group>
      <mesh geometry={geo} material={trouserMat} castShadow receiveShadow />
      {/* cos e vincos das pernas */}
      <mesh material={creaseMat} position={[0, -0.022, 0.0135]}>
        <boxGeometry args={[w * 1.0, 0.04, 0.002]} />
      </mesh>
      {[-1, 1].map((k) => (
        <mesh key={k} material={creaseMat} position={[k * w * 0.26, -h * 0.55, 0.0135]} rotation={[0, 0, k * -0.02]}>
          <boxGeometry args={[0.004, h * 0.88, 0.002]} />
        </mesh>
      ))}
      {lines.map((ln, i) => (
        <mesh key={i} position={[ln.x, ln.y, 0.0135]} rotation={[0, 0, ln.r]} material={mat} visible={wrinkles > 0.02}>
          <boxGeometry args={[ln.l, 0.009, 0.002]} />
        </mesh>
      ))}
    </group>
  );
};

/** Cabide de arame (gancho + triangulo) com a barra a 0 m. */
const Hanger: React.FC = () => {
  const geo = useMemo(() => {
    const pts = [
      [0, 0.14],
      [0.02, 0.17],
      [0.0, 0.2],
      [-0.025, 0.175],
      [0, 0.14],
      [0, 0.11],
      [-0.2, 0.0],
      [0.2, 0.0],
      [0, 0.11],
    ].map(([x, y]) => new THREE.Vector3(x, y, 0));
    const path = new THREE.CatmullRomCurve3(pts, false, 'catmullrom', 0.05);
    return new THREE.TubeGeometry(path, 120, 0.004, 8, false);
  }, []);
  return <mesh geometry={geo} material={metalMat} castShadow />;
};

/** Ferro de passar estilizado: base em ponta (vista de cima), corpo com perfil inclinado ate o bico, alca. */
const Iron: React.FC = () => {
  const geo = useMemo(() => {
    const plan = new THREE.Shape();
    plan.moveTo(-0.12, -0.065);
    plan.lineTo(0.02, -0.065);
    plan.quadraticCurveTo(0.12, -0.05, 0.17, 0);
    plan.quadraticCurveTo(0.12, 0.05, 0.02, 0.065);
    plan.lineTo(-0.12, 0.065);
    plan.quadraticCurveTo(-0.14, 0, -0.12, -0.065);
    const sole = new THREE.ExtrudeGeometry(plan, {depth: 0.018, bevelEnabled: false});
    sole.rotateX(-Math.PI / 2);
    // Perfil lateral: alto atras, descendo ate o bico.
    const side = new THREE.Shape();
    side.moveTo(-0.115, 0);
    side.lineTo(0.15, 0);
    side.quadraticCurveTo(0.06, 0.07, -0.02, 0.085);
    side.lineTo(-0.115, 0.085);
    side.lineTo(-0.115, 0);
    const body = new THREE.ExtrudeGeometry(side, {depth: 0.09, bevelEnabled: true, bevelThickness: 0.012, bevelSize: 0.01, bevelSegments: 4});
    body.translate(0, 0, -0.045);
    return {sole, body, handle: new THREE.TorusGeometry(0.06, 0.014, 12, 40, Math.PI)};
  }, []);
  return (
    <group>
      <mesh geometry={geo.sole} material={ironSoleMat} castShadow />
      <mesh geometry={geo.body} material={ironBodyMat} position={[0, 0.018, 0]} castShadow />
      <mesh geometry={geo.handle} material={ironBodyMat} position={[-0.055, 0.1, 0]} castShadow />
    </group>
  );
};

export const TrouserPressScene: React.FC<{absFrame: number; track: CueSeg[]}> = ({absFrame: f, track}) => {
  const s = sceneState(f, track);
  const pose = cameraAt(f, track);
  const led = useCanvasTexture(320, 112);
  drawDisplay(led.canvas, s.display);
  led.tex.needsUpdate = true;
  const tiles = useCanvasTexture(512, 512);
  useMemo(() => {
    drawTiles(tiles.canvas);
    tiles.tex.wrapS = tiles.tex.wrapT = THREE.RepeatWrapping;
    tiles.tex.repeat.set(1.5, 2.6);
    tiles.tex.needsUpdate = true;
  }, [tiles]);
  const tileMat = useMemo(() => new THREE.MeshStandardMaterial({map: tiles.tex, roughness: 0.35}), [tiles]);
  const doorMat = useMemo(() => new THREE.MeshStandardMaterial({roughness: 0.38, metalness: 0.05}), []);
  doorMat.color.set(FINISHES[s.finishIdx]);
  const bathWrinkles = 1 - s.smooth;

  const puff = useCanvasTexture(128, 128);
  useMemo(() => {
    const g = puff.canvas.getContext('2d')!;
    const grad = g.createRadialGradient(64, 64, 0, 64, 64, 64);
    grad.addColorStop(0, 'rgba(255,255,255,1)');
    grad.addColorStop(0.5, 'rgba(255,255,255,0.45)');
    grad.addColorStop(1, 'rgba(255,255,255,0)');
    g.fillStyle = grad;
    g.fillRect(0, 0, 128, 128);
    puff.tex.needsUpdate = true;
  }, [puff]);
  const steam = useMemo(
    () =>
      Array.from({length: 34}, (_, i) => ({
        x: (rand(i) - 0.5) * 0.8,
        z: (rand(i + 50) - 0.5) * 0.4,
        phase: rand(i + 99),
        r: 0.12 + 0.12 * rand(i + 7),
        mat: new THREE.SpriteMaterial({map: puff.tex, transparent: true, depthWrite: false, opacity: 0}),
      })),
    [puff],
  );
  const steamPhase = (f / FPS) * 0.18;

  return (
    <>
      <Environment />
      <CameraRig pose={pose} />
      <ambientLight intensity={0.2} />
      <directionalLight position={[2.0, 4.2, 3.4]} intensity={2.4} castShadow shadow-mapSize-width={2048} shadow-mapSize-height={2048} shadow-camera-left={-3} shadow-camera-right={3} shadow-camera-top={3} shadow-camera-bottom={-1} shadow-bias={-0.0004} />
      <directionalLight position={[-3, 2.5, 2]} intensity={0.55} />
      <directionalLight position={[0, 3, -4]} intensity={0.7} />

      {/* Quarto (carpete, parede) a esquerda; banheiro (azulejo) a direita */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[-1.4, 0, 0.6]} receiveShadow material={carpetMat}>
        <planeGeometry args={[2.8, 6]} />
      </mesh>
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[1.4, 0.001, 0.6]} receiveShadow material={bathFloorMat}>
        <planeGeometry args={[2.8, 6]} />
      </mesh>
      <mesh position={[-1.4, 1.5, -0.35]} receiveShadow material={wallMat}>
        <planeGeometry args={[2.8, 3]} />
      </mesh>
      <mesh position={[1.4, 1.5, -0.35]} receiveShadow material={tileMat}>
        <planeGeometry args={[2.8, 3]} />
      </mesh>
      {/* Batente da porta do banheiro */}
      <mesh position={[0.02, 1.05, -0.3]} material={wallMat} castShadow>
        <boxGeometry args={[0.1, 2.1, 0.12]} />
      </mesh>

      {/* Prensa de calcas */}
      <group position={[PRESS_X, 0, 0]}>
        {/* pes e colunas */}
        {[-1, 1].map((k) => (
          <group key={k} position={[(k * BODY_W) / 2.4, 0, 0]}>
            <mesh material={bodyMat} position={[0, 0.015, 0.02]} castShadow receiveShadow>
              <boxGeometry args={[0.04, 0.03, 0.36]} />
            </mesh>
            <mesh material={bodyMat} position={[0, BODY_Y0 / 2 + 0.01, -0.01]} castShadow>
              <boxGeometry args={[0.035, BODY_Y0, 0.035]} />
            </mesh>
          </group>
        ))}
        {/* corpo traseiro e placa aquecida */}
        <mesh material={bodyMat} position={[0, BODY_Y0 + BODY_H / 2, -0.01]} castShadow receiveShadow>
          <boxGeometry args={[BODY_W, BODY_H, 0.05]} />
        </mesh>
        <mesh material={padMat} position={[0, BODY_Y0 + BODY_H / 2 - 0.02, 0.0155]}>
          <boxGeometry args={[BODY_W - 0.06, BODY_H - 0.1, 0.004]} />
        </mesh>
        {/* calca dentro da prensa */}
        <group position={[0, BAR_Y - 0.04 + (1 - s.trousers) * 0.9, 0.022]} visible={s.trousers > 0}>
          <Trousers w={0.34} h={0.8} wrinkles={0} seed={11} />
        </group>
        {/* barra de controle com mostrador */}
        <mesh material={bodyMat} position={[0, BAR_Y + 0.035, 0.02]} castShadow>
          <boxGeometry args={[BODY_W + 0.04, 0.07, 0.12]} />
        </mesh>
        <mesh position={[LED_X, BAR_Y + 0.035, 0.0805]}>
          <planeGeometry args={[0.1, 0.035]} />
          <meshBasicMaterial map={led.tex} toneMapped={false} />
        </mesh>
        <mesh position={[-0.12, BAR_Y + 0.035, 0.081]} material={metalMat}>
          <cylinderGeometry args={[0.014, 0.014, 0.01, 24]} />
        </mesh>
        {/* porta (painel frontal), dobradica embaixo */}
        <group position={[0, BODY_Y0 + 0.04, DOOR_Z]} rotation={[s.door, 0, 0]}>
          <mesh material={doorMat} position={[0, DOOR_H / 2, DOOR_T / 2]} castShadow receiveShadow>
            <boxGeometry args={[DOOR_W, DOOR_H, DOOR_T]} />
          </mesh>
          {/* friso e puxador */}
          <mesh material={metalMat} position={[0, DOOR_H - 0.05, DOOR_T + 0.006]}>
            <boxGeometry args={[0.16, 0.012, 0.012]} />
          </mesh>
        </group>
      </group>

      {/* Ferro de passar (aparece na deixa "iron") */}
      <group position={[PRESS_X - 0.04, BAR_Y + 0.07 + (1 - s.ironIn) * 0.5, 0.03]} rotation={[0, -0.85, 0]} visible={s.ironIn > 0}>
        <Iron />
      </group>

      {/* Banheiro: barra do box, cabide, calca e vapor */}
      <mesh material={metalMat} position={[BATH_X, RAIL_Y, -0.05]} rotation={[0, 0, Math.PI / 2]} castShadow>
        <cylinderGeometry args={[0.012, 0.012, 1.0, 16]} />
      </mesh>
      <group position={[BATH_X, RAIL_Y - 0.2, -0.05]}>
        <Hanger />
        <group position={[0, 0.0, 0]}>
          <Trousers w={0.36} h={0.95} wrinkles={bathWrinkles} seed={23} />
        </group>
      </group>
      {/* Chuveiro: cano, ducha e agua caindo enquanto ha vapor */}
      <group position={[BATH_X + 0.34, -0.14, -0.3]}>
        <mesh material={metalMat} position={[0, 1.78, 0]}>
          <cylinderGeometry args={[0.012, 0.012, 0.3, 12]} />
        </mesh>
        <mesh material={metalMat} position={[0, 1.93, 0.1]} rotation={[Math.PI / 2, 0, 0]}>
          <cylinderGeometry args={[0.012, 0.012, 0.2, 12]} />
        </mesh>
        <mesh material={metalMat} position={[0, 1.9, 0.2]} rotation={[0.35, 0, 0]}>
          <cylinderGeometry args={[0.07, 0.03, 0.05, 32]} />
        </mesh>
        {s.steam > 0
          ? Array.from({length: 9}, (_, i) => {
              const x = (rand(i + 300) - 0.5) * 0.1;
              const len = 0.25 + 0.2 * rand(i + 310);
              const y = 1.85 - (((f * (0.06 + 0.02 * rand(i)) + rand(i + 320)) % 1) * 1.6);
              return (
                <mesh key={i} material={waterMat} position={[x, y, 0.24 + (rand(i + 330) - 0.5) * 0.08]}>
                  <boxGeometry args={[0.004, len, 0.004]} />
                </mesh>
              );
            })
          : null}
      </group>
      {s.steam > 0
        ? steam.map((p, i) => {
            const t = (p.phase + steamPhase) % 1;
            const y = 0.3 + t * 1.7;
            p.mat.opacity = s.steam * 0.32 * Math.sin(Math.PI * t);
            const k = p.r * (1 + 2.2 * t);
            return <sprite key={i} material={p.mat} position={[BATH_X + p.x + 0.1 * Math.sin(5 * t + i), y, 0.2 + p.z]} scale={[k, k, k]} />;
          })
        : null}
    </>
  );
};
