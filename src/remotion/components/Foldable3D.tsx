// Ilustracao 3D propria do TIPO de aparelho: celular dobravel em formato de livro, generico (sem marca,
// logotipo ou desenho de um modelo comercial especifico). Como na cena do ovo, estado e camera sao funcoes
// do quadro absoluto e das deixas do roteiro, para que planos 3D separados por cartelas mantenham a continuidade.
//
// Deixas: hero (fechado, girando no pedestal), unfold (abre como livro e a tela acende), open (aproxima da tela),
// reveal (a camera recua e sobe; surgem os dobraveis de anos anteriores, um por ano, com o ano na tela),
// still (plano parado do conjunto), snap (zoom de reacao de volta ao aparelho do pedestal), close (fecha).
import React, {useMemo} from 'react';
import * as THREE from 'three';
import {useThree} from '@react-three/fiber';
import {RoomEnvironment} from 'three/examples/jsm/environments/RoomEnvironment.js';
import {interpolate, Easing} from 'remotion';

import type {CueSeg} from '../track.js';

// ---------------------------------------------------------------------------------------------
// Geometria (unidades ~ 10 cm)
// ---------------------------------------------------------------------------------------------
const HALF_W = 0.6; // largura de cada metade
const H = 1.35; // altura
const T = 0.045; // espessura de cada metade
const PEDESTAL_H = 0.7;
const HERO_Y = PEDESTAL_H + H / 2;
export const BG = '#ECE8DF';

/** Dobraveis de anos anteriores: um por ano. Fileiras em arquibancada atras do pedestal (de tras para frente). */
const LINEUP: Array<{year: string; pos: [number, number, number]; body: string; hue: [string, string]}> = [
  {year: '2018', pos: [-1.5, 0.7, -4.6], body: '#2b2f36', hue: ['#2E3B55', '#5B6E8F']},
  {year: '2019', pos: [0, 0.7, -4.6], body: '#3a4a3f', hue: ['#24453A', '#5F8C72']},
  {year: '2020', pos: [1.5, 0.7, -4.6], body: '#6d2a35', hue: ['#4A1E2A', '#9A4B5A']},
  {year: '2021', pos: [-1.5, 0.35, -2.9], body: '#8f949c', hue: ['#3B3F4A', '#7C8496']},
  {year: '2022', pos: [0, 0.35, -2.9], body: '#2e4a6b', hue: ['#1F3550', '#4F79A6']},
  {year: '2023', pos: [1.5, 0.35, -2.9], body: '#c9c3b6', hue: ['#5A5040', '#A89878']},
  {year: '2024', pos: [-1.5, 0, -1.2], body: '#4a3f5c', hue: ['#2F2440', '#7A63A0']},
  {year: '2025', pos: [1.5, 0, -1.2], body: '#1f2226', hue: ['#1C2333', '#55607A']},
];

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
  fov: number;
}
const REVEAL_END: Pose = {pos: [0, 6.2, 8.6], target: [0, 0.75, -2.4], fov: 36};
const CLOSE_UP: Pose = {pos: [0, HERO_Y + 0.05, 4.5], target: [0, HERO_Y, 0], fov: 30};
const CAMERA: Record<string, {from: Pose; to: Pose; snap?: boolean}> = {
  hero: {from: {pos: [1.1, HERO_Y + 0.5, 6.2], target: [0, HERO_Y - 0.1, 0], fov: 30}, to: {pos: [0.45, HERO_Y + 0.1, 4.1], target: [0, HERO_Y, 0], fov: 30}},
  unfold: {from: {pos: [0.2, HERO_Y + 0.08, 4.6], target: [0, HERO_Y, 0], fov: 30}, to: CLOSE_UP},
  open: {from: CLOSE_UP, to: {pos: [0, HERO_Y + 0.02, 4.0], target: [0, HERO_Y, 0], fov: 30}},
  reveal: {from: {pos: [0, HERO_Y + 0.05, 3.9], target: [0, HERO_Y, 0], fov: 30}, to: REVEAL_END},
  still: {from: REVEAL_END, to: REVEAL_END},
  snap: {from: REVEAL_END, to: {pos: [0, HERO_Y + 0.12, 4.4], target: [0, HERO_Y, 0], fov: 30}, snap: true},
  close: {from: {pos: [0.3, HERO_Y + 0.1, 4.4], target: [0, HERO_Y, 0], fov: 30}, to: {pos: [0.6, HERO_Y + 0.3, 5.2], target: [0, HERO_Y - 0.05, 0], fov: 30}},
};

