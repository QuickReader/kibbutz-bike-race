// Toon look kit: shared materials, back-face ink outline, and batches that bake many solids
// (with vertex colours) into one fill geometry + one outline geometry = 2 draw calls.
import * as THREE from 'three';

export const INK = new THREE.Color(0x2A2233), FOG = new THREE.Color(0xCDEBFA), FOG_NEAR = 45, FOG_FAR = 150;

const grad = new THREE.DataTexture(new Uint8Array([95, 160, 220, 255]), 4, 1, THREE.RedFormat);
grad.minFilter = grad.magFilter = THREE.NearestFilter; grad.needsUpdate = true;
export const toon = new THREE.MeshToonMaterial({ vertexColors: true, gradientMap: grad });
// flat ground pieces: double sided (no winding worries) and pulled slightly forward against z-fighting
export const toonFlat = new THREE.MeshToonMaterial({ vertexColors: true, gradientMap: grad, side: THREE.DoubleSide, polygonOffset: true, polygonOffsetFactor: -1, polygonOffsetUnits: -1 });
export const toonPlain = new THREE.MeshToonMaterial({ gradientMap: grad });

// Inverted hull: back faces pushed along the welded normal by 0.012 + 0.0035 * depth metres
// (thin parts 0.006 + 0.002 * depth), so the line stays about 2-3 px wide. Works plain, instanced and skinned.
export const outline = new THREE.ShaderMaterial({
  side: THREE.BackSide,
  uniforms: { uInk: { value: INK }, uFog: { value: FOG }, uK: { value: new THREE.Vector4(0.012, 0.0035, 0.006, 0.002) } },
  vertexShader: `#include <common>
    #include <skinning_pars_vertex>
    attribute vec3 onormal; attribute float othin; uniform vec4 uK; varying float vF;
    void main() {
      #include <skinbase_vertex>
      vec3 objectNormal = onormal;
      #include <skinnormal_vertex>
      vec3 transformed = position;
      #include <skinning_vertex>
      #ifdef USE_INSTANCING
        transformed = (instanceMatrix * vec4(transformed, 1.0)).xyz;
        objectNormal = mat3(instanceMatrix) * objectNormal;
      #endif
      vec4 mv = modelViewMatrix * vec4(transformed, 1.0);
      float d = -mv.z; vec2 k = mix(uK.xy, uK.zw, othin);
      mv.xyz += normalize(normalMatrix * objectNormal) * (k.x + k.y * d);
      vF = smoothstep(${FOG_NEAR.toFixed(1)}, ${FOG_FAR.toFixed(1)}, d);
      gl_Position = projectionMatrix * mv;
    }`,
  fragmentShader: `uniform vec3 uInk; uniform vec3 uFog; varying float vF;
    void main() { gl_FragColor = vec4(mix(uInk, uFog, vF), 1.0);
      #include <colorspace_fragment>
    }`,
});

// unit primitives, cached; non-indexed so box faces stay flat
const cache = new Map();
const prim = (key, make) => { let g = cache.get(key); if (!g) cache.set(key, g = make().toNonIndexed()); return g; };
const seg = r => (r >= 0.15 ? [20, 14] : r >= 0.07 ? [14, 10] : [10, 7]);
export const G = {
  sphere: (r, w, h) => { [w, h] = w ? [w, h] : seg(r); return prim(`s${r},${w},${h}`, () => new THREE.SphereGeometry(r, w, h)); },
  caps: (r, len) => prim(`p${r},${len}`, () => new THREE.CapsuleGeometry(r, len, 5, 12)),
  box: (w, h, d) => prim(`b${w},${h},${d}`, () => new THREE.BoxGeometry(w, h, d)),
  cyl: (r, h, s = 14) => prim(`c${r},${h},${s}`, () => new THREE.CylinderGeometry(r, r, h, s)),
  cone: (r, h, s = 18) => prim(`n${r},${h},${s}`, () => new THREE.ConeGeometry(r, h, s)),
  torus: (r, t, rs, ts) => prim(`t${r},${t},${rs},${ts}`, () => new THREE.TorusGeometry(r, t, rs, ts)),
  cap: (r, theta, w = 20, h = 12) => prim(`k${r},${theta},${w},${h}`, () => new THREE.SphereGeometry(r, w, h, 0, Math.PI * 2, 0, theta)),
};

