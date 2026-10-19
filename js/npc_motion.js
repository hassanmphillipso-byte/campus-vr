import * as THREE from 'three';

// Small offsets on authored idle/walk/sit clips. Restore the preceding offset
// before the mixer updates so an unkeyed bone never accumulates rotation.
const offset = new THREE.Quaternion();
const xAxis = new THREE.Vector3(1, 0, 0);
const yAxis = new THREE.Vector3(0, 1, 0);

export function initNaturalMotion(npc) {
  let seed = 2166136261;
  for (const c of npc.n) seed = Math.imul(seed ^ c.charCodeAt(0), 16777619) >>> 0;
  npc.motion = {
    variant: seed % 2 ? 'look-around' : 'quiet',
    phase: (seed % 997) / 997 * Math.PI * 2,
    period: 18 + seed % 13,
    elapsed: (seed % 1009) / 1009 * 30,
    greeting: 0, cooldown: 0, headYaw: 0, headPitch: 0,
    base: new Map(),
  };
}

export function restoreNaturalMotion(npc) {
  if (!npc.motion) return;
  for (const [bone, quaternion] of npc.motion.base) bone.quaternion.copy(quaternion);
}

export function greetNaturally(npc) {
  if (!npc.motion || npc.motion.cooldown > 0) return;
  npc.motion.greeting = 1.5;
  npc.motion.cooldown = 6;
}

function localAxis(npc,bone,axis){
 if(!npc.cast)return axis;
 return axis.clone().applyQuaternion(npc.obj.getWorldQuaternion(new THREE.Quaternion()))
  .applyQuaternion(bone.getWorldQuaternion(new THREE.Quaternion()).invert());
}
export function applyNaturalMotion(npc, dt, talking = false) {
  const m = npc.motion;
  if (!m) return;
  m.elapsed += dt;
  m.cooldown = Math.max(0, m.cooldown - dt);
  m.greeting = Math.max(0, m.greeting - dt);
  for (const bone of [npc.B?.head, npc.B?.torso]) {
    if (!bone) continue;
    if (!m.base.has(bone)) m.base.set(bone, bone.quaternion.clone());
    else m.base.get(bone).copy(bone.quaternion);
  }
  const clip = npc.action?.getClip().name || '';
  const resting = /Idle|Sitting/.test(clip);
  const ph = m.elapsed % m.period;
  const glance = resting && !talking && m.variant === 'look-around' && ph < 3.2
    ? Math.sin(ph / 3.2 * Math.PI) ** 2 * .09 * (Math.sin(m.phase) < 0 ? -1 : 1) : 0;
  const nod = m.greeting > 0 ? Math.sin((1.5 - m.greeting) / 1.5 * Math.PI) ** 2 * .095 : 0;
  m.headYaw = glance;
  m.headPitch = nod;
  if (npc.B?.head) {
    npc.B.head.quaternion.multiply(offset.setFromAxisAngle(localAxis(npc,npc.B.head,yAxis), glance));
    npc.B.head.quaternion.multiply(offset.setFromAxisAngle(localAxis(npc,npc.B.head,xAxis), nod));
  }
  if (resting && npc.B?.torso) {
    npc.B.torso.quaternion.multiply(offset.setFromAxisAngle(localAxis(npc,npc.B.torso,xAxis), Math.sin(m.elapsed * 1.35 + m.phase) * .006));
  }
}