function cameraAt(f: number, track: CueSeg[]): Pose {
  const seg = [...track].reverse().find((s) => f >= s.start) ?? track[0];
  const cam = CAMERA[seg?.cue ?? 'hero'] ?? CAMERA.hero;
  const t = cam.snap ? prog(f, seg.start, seg.start + 6, Easing.out(Easing.cubic)) : prog(f, seg.start, seg.end);
  return {pos: lerp3(cam.from.pos, cam.to.pos, t), target: lerp3(cam.from.target, cam.to.target, t), fov: lerp(cam.from.fov, cam.to.fov, t)};
}

const findSeg = (track: CueSeg[], cue: string) => track.find((s) => s.cue === cue);

/** Estado da cena no quadro absoluto f. */
function sceneState(f: number, track: CueSeg[]) {
  const unfold = findSeg(track, 'unfold');
  const reveal = findSeg(track, 'reveal');
  const close = findSeg(track, 'close');
  // Dobra: 0 = fechado, 1 = aberto.
  let open = unfold ? prog(f, unfold.start + 4, unfold.start + 28, Easing.inOut(Easing.cubic)) : 0;
  if (close) open *= 1 - prog(f, close.start + 4, close.start + 26, Easing.inOut(Easing.cubic));
  const screenOn = unfold ? prog(f, unfold.start + 22, unfold.start + 32) * (close ? 1 - prog(f, close.start, close.start + 6) : 1) : 0;
  // Giro lento no pedestal ate a abertura; de frente depois.
  const spin = unfold ? lerp(-0.55, 0, prog(f, (findSeg(track, 'hero')?.start ?? 0), unfold.start + 10)) : -0.55;
  // Os anteriores surgem um a um, do mais antigo ao mais recente.
  const pops = LINEUP.map((_, i) => (reveal ? interpolate(f, [reveal.start + 14 + i * 4, reveal.start + 22 + i * 4], [0, 1], {...clamp, easing: Easing.out(Easing.back(1.7))}) : 0));
  // A tela do aparelho do pedestal passa a mostrar o ano dele no fim do recuo.
  const heroYear = reveal ? prog(f, reveal.start + 14 + LINEUP.length * 4 + 4, reveal.start + 14 + LINEUP.length * 4 + 10) : 0;
  return {open, screenOn, spin, pops, heroYear};
}

// ---------------------------------------------------------------------------------------------
// Texturas de tela (desenhadas em canvas: papel de parede generico ou o ano em destaque)
// ---------------------------------------------------------------------------------------------
function screenTexture(draw: (g: CanvasRenderingContext2D, w: number, h: number) => void, halves = 2): THREE.CanvasTexture {
  const w = 512 * halves;
  const h = Math.round((w * H) / (halves * HALF_W));
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  const g = c.getContext('2d')!;
  draw(g, w, h);
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 4;
  return tex;
}

function wallpaper(hue: [string, string]) {
  return (g: CanvasRenderingContext2D, w: number, h: number) => {
    const grad = g.createLinearGradient(0, 0, w, h);
    grad.addColorStop(0, hue[0]);
    grad.addColorStop(1, hue[1]);
    g.fillStyle = grad;
    g.fillRect(0, 0, w, h);
    // Grade de icones genericos (quadrados arredondados translucidos), sem marcas.
    const cols = Math.max(3, Math.round((6 * w) / 1024));
    const size = w / cols - 52;
    g.fillStyle = 'rgba(255,255,255,0.22)';
    for (let r = 0; r < 4; r++) {
      for (let k = 0; k < cols; k++) {
        const x = 26 + k * (w / cols);
        const y = 200 + r * (size + 70);
        g.beginPath();
        g.roundRect(x, y, size, size, size * 0.24);
        g.fill();
      }
    }
  };
}

function yearScreen(year: string, hue: [string, string]) {
  return (g: CanvasRenderingContext2D, w: number, h: number) => {
    wallpaper(hue)(g, w, h);
    g.fillStyle = 'rgba(10,12,18,0.55)';
    g.fillRect(0, 0, w, h);
    g.fillStyle = '#FFFFFF';
    g.textAlign = 'center';
    g.textBaseline = 'middle';
    g.font = `700 ${Math.round(w * 0.3)}px "IBM Plex Sans", "DejaVu Sans", sans-serif`;
    g.fillText(year, w / 2, h / 2);
  };
}

/** Recorta metade de uma textura (esquerda ou direita) para cada painel da tela interna continua. */
function halfOf(tex: THREE.CanvasTexture, right: boolean): THREE.Texture {
  const t = tex.clone();
  t.repeat.set(0.5, 1);
  t.offset.set(right ? 0.5 : 0, 0);
  t.needsUpdate = true;
  return t;
}