// average normals of coincident vertices so box corners / seams do not split the hull open
function smooth(geo) {
  const p = geo.attributes.position, n = geo.attributes.normal, sum = new Map(), key = i => `${p.getX(i).toFixed(4)},${p.getY(i).toFixed(4)},${p.getZ(i).toFixed(4)}`;
  for (let i = 0; i < p.count; i++) {
    const k = key(i), s = sum.get(k) || [0, 0, 0];
    s[0] += n.getX(i); s[1] += n.getY(i); s[2] += n.getZ(i); sum.set(k, s);
  }
  const o = new Float32Array(p.count * 3);
  for (let i = 0; i < p.count; i++) o.set(sum.get(key(i)), i * 3);
  geo.setAttribute('onormal', new THREE.BufferAttribute(o, 3));
}

const M = new THREE.Matrix4(), N = new THREE.Matrix3(), V = new THREE.Vector3(), P = new THREE.Vector3(), Q = new THREE.Quaternion(), E = new THREE.Euler(), S = new THREE.Vector3();

function bake(items, hull, skinned) {
  const list = hull ? items.filter(i => i.o.outline !== false) : items;
  const n = list.reduce((a, i) => a + i.geo.attributes.position.count, 0);
  const pos = new Float32Array(n * 3), nor = new Float32Array(n * 3), col = hull ? null : new Float32Array(n * 3), thin = hull ? new Float32Array(n) : null;
  const si = skinned ? new Uint16Array(n * 4) : null, sw = skinned ? new Float32Array(n * 4) : null;
  let at = 0;
  for (const it of list) {
    const { geo, o, c } = it, sp = geo.attributes.position, sn = geo.attributes[hull ? 'onormal' : 'normal'];
    if (hull && !sn) smooth(geo);
    const nn = hull ? geo.attributes.onormal : sn;
    P.set(o.x || 0, o.y || 0, o.z || 0); S.set(o.sx ?? 1, o.sy ?? 1, o.sz ?? 1);
    Q.copy(o.q || Q.setFromEuler(E.set(o.rx || 0, o.ry || 0, o.rz || 0)));
    M.compose(P, Q, S);
    if (it.bone) M.premultiply(it.bone.matrixWorld);
    if (it.at) M.premultiply(it.at);
    N.getNormalMatrix(M);
    for (let v = 0; v < sp.count; v++, at++) {
      V.fromBufferAttribute(sp, v).applyMatrix4(M).toArray(pos, at * 3);
      V.fromBufferAttribute(nn, v).applyMatrix3(N).normalize().toArray(nor, at * 3);
      if (hull) thin[at] = o.thin ? 1 : 0; else { col[at * 3] = c.r; col[at * 3 + 1] = c.g; col[at * 3 + 2] = c.b; }
      if (skinned) { si[at * 4] = it.bone.userData.i; sw[at * 4] = 1; }
    }
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  g.setAttribute(hull ? 'onormal' : 'normal', new THREE.BufferAttribute(nor, 3));
  if (hull) g.setAttribute('othin', new THREE.BufferAttribute(thin, 1)); else g.setAttribute('color', new THREE.BufferAttribute(col, 3));
  if (skinned) { g.setAttribute('skinIndex', new THREE.BufferAttribute(si, 4)); g.setAttribute('skinWeight', new THREE.BufferAttribute(sw, 4)); }
  return g;
}

// Static batch. o: {x,y,z, sx,sy,sz, rx,ry,rz | q, thin, outline:false}. `at` = optional Matrix4 placing the solid.
export class Batch {
  items = [];
  add(geo, color, o = {}, at = null) { this.items.push({ geo, c: new THREE.Color(color), o, at }); return this; }
  geometries() { return [bake(this.items, false), bake(this.items, true)]; }
  // fill mesh + hull mesh; for InstancedMesh use .geometries() and build them yourself
  meshes() { const [f, h] = this.geometries(); return [new THREE.Mesh(f, toon), new THREE.Mesh(h, outline)]; }
}

// Batch whose solids are weighted 100% to a bone: one SkinnedMesh pair for a whole animated character.
export class Rig extends Batch {
  bones = [];
  bone(parent, x = 0, y = 0, z = 0) {
    const b = new THREE.Bone(); b.position.set(x, y, z); parent?.add(b);
    b.userData.i = this.bones.length; this.bones.push(b); return b;
  }
  solid(bone, geo, color, o) { this.items.push({ geo, c: new THREE.Color(color), o: o || {}, bone }); return this; }
  // bones[0] must be the root; add it (and these meshes) to the same parent group
  skinned() {
    this.bones[0].updateMatrixWorld(true);
    const sk = new THREE.Skeleton(this.bones);
    return [bake(this.items, false, true), bake(this.items, true, true)].map((g, k) => {
      const m = new THREE.SkinnedMesh(g, k ? outline : toon);
      m.frustumCulled = false; m.bind(sk, m.matrixWorld); return m;
    });
  }
}