// ---------------------------------------------------------------------------------------------
// Componentes
// ---------------------------------------------------------------------------------------------
const Environment: React.FC = () => {
  const {gl, scene} = useThree();
  useMemo(() => {
    const pmrem = new THREE.PMREMGenerator(gl);
    scene.environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
    scene.environmentIntensity = 0.6;
    scene.background = new THREE.Color(BG);
    scene.fog = new THREE.Fog(BG, 11, 22);
  }, [gl, scene]);
  return null;
};

const CameraRig: React.FC<{pose: Pose}> = ({pose}) => {
  const {camera} = useThree();
  const cam = camera as THREE.PerspectiveCamera;
  cam.position.set(...pose.pos);
  cam.lookAt(...pose.target);
  if (cam.fov !== pose.fov) {
    cam.fov = pose.fov;
    cam.updateProjectionMatrix();
  }
  cam.updateMatrixWorld();
  return null;
};

const tableMat = new THREE.MeshStandardMaterial({color: '#E4DDD0', roughness: 0.95});
const riserMat = new THREE.MeshStandardMaterial({color: '#D9D2C4', roughness: 0.9});
const pedestalMat = new THREE.MeshStandardMaterial({color: '#F4F1EA', roughness: 0.55});
const standMat = new THREE.MeshStandardMaterial({color: '#1C2333', roughness: 0.4});
const glassOff = new THREE.MeshStandardMaterial({color: '#0b0d12', roughness: 0.08, metalness: 0.2});
const lensMat = new THREE.MeshStandardMaterial({color: '#0d0f14', roughness: 0.05, metalness: 0.4});
const creaseMat = new THREE.MeshStandardMaterial({color: '#000000', transparent: true, opacity: 0.18, roughness: 0.3});

/** Um aparelho dobravel: metade esquerda fixa, metade direita gira na dobradica (eixo vertical, lado da tela). */
const Foldable: React.FC<{open: number; body: THREE.Material; screenL: THREE.Material; screenR: THREE.Material; cover: THREE.Material}> = ({open, body, screenL, screenR, cover}) => {
  const geo = useMemo(
    () => ({
      half: new THREE.BoxGeometry(HALF_W, H, T),
      screen: new THREE.PlaneGeometry(HALF_W - 0.03, H - 0.03),
      hinge: new THREE.CylinderGeometry(T * 0.55, T * 0.55, H - 0.02, 24),
      bump: new THREE.BoxGeometry(0.2, 0.42, 0.02),
      lens: new THREE.CylinderGeometry(0.055, 0.055, 0.025, 32),
      crease: new THREE.PlaneGeometry(0.012, H - 0.03),
    }),
    [],
  );
  // Angulo da metade direita: -PI fechado (tela contra tela), 0 aberto.
  const phi = -Math.PI * (1 - open);
  const a = T / 2;
  return (
    // Centraliza: fechado, o conjunto ocupa so a metade esquerda; aberto, as duas.
    <group position={[lerp(HALF_W / 2, 0, open), 0, lerp(-T / 2, 0, open)]}>
      {/* Metade esquerda */}
      <group position={[-HALF_W / 2, 0, 0]}>
        <mesh geometry={geo.half} material={body} castShadow receiveShadow />
        <mesh geometry={geo.screen} material={screenL} position={[0, 0, a + 0.001]} />
        {/* Camera traseira generica */}
        <mesh geometry={geo.bump} material={body} position={[-HALF_W / 2 + 0.16, H / 2 - 0.27, -a - 0.01]} castShadow />
        <mesh geometry={geo.lens} material={lensMat} position={[-HALF_W / 2 + 0.16, H / 2 - 0.17, -a - 0.025]} rotation={[Math.PI / 2, 0, 0]} />
        <mesh geometry={geo.lens} material={lensMat} position={[-HALF_W / 2 + 0.16, H / 2 - 0.37, -a - 0.025]} rotation={[Math.PI / 2, 0, 0]} />
      </group>
      <mesh geometry={geo.hinge} material={body} position={[0, 0, -a * 0.2]} castShadow />
      <mesh geometry={geo.crease} material={creaseMat} position={[0, 0, a + 0.002]} visible={open > 0.98} />
      {/* Metade direita, girando na dobradica (eixo no lado da tela) */}
      <group position={[0, 0, a]} rotation={[0, phi, 0]}>
        <group position={[HALF_W / 2, 0, -a]}>
          <mesh geometry={geo.half} material={body} castShadow receiveShadow />
          <mesh geometry={geo.screen} material={screenR} position={[0, 0, a + 0.001]} />
          {/* Tela externa (aparece com o aparelho fechado) */}
          <mesh geometry={geo.screen} material={cover} position={[0, 0, -a - 0.001]} rotation={[0, Math.PI, 0]} />
        </group>
      </group>
    </group>
  );
};

export const FoldableScene: React.FC<{absFrame: number; track: CueSeg[]}> = ({absFrame: f, track}) => {
  const s = sceneState(f, track);
  const pose = cameraAt(f, track);
  const mats = useMemo(() => {
    const heroHue: [string, string] = ['#2C2A4A', '#C77D5A'];
    const heroWall = screenTexture(wallpaper(heroHue));
    const heroCover = screenTexture(wallpaper(heroHue), 1);
    const heroYear = screenTexture(yearScreen('2026', ['#A63A2B', '#D9875F']));
    const lit = (map: THREE.Texture) => new THREE.MeshStandardMaterial({map, emissiveMap: map, emissive: new THREE.Color('#ffffff'), emissiveIntensity: 0.85, roughness: 0.25});
    const lineup = LINEUP.map((p) => {
      const tex = screenTexture(yearScreen(p.year, p.hue));
      return {
        body: new THREE.MeshStandardMaterial({color: p.body, metalness: 0.55, roughness: 0.35}),
        l: lit(halfOf(tex, false)),
        r: lit(halfOf(tex, true)),
      };
    });
    return {
      heroBody: new THREE.MeshStandardMaterial({color: '#C9CDD3', metalness: 0.85, roughness: 0.28}),
      heroL: lit(halfOf(heroWall, false)),
      heroR: lit(halfOf(heroWall, true)),
      heroCover: lit(heroCover),
      heroYearL: lit(halfOf(heroYear, false)),
      heroYearR: lit(halfOf(heroYear, true)),
      lineup,
    };
  }, []);
  // Tela do aparelho do pedestal: apagada → acesa (papel de parede) → ano.
  const heroL = s.heroYear > 0.5 ? mats.heroYearL : s.screenOn > 0.02 ? mats.heroL : glassOff;
  const heroR = s.heroYear > 0.5 ? mats.heroYearR : s.screenOn > 0.02 ? mats.heroR : glassOff;
  for (const m of [mats.heroL, mats.heroR]) m.emissiveIntensity = 0.85 * s.screenOn;
  for (const m of [mats.heroL, mats.heroR]) m.color.setScalar(0.15 + 0.85 * s.screenOn);

  return (
    <>
      <Environment />
      <CameraRig pose={pose} />
      <ambientLight intensity={0.2} />
      <directionalLight position={[2.5, 6, 4.5]} intensity={2.4} castShadow shadow-mapSize-width={2048} shadow-mapSize-height={2048} shadow-camera-left={-5} shadow-camera-right={5} shadow-camera-top={6} shadow-camera-bottom={-3} shadow-bias={-0.0004} />
      <directionalLight position={[-3, 3, 3]} intensity={0.7} />
      <directionalLight position={[0, 4, -6]} intensity={0.8} />

      {/* Mesa e arquibancada */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} receiveShadow material={tableMat}>
        <planeGeometry args={[60, 60]} />
      </mesh>
      <mesh material={riserMat} position={[0, 0.175, -3.3]} receiveShadow castShadow>
        <boxGeometry args={[4.6, 0.35, 3.0]} />
      </mesh>
      <mesh material={riserMat} position={[0, 0.525, -4.55]} receiveShadow castShadow>
        <boxGeometry args={[4.6, 0.35, 1.3]} />
      </mesh>

      {/* Pedestal e aparelho em destaque */}
      <mesh material={pedestalMat} position={[0, PEDESTAL_H / 2, 0]} castShadow receiveShadow>
        <cylinderGeometry args={[0.72, 0.78, PEDESTAL_H, 96]} />
      </mesh>
      <group position={[0, HERO_Y + 0.004, 0]} rotation={[0, s.spin, 0]}>
        <Foldable open={s.open} body={mats.heroBody} screenL={heroL} screenR={heroR} cover={s.open < 0.5 ? mats.heroCover : glassOff} />
      </group>

      {/* Dobraveis de anos anteriores, abertos sobre suportes */}
      {LINEUP.map((p, i) =>
        s.pops[i] > 0.001 ? (
          <group key={p.year} position={[p.pos[0], p.pos[1], p.pos[2]]} scale={s.pops[i]}>
            <mesh material={standMat} position={[0, 0.03, 0]} castShadow receiveShadow>
              <boxGeometry args={[0.9, 0.06, 0.36]} />
            </mesh>
            <group position={[0, 0.06 + H / 2, 0]} rotation={[-0.06, 0, 0]}>
              <Foldable open={1} body={mats.lineup[i].body} screenL={mats.lineup[i].l} screenR={mats.lineup[i].r} cover={glassOff} />
            </group>
          </group>
        ) : null,
      )}
    </>
  );
};
