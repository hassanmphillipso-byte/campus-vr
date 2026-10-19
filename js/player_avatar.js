import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';

const TAU = Math.PI * 2;
const UP = new THREE.Vector3(0, 1, 0);
const clamp = THREE.MathUtils.clamp;
const smooth = t => t * t * (3 - 2 * t);
const angleDelta = (a, b) => Math.atan2(Math.sin(a - b), Math.cos(a - b));
const point = v => Object.freeze({ x: v.x, y: v.y, z: v.z });
const world = o => o.getWorldPosition(new THREE.Vector3());

// The MakeHuman rig has two deform bones in each limb segment. Solve the
// shoulder/elbow/wrist (or hip/knee/ankle) chain, retaining those helper bones.
function aimJoint(bone, endpoint, target) {
  const origin = world(bone);
  const from = world(endpoint).sub(origin);
  const to = target.clone().sub(origin);
  if (from.lengthSq() < 1e-10 || to.lengthSq() < 1e-10) return;
  const delta = new THREE.Quaternion().setFromUnitVectors(from.normalize(), to.normalize());
  const rotation = bone.getWorldQuaternion(new THREE.Quaternion()).premultiply(delta);
  bone.quaternion.copy(bone.parent.getWorldQuaternion(new THREE.Quaternion()).invert().multiply(rotation));
  bone.updateWorldMatrix(false, true);
}

function solveLimb(limb, target, pole) {
  const a = world(limb.upper);
  const direction = target.clone().sub(a);
  const requested = direction.length();
  if (requested < 1e-7) direction.set(0, -1, 0); else direction.divideScalar(requested);
  const distance = clamp(requested, Math.abs(limb.a - limb.b) + .0001, limb.a + limb.b - .0001);
  const bend = pole.clone().sub(a).addScaledVector(direction, -pole.clone().sub(a).dot(direction));
  if (bend.lengthSq() < 1e-8) {
    bend.crossVectors(direction, UP);
    if (bend.lengthSq() < 1e-8) bend.set(1, 0, 0);
  }
  bend.normalize();
  const along = (limb.a * limb.a + distance * distance - limb.b * limb.b) / (2 * distance);
  const height = Math.sqrt(Math.max(0, limb.a * limb.a - along * along));
  const elbow = a.clone().addScaledVector(direction, along).addScaledVector(bend, height);
  const reachable = a.clone().addScaledVector(direction, distance);
  aimJoint(limb.upper, limb.middle, elbow);
  aimJoint(limb.middle, limb.end, reachable);
  limb.target.copy(target);
  limb.error = world(limb.end).distanceTo(target);
}

function setWorldRotation(bone, rotation) {
  bone.quaternion.copy(bone.parent.getWorldQuaternion(new THREE.Quaternion()).invert().multiply(rotation));
  bone.updateWorldMatrix(false, true);
}

/** Visible body only: no changes to the player's physics, camera or held ball.
 * position is the player's foot-level world position, yaw uses Three's camera
 * Y rotation, and groundHeight(x,z) returns a world-space surface elevation.
 */
export class PlayerAvatar {
  static async load({ scene, camera, url = 'assets/player/player.glb', onFootstep = null }) {
    const gltf = await new GLTFLoader().loadAsync(url);
    return new PlayerAvatar(scene, camera, gltf.scene, { onFootstep });
  }

  constructor(scene, camera, model, { onFootstep = null } = {}) {
    this.onFootstep = onFootstep;
    this.footstepCount = 0;
    this.lastFootstep = null;
    this.camera = camera;
    this.root = new THREE.Group();
    this.root.name = 'FirstPersonPlayer';
    this.root.add(model);
    this.model = model;
    this.bones = {};
    this.rest = new Map();
    this.meshes = [];
    this.triangles = 0;
    model.traverse(o => {
      if (o.isBone) {
        this.bones[o.name] = o;
        this.rest.set(o, o.quaternion.clone());
      }
      if (!o.isMesh) return;
      o.castShadow = o.receiveShadow = true;
      o.frustumCulled = false; // Limb poses can extend outside the rest bounds.
      const triangles = (o.geometry.index?.count ?? o.geometry.attributes.position.count) / 3;
      this.triangles += triangles;
      const shadowOnly = /head/i.test(o.name);
      if (shadowOnly) {
        const hide = material => {
          const copy = material.clone();
          copy.colorWrite = false;
          copy.depthWrite = false;
          return copy;
        };
        o.material = Array.isArray(o.material) ? o.material.map(hide) : hide(o.material);
        // GTAO renders with scene.overrideMaterial, bypassing this mesh's own
        // masks. Keep the head out of that G-buffer as well. Shadow rendering
        // uses the separate onBeforeShadow/onAfterShadow path and is retained.
        let overrideState = null;
        o.onBeforeRender = (_renderer, renderScene, _camera, _geometry, material) => {
          if (!renderScene.overrideMaterial || material !== renderScene.overrideMaterial) return;
          overrideState = { material, colorWrite: material.colorWrite, depthWrite: material.depthWrite };
          material.colorWrite = material.depthWrite = false;
        };
        o.onAfterRender = () => {
          if (!overrideState) return;
          Object.assign(overrideState.material, { colorWrite: overrideState.colorWrite, depthWrite: overrideState.depthWrite });
          overrideState = null;
        };
      }
      this.meshes.push({ object: o, triangles, shadowOnly });
    });
    this.root.updateMatrixWorld(true);
    const makeLimb = (upper, middle, end) => {
      const limb = { upper: this.bones[upper], middle: this.bones[middle], end: this.bones[end], target: new THREE.Vector3(), error: 0 };
      if (!limb.upper || !limb.middle || !limb.end) throw new Error(`PlayerAvatar 缺少骨骼: ${upper}, ${middle}, ${end}`);
      limb.a = world(limb.upper).distanceTo(world(limb.middle));
      limb.b = world(limb.middle).distanceTo(world(limb.end));
      limb.endRotation = limb.end.getWorldQuaternion(new THREE.Quaternion());
      limb.restEnd = world(limb.end);
      limb.sign = Math.sign(world(limb.upper).x) || 1;
      return limb;
    };
    this.arms = {};
    this.legs = {};
    this.fingers = [];
    for (const side of ['L', 'R']) {
      const arm = this.arms[side] = makeLimb(`upperarm01_${side}`, `lowerarm01_${side}`, `wrist_${side}`);
      const leg = this.legs[side] = makeLimb(`upperleg01_${side}`, `lowerleg01_${side}`, `foot_${side}`);
      leg.anchor = null;
      leg.swingStart = null;
      leg.wasStance = true;
      leg.footNormal = UP.clone();
      let bindSole = Infinity;
      for (const { object } of this.meshes.filter(item => item.object.name.startsWith(`Shoe_${side}`))) {
        object.skeleton?.update();
        const vertex = new THREE.Vector3();
        for (let i = 0; i < object.geometry.attributes.position.count; i++) {
          object.getVertexPosition(i, vertex).applyMatrix4(object.matrixWorld);
          bindSole = Math.min(bindSole, vertex.y);
        }
      }
      leg.bindSole = Number.isFinite(bindSole) ? bindSole : 0;
      leg.soleOffset = clamp(leg.restEnd.y - leg.bindSole, .02, .15);
      // Derive the hand's rest frame from actual metacarpal positions, not bone Euler axes.
      const middle = this.bones[`finger3_1_${side}`];
      const index = this.bones[`finger2_1_${side}`];
      const little = this.bones[`finger5_1_${side}`];
      if (middle && index && little) {
        arm.handDirection = world(middle).sub(world(arm.end)).normalize();
        const spread = world(index).sub(world(little)).normalize();
        arm.palmNormal = new THREE.Vector3().crossVectors(spread, arm.handDirection).normalize();
        // Rest palms face inward towards the thighs.
        if (arm.palmNormal.x * arm.sign > 0) arm.palmNormal.negate();
        arm.palmLength = clamp(world(middle).distanceTo(world(arm.end)) * .6, .045, .095);
      } else {
        arm.handDirection = new THREE.Vector3(0, -1, 0);
        arm.palmNormal = new THREE.Vector3(-arm.sign, 0, 0);
        arm.palmLength = .06;
      }
      arm.gripWeight = 0;
      arm.poseTarget = null;
      arm.poseRotation = null;
      for (let finger = 1; finger <= 5; finger++) {
        for (let segment = 1; segment <= 3; segment++) {
          const bone = this.bones[`finger${finger}_${segment}_${side}`];
          if (!bone) continue;
          const next = bone.children.find(child => child.isBone);
          const direction = next ? world(next).sub(world(bone)).normalize() : arm.handDirection.clone();
          const axis = new THREE.Vector3().crossVectors(direction, arm.palmNormal).normalize();
          axis.applyQuaternion(bone.getWorldQuaternion(new THREE.Quaternion()).invert());
          // The thumb's metacarpal opposes towards the index, rather than
          // folding on the other four fingers' hinge plane.
          let oppositionAxis = null;
          if (finger === 1 && segment === 1 && index) {
            const across = world(this.bones[`finger2_2_${side}`] || index).sub(world(bone)).normalize();
            oppositionAxis = new THREE.Vector3().crossVectors(direction, across).normalize();
            oppositionAxis.applyQuaternion(bone.getWorldQuaternion(new THREE.Quaternion()).invert());
          }
          this.fingers.push({ bone, axis, oppositionAxis, side, finger, segment, curl: 0, opposition: 0 });
        }
      }
    }
    this.bindGroundOffset = clamp((this.legs.L.bindSole + this.legs.R.bindSole) * .5, 0, .10);
    this.lookDown = 0;
    this.wasMoving = false;
    this.lastPosition = null;
    this.velocity = new THREE.Vector3();
    this.direction = new THREE.Vector3(0, 0, -1);
    this.speed = 0;
    this.actualSpeed = 0;
    this.phase = 0;
    this.elapsed = 0;
    this.moveWeight = 0;
    this.runWeight = 0;
    this.holdWeight = 0;
    this.throwTime = 0;
    this.swimming = false;
    this.blocked = false;
    this.held = null;
    this.contactTargets = {};
    // R has negative authored X; with the +PI body orientation it is the
    // camera-right hand. Determine that from bind positions, not bone labels.
    this.rightHand = Object.keys(this.arms).reduce((a, b) => this.arms[a].restEnd.x < this.arms[b].restEnd.x ? a : b);
    this.gripMode = 'none';
    this.activeHands = [];
    this.bodyYaw = null;
    this.lastYaw = null;
    this.yawLag = 0;
    this.turnSpeed = 0;
    this.turnWeight = 0;
    this.turnPhase = 0;
    this.turning = false;
    this.terrainWeight = 0;
    scene.add(this.root);
  }

  setEnabled(enabled) { this.root.visible = !!enabled; }

  notifyThrow() { this.throwTime = .3; }

  local(x, y, z) { return this.root.localToWorld(new THREE.Vector3(x, y, z)); }

  update({ dt, position, yaw = 0, pitch = 0, running = false, blocked = false, swimming = false, groundHeight = () => position.y, held = null }) {
    const elapsed = Number.isFinite(dt) ? Math.max(0, dt) : 0;
    const step = Math.min(.06, elapsed);
    const delta = this.lastPosition ? new THREE.Vector3().subVectors(position, this.lastPosition) : new THREE.Vector3();
    const teleported = !this.lastPosition || delta.length() > 1 || elapsed > .25;
    this.lastPosition = position.clone();
    delta.y = 0;
    const distance = teleported ? 0 : delta.length();
    this.velocity.copy(delta).multiplyScalar(!teleported && elapsed > 0 ? 1 / elapsed : 0);
    this.actualSpeed = this.velocity.length();
    this.blocked = !!blocked;
    this.swimming = !!swimming;
    this.teleported = teleported;
    this.gripMode = held ? (held.radius <= .075 ? 'single' : 'both') : 'none';
    this.activeHands = this.gripMode === 'single' ? [this.rightHand] : this.gripMode === 'both' ? ['L', 'R'] : [];
    this.held = held ? { position: held.position.clone(), radius: Math.max(.02, held.radius || .12) } : null;
    this.elapsed += step;
    this.throwTime = Math.max(0, this.throwTime - step);
    const moving = !blocked && distance > .00015 && this.actualSpeed > .035;
    this.wasMoving = moving;
    const alpha = 1 - Math.exp(-step * 13);
    this.speed = THREE.MathUtils.lerp(this.speed, moving ? this.actualSpeed : 0, alpha);
    this.moveWeight = THREE.MathUtils.lerp(this.moveWeight, moving ? 1 : 0, alpha);
    this.runWeight = THREE.MathUtils.lerp(this.runWeight, running && moving ? 1 : 0, alpha);
    this.holdWeight = THREE.MathUtils.lerp(this.holdWeight, held ? 1 : 0, 1 - Math.exp(-step * 20));
    if (teleported) {
      this.speed = this.moveWeight = this.runWeight = 0;
      this.phase = 0;
      for (const leg of Object.values(this.legs)) leg.anchor = leg.swingStart = null;
    }
    if (moving) this.direction.copy(delta).normalize();
    const ground = (x, z) => {
      const height = groundHeight(x, z);
      return Number.isFinite(height) ? height : position.y;
    };
    this.airborne = !swimming && position.y - ground(position.x, position.z) > .13;
    const ahead = position.clone().addScaledVector(this.direction, .16);
    const behind = position.clone().addScaledVector(this.direction, -.16);
    const slope = swimming ? 0 : Math.abs(ground(ahead.x, ahead.z) - ground(behind.x, behind.z)) / .32;
    const terrain = this.airborne ? 0 : clamp(slope / .65, 0, 1);
    this.terrainWeight = teleported ? terrain : THREE.MathUtils.lerp(this.terrainWeight, terrain, 1 - Math.exp(-step * 10));
    // stride is the distance of one complete SAME-foot cycle; there are
    // two footfalls per cycle. Match cadence to controller speed, including
    // the faster walking controller, instead of doubling the old step rate.
    const gaitSpeed = moving ? this.actualSpeed : this.speed;
    this.cadence = clamp(1.35 + gaitSpeed * .35, 1.35, 3.8) * (1 + this.terrainWeight * .06);
    this.stride = clamp(2 * gaitSpeed / this.cadence, .38, 4.0);
    // +Z is the authored character front; the camera looks down local -Z.
    const previousBodyYaw = this.bodyYaw ?? yaw;
    const maxLag = this.held ? .12 : running && moving ? .16 : .28;
    this.bodyYaw = teleported ? yaw : previousBodyYaw + angleDelta(yaw, previousBodyYaw) * (1 - Math.exp(-step * (moving ? 9 : 6)));
    this.yawLag = clamp(angleDelta(yaw, this.bodyYaw), -maxLag, maxLag);
    this.bodyYaw = yaw - this.yawLag;
    const yawSpeed = teleported || this.lastYaw === null || elapsed === 0 ? 0 : angleDelta(yaw, this.lastYaw) / elapsed;
    this.lastYaw = yaw;
    this.turnSpeed = THREE.MathUtils.lerp(this.turnSpeed, yawSpeed, 1 - Math.exp(-step * 12));
    this.turning = !moving && !blocked && !swimming && !this.airborne && !teleported && Math.abs(this.turnSpeed) > .20;
    this.turnWeight = THREE.MathUtils.lerp(this.turnWeight, this.turning ? clamp(Math.abs(this.turnSpeed) / 2, 0, 1) : 0, alpha);
    if (this.turning) this.turnPhase = (this.turnPhase + Math.abs(angleDelta(this.bodyYaw, previousBodyYaw)) / .62) % 1;
    if (teleported) this.turnPhase = this.turnSpeed = this.turnWeight = 0;
    this.root.rotation.set(0, this.bodyYaw + Math.PI, 0);
    const forward = new THREE.Vector3(-Math.sin(yaw), 0, -Math.cos(yaw));
    const lookDown = smooth(clamp((-pitch - .45) / .65, 0, 1));
    this.lookDown = lookDown;
    const rearOffset = .10 + .14 * lookDown * (1 - this.holdWeight);
    this.root.position.copy(position).addScaledVector(forward, -rearOffset);
    this.root.position.y -= this.bindGroundOffset + lookDown * .02 + this.moveWeight * (.035 + this.runWeight * .025) + this.terrainWeight * .10;
    for (const [bone, rotation] of this.rest) bone.quaternion.copy(rotation);
    this.root.updateMatrixWorld(true);
    // A short-legged rig cannot keep a distant support point planted through
    // a long sprint cycle. Derive contact duration from actual hip height and
    // leg reach; the airborne foot travels with the body during its swing.
    const supportReach = Math.min(...Object.values(this.legs).map(leg => {
      const hip = world(leg.upper);
      const vertical = Math.abs(hip.y - ground(hip.x, hip.z) - leg.soleOffset);
      return Math.sqrt(Math.max(.0025, (leg.a + leg.b - .008) ** 2 - vertical ** 2));
    }));
    this.duty = clamp(2 * supportReach * .82 / this.stride, .04, .62);
    if (moving) this.phase = (this.phase + distance / this.stride * TAU) % TAU;
    this.groundHeight = ground;
    for (const side of ['L', 'R']) this.updateLeg(side, step, moving, ground, position);
    for (const side of ['L', 'R']) this.updateArm(side, pitch, step);
    this.updateFingers(step);
    this.root.updateMatrixWorld(true);
    for (const side of ['L', 'R']) {
      const leg = this.legs[side];
      if (!leg.landed || teleported || blocked || swimming || this.airborne || !moving || this.actualSpeed < .08 || leg.error > .012) continue;
      const sole = this.measureSole(side);
      if (!sole || Math.abs(sole.gap) > .018) continue;
      const event = Object.freeze({ side, speed: this.actualSpeed, running: this.runWeight > .5, position: sole.position });
      this.lastFootstep = event;
      this.footstepCount++;
      if (typeof this.onFootstep === 'function') this.onFootstep(event);
    }
  }

  updateLeg(side, dt, moving, ground, position) {
    const limb = this.legs[side];
    const turning = this.turning && !moving;
    const gait = moving || turning;
    const phase = ((turning ? this.turnPhase : this.phase / TAU) + (side === 'R' ? .5 : 0)) % 1;
    const duty = turning ? .56 : this.duty;
    const stride = turning ? 0 : this.stride;
    const previouslySupported = !!limb.support;
    limb.landed = false;
    const halfSupport = stride * duty * .5;
    // Anchors retain a terrain-height reference WITHOUT shoe tilt lift.
    // outputTarget/IK targets are actual ankle positions WITH that lift.
    const previousNormalLift = limb.soleOffset * (1 / limb.footNormal.y - 1);
    const neutral = this.local(limb.sign * .10, 0, .015 + this.lookDown * .125 * (1 - this.moveWeight));
    neutral.y = ground(neutral.x, neutral.z) + limb.soleOffset;
    if (!limb.anchor) {
      limb.anchor = neutral.clone();
      limb.swingStart = neutral.clone();
      limb.swingLocal = this.root.worldToLocal(neutral.clone());
      limb.wasStance = phase < duty;
    }
    let target;
    if (this.swimming) {
      target = this.local(limb.sign * .12, .15 + Math.max(0, Math.sin(phase * TAU)) * .15, -.14 + Math.sin(phase * TAU) * .13);
      limb.anchor.copy(neutral);
    } else if (this.airborne) {
      target = this.local(limb.sign * .10, limb.soleOffset + .08, .04 + Math.sin(phase * TAU) * .06);
      limb.anchor = limb.swingStart = null;
      limb.wasStance = false;
    } else if (!gait) {
      // Preserve the current lifted foot when stopping, then lower it gently.
      if (!limb.wasStance) {
        limb.anchor.copy(limb.target);
        limb.anchor.y -= previousNormalLift;
      }
      limb.anchor.lerp(neutral, 1 - Math.exp(-dt * 12));
      target = limb.anchor.clone();
      limb.swingStart.copy(target);
      limb.wasStance = true;
    } else if (phase < duty) {
      if (!limb.wasStance) {
        limb.anchor.copy(limb.target);
        limb.anchor.y -= previousNormalLift;
      }
      const supportHeight = ground(limb.anchor.x, limb.anchor.z) + limb.soleOffset;
      // A short stop can leave this foot suspended. Lower from its actual
      // position before claiming contact instead of snapping to the surface.
      limb.anchor.y = Math.max(supportHeight, limb.anchor.y - dt * 2.1);
      target = limb.anchor.clone();
      limb.wasStance = true;
    } else {
      const phaseT = (phase - duty) / (1 - duty);
      if (limb.wasStance) {
        limb.swingStart.copy(limb.target);
        limb.swingLocal = this.root.worldToLocal(limb.target.clone());
        limb.swingEntry = phaseT;
        limb.swingLift = Math.max(0, limb.target.y - ground(limb.target.x, limb.target.z) - limb.soleOffset - previousNormalLift);
      }
      // Enter the remaining swing from zero, even when restarting in the
      // middle of a cycle. The first frame retains the measured foot point.
      const t = clamp((phaseT - (limb.swingEntry || 0)) / Math.max(.08, 1 - (limb.swingEntry || 0)), 0, 1);
      const landing = neutral.clone().addScaledVector(this.direction, halfSupport);
      landing.y = ground(landing.x, landing.z) + limb.soleOffset;
      target = this.root.localToWorld(limb.swingLocal.clone()).lerp(landing, smooth(t));
      const lift = (turning ? .045 : .075 + .10 * this.runWeight) * Math.sqrt(Math.max(.05, 1 - (limb.swingEntry || 0)));
      target.y = ground(target.x, target.z) + limb.soleOffset + (limb.swingLift || 0) * (1 - smooth(t)) + Math.sin(Math.PI * t) * Math.max(.025, lift - (limb.swingLift || 0) * .5);
      limb.wasStance = false;
    }
    // A step onto a platform can put the controller above an old support foot.
    // Limit stale anchors to the neighbourhood of the player after such a step.
    if (!this.airborne && target.distanceTo(neutral) > (turning ? .22 : .75)) {
      target.copy(neutral);
      limb.anchor.copy(neutral);
      limb.swingStart.copy(neutral);
    }
    // A rising controller can leave the previous planted foot beyond leg
    // reach. Replant at the closest reachable point towards the current step,
    // instead of letting IK lift the shoe away from its requested support.
    const hip = world(limb.upper);
    const reach = limb.a + limb.b - .005;
    if (!this.swimming && !this.airborne && hip.distanceTo(target) > reach) {
      const lift = Math.max(0, target.y - ground(target.x, target.z) - limb.soleOffset);
      const original = target.clone();
      for (let i = 1; i <= 12; i++) {
        target.copy(original).lerp(neutral, i / 12);
        target.y = ground(target.x, target.z) + limb.soleOffset + lift * (1 - i / 12);
        if (hip.distanceTo(target) <= reach) break;
      }
      limb.anchor.copy(target);
      limb.swingStart.copy(target);
      limb.wasStance = false;
    }
    const footRotation = this.root.getWorldQuaternion(new THREE.Quaternion()).multiply(limb.endRotation);
    if (!this.swimming && !this.airborne) {
      const dx = (ground(target.x + .08, target.z) - ground(target.x - .08, target.z)) / .16;
      const dz = (ground(target.x, target.z + .08) - ground(target.x, target.z - .08)) / .16;
      // Discontinuous ledges are not a vertical walking surface.
      if (Math.hypot(dx, dz) < 1.25) {
        const normal = new THREE.Vector3(-dx, 1, -dz).normalize();
        limb.footNormal.lerp(normal, this.teleported ? 1 : 1 - Math.exp(-dt * 18)).normalize();
        target.y += limb.soleOffset * (1 / limb.footNormal.y - 1);
        footRotation.premultiply(new THREE.Quaternion().setFromUnitVectors(UP, limb.footNormal));
      }
    }
    if (limb.outputTarget && !this.teleported && !this.airborne && !this.swimming) {
      // Bound a renewed swing or recovery from a short stop by real foot
      // travel, while retaining a planted world anchor when it is reachable.
      const travel = target.clone().sub(limb.outputTarget);
      const horizontal = Math.hypot(travel.x, travel.z);
      const limit = dt * Math.max(2.8, this.actualSpeed * 1.30 + .8);
      if (horizontal > limit) {
        target.x = limb.outputTarget.x + travel.x * limit / horizontal;
        target.z = limb.outputTarget.z + travel.z * limit / horizontal;
      }
      target.y = limb.outputTarget.y + clamp(target.y - limb.outputTarget.y, -dt * 1.8, dt * 1.8);
      const normalLift = limb.soleOffset * (1 / limb.footNormal.y - 1);
      target.y = Math.max(target.y, ground(target.x, target.z) + limb.soleOffset + normalLift);
      const horizontalReach = Math.hypot(target.x - hip.x, target.z - hip.z);
      target.y = Math.max(target.y, hip.y - Math.sqrt(Math.max(0, reach * reach - horizontalReach * horizontalReach)));
      if (limb.wasStance) {
        limb.anchor.copy(target);
        limb.anchor.y -= normalLift;
      }
    }
    solveLimb(limb, target, this.local(limb.sign * .12, .5, .7));
    limb.outputTarget = world(limb.end);
    setWorldRotation(limb.end, footRotation);
    const normalLift = !this.swimming && !this.airborne ? limb.soleOffset * (1 / limb.footNormal.y - 1) : 0;
    const soleGap = target.y - ground(target.x, target.z) - limb.soleOffset - normalLift;
    limb.support = !this.swimming && !this.airborne && (!gait || phase < duty) && Math.abs(soleGap) < .018 && limb.error < .012;
    limb.landed = moving && limb.support && !previouslySupported;
  }

  updateArm(side, pitch, dt) {
    const arm = this.arms[side];
    const sign = arm.sign;
    const asymmetry = side === this.rightHand ? .08 : -.035;
    const oscillation = Math.sin(this.phase + (side === 'R' ? Math.PI + .13 : 0));
    const run = this.runWeight * (this.held && !this.activeHands.includes(side) ? .18 : 1);
    const movement = this.moveWeight;
    let target = this.local(sign * .29, .98 + oscillation * movement * .025, .075 + oscillation * movement * .08);
    if (run > .001) {
      // First-person framing needs a slightly raised sprint pose. Compute its
      // lower-frame height from the actual FOV; the classroom uses a narrower
      // lens than the campus. Camera transforms themselves remain untouched.
      const cameraLocal = this.root.worldToLocal(this.camera.getWorldPosition(new THREE.Vector3()));
      const forward = .43 + oscillation * .055 + asymmetry * .2;
      const viewDepth = Math.max(.15, forward - cameraLocal.z);
      const halfHeight = viewDepth * Math.tan(THREE.MathUtils.degToRad(this.camera.fov || 72) * .5);
      const frameHeight = cameraLocal.y - halfHeight * .77;
      const lateral = Math.min(.20 + asymmetry * .2, halfHeight * (this.camera.aspect || 1.6) * .76);
      const frameRotation = this.root.quaternion.clone().multiply(new THREE.Quaternion().setFromAxisAngle(UP, this.yawLag));
      const runTarget = new THREE.Vector3(sign * lateral, clamp(frameHeight + asymmetry * .15, 1.27, 1.63) + oscillation * .018, forward).applyQuaternion(frameRotation).add(this.root.position);
      target.lerp(runTarget, run);
    }
    let pole = this.local(sign * .40, 1.02, -.12);
    let endRotation = this.root.getWorldQuaternion(new THREE.Quaternion()).multiply(arm.endRotation);
    if (run > .001 && !this.held) {
      const direction = new THREE.Vector3(sign * .07, .30 + asymmetry, 1).normalize().applyQuaternion(this.root.quaternion);
      const palm = new THREE.Vector3(-sign, -.22, -.18).normalize().applyQuaternion(this.root.quaternion);
      endRotation.slerp(this.handRotation(arm, direction, palm), run);
    }
    if (this.swimming) {
      target = this.local(sign * (.26 + .08 * Math.cos(this.phase)), 1.13 + .07 * oscillation, .32 + .10 * Math.sin(this.phase));
      pole = this.local(sign * .45, .97, .1);
    }
    if(this.sportAction){
      const a=this.sportAction.phase;
      const narrow=(this.camera.aspect||1.6)<.8;
      target=this.local(sign*((narrow?.12:.29)+.015*Math.cos(a)),(narrow?1.20:1.15)+.025*Math.cos(a),(narrow?.50:.40)+.025*Math.sin(a));
      pole=this.local(sign*.48,1.0,-.08);
    }
    const active = this.activeHands.includes(side);
    arm.gripWeight = THREE.MathUtils.lerp(arm.gripWeight, active ? 1 : 0, 1 - Math.exp(-dt * (active ? 18 : 8)));
    if (active) {
      const ball = this.held;
      const single = this.gripMode === 'single';
      const surfaceNormal = (single ? new THREE.Vector3(sign * .10, -.96, -.25) : new THREE.Vector3(sign, -.30, -.28)).normalize().applyQuaternion(this.root.quaternion);
      const contact = ball.position.clone().addScaledVector(surfaceNormal, ball.radius);
      const handDirection = (single ? new THREE.Vector3(sign * -.10, .36, .93) : new THREE.Vector3(0, .92, .39)).normalize().applyQuaternion(this.root.quaternion);
      arm.gripTarget = contact.clone().addScaledVector(handDirection, -arm.palmLength);
      arm.gripRotation = this.handRotation(arm, handDirection, surfaceNormal.clone().negate());
      arm.gripLocal = this.root.worldToLocal(arm.gripTarget.clone());
      arm.gripLocalRotation = this.root.quaternion.clone().invert().multiply(arm.gripRotation);
      this.contactTargets[side] = contact;
    } else delete this.contactTargets[side];
    if (arm.gripTarget && arm.gripWeight > .001) {
      // Retain the last grip frame throughout release so neither palm nor
      // fingers snap to their idle pose on the first frame after throwing.
      const release = active ? arm.gripTarget.clone() : this.root.localToWorld(arm.gripLocal.clone());
      if (!active && this.throwTime > 0) release.addScaledVector(new THREE.Vector3(0, .035, .08).applyQuaternion(this.root.quaternion), Math.sin(Math.PI * (1 - this.throwTime / .3)));
      target.lerp(release, arm.gripWeight);
      endRotation.slerp(active ? arm.gripRotation : this.root.quaternion.clone().multiply(arm.gripLocalRotation), arm.gripWeight);
      pole = this.local(sign * .40, 1.0, .04);
    }
    // Smooth in the body frame: smoothing absolute world wrist positions
    // would drag both hands backwards by speed / smoothingRate while running.
    const localTarget = this.root.worldToLocal(target.clone());
    if (!arm.poseTarget || this.teleported) {
      arm.poseTarget = localTarget;
      arm.poseRotation = endRotation.clone();
    } else {
      arm.poseTarget.lerp(localTarget, 1 - Math.exp(-dt * 32));
      arm.poseRotation.slerp(endRotation, 1 - Math.exp(-dt * 28));
    }
    solveLimb(arm, this.root.localToWorld(arm.poseTarget.clone()), pole);
    setWorldRotation(arm.end, arm.poseRotation);
  }

  updateFingers(dt) {
    const idle = [0, .12, .20, .16];
    const running = [0, 1.08, 1.14, .66];
    for (const joint of this.fingers) {
      const { bone, axis, oppositionAxis, finger, segment, side } = joint;
      const arm = this.arms[side];
      const asymmetry = side === this.rightHand ? .035 : -.02;
      const run = this.runWeight * (this.held && !this.activeHands.includes(side) ? .18 : 1) * (1 - arm.gripWeight);
      const sizeCurl = this.held ? clamp((.18 - this.held.radius) / .16, 0, 1) : arm.lastSizeCurl || 0;
      if (this.activeHands.includes(side)) arm.lastSizeCurl = sizeCurl;
      const gripCurl = finger === 1 ? [.0, .10, .27, .32][segment] + sizeCurl * .20 : [.0, .33, .49, .34][segment] + sizeCurl * [.0, .38, .47, .31][segment];
      const natural = finger === 1 ? [0, .03, .10, .12][segment] : idle[segment] + (finger - 3) * .025;
      const runCurl = finger === 1 ? [0, .10, .34, .38][segment] : running[segment] + (finger - 3) * .055 + asymmetry;
      const desired = this.sportAction ? (finger===1?[0,.18,.35,.40][segment]:[0,1.10,1.20,.80][segment]) : THREE.MathUtils.lerp(THREE.MathUtils.lerp(natural, runCurl, run), gripCurl, arm.gripWeight);
      joint.curl = THREE.MathUtils.lerp(joint.curl, desired, 1 - Math.exp(-dt * 18));
      const opposed = finger === 1 && segment === 1 ? .12 + run * .50 + arm.gripWeight * (.35 + sizeCurl * .20) : 0;
      joint.opposition = THREE.MathUtils.lerp(joint.opposition, opposed, 1 - Math.exp(-dt * 16));
      if (oppositionAxis) bone.quaternion.multiply(new THREE.Quaternion().setFromAxisAngle(oppositionAxis, joint.opposition));
      bone.quaternion.multiply(new THREE.Quaternion().setFromAxisAngle(axis, joint.curl));
    }
  }

  measureSole(side) {
    const vertex = new THREE.Vector3(), lowest = new THREE.Vector3(0, Infinity, 0);
    for (const { object } of this.meshes) {
      if (!object.name.startsWith(`Shoe_${side}`)) continue;
      object.skeleton?.update();
      for (let i = 0; i < object.geometry.attributes.position.count; i++) {
        object.getVertexPosition(i, vertex).applyMatrix4(object.matrixWorld);
        if (vertex.y < lowest.y) lowest.copy(vertex);
      }
    }
    if (!Number.isFinite(lowest.y)) return null;
    const ground = this.groundHeight?.(lowest.x, lowest.z) ?? 0;
    return Object.freeze({ position: point(lowest), groundHeight: ground, gap: lowest.y - ground });
  }

  handRotation(arm, direction, normal) {
    const aim = new THREE.Quaternion().setFromUnitVectors(arm.handDirection, direction);
    const turned = arm.palmNormal.clone().applyQuaternion(aim);
    const desired = normal.clone().addScaledVector(direction, -normal.dot(direction)).normalize();
    turned.addScaledVector(direction, -turned.dot(direction)).normalize();
    const turn = Math.atan2(new THREE.Vector3().crossVectors(turned, desired).dot(direction), turned.dot(desired));
    return new THREE.Quaternion().setFromAxisAngle(direction, turn).multiply(aim).multiply(arm.endRotation);
  }

  state() {
    const hands = {}, feet = {}, ik = {}, contacts = {}, soles = {};
    const projected = { hands: {}, feet: {} };
    this.camera.updateWorldMatrix(true, false);
    for (const side of ['L', 'R']) soles[side] = this.measureSole(side);
    for (const side of ['L', 'R']) {
      const arm = this.arms[side], leg = this.legs[side];
      projected.hands[side] = point(world(arm.end).project(this.camera));
      projected.feet[side] = point(world(leg.end).project(this.camera));
      hands[side] = point(world(arm.end));
      feet[side] = point(world(leg.end));
      ik[`hand${side}`] = Object.freeze({ residual: arm.error, target: point(arm.target), reach: arm.a + arm.b });
      ik[`foot${side}`] = Object.freeze({ residual: leg.error, target: point(leg.target), reach: leg.a + leg.b, soleOffset: leg.soleOffset, support: !!leg.support });
      if (this.contactTargets[side]) {
        const restLocal = arm.handDirection.clone().applyQuaternion(arm.endRotation.clone().invert());
        const palm = world(arm.end).addScaledVector(restLocal.applyQuaternion(arm.end.getWorldQuaternion(new THREE.Quaternion())), arm.palmLength);
        contacts[side] = Object.freeze({ palm: point(palm), target: point(this.contactTargets[side]), error: palm.distanceTo(this.contactTargets[side]) });
      }
    }
    return Object.freeze({ ready: true, visible: this.root.visible, speed: this.actualSpeed, animationSpeed: this.speed, velocity: point(this.velocity), phase: this.phase, moving: this.moveWeight > .05, moveWeight: this.moveWeight, runWeight: this.runWeight, holding: !!this.held, gripMode: this.gripMode, activeHands: Object.freeze([...this.activeHands]), rightHand: this.rightHand, bodyYaw: this.bodyYaw, yawLag: this.yawLag, turn: Object.freeze({ active: this.turning, speed: this.turnSpeed, weight: this.turnWeight, phase: this.turnPhase }), pose: Object.freeze(Object.fromEntries(Object.entries(this.arms).map(([side, arm]) => [side, Object.freeze({gripWeight: arm.gripWeight, wrist: arm.end.name})]))), fingers: Object.freeze(this.fingers.map(j => Object.freeze({side:j.side,finger:j.finger,segment:j.segment,curl:j.curl,opposition:j.opposition,axis:point(j.axis),oppositionAxis:j.oppositionAxis ? point(j.oppositionAxis) : null,position:point(world(j.bone))}))), footstepCount: this.footstepCount, lastFootstep: this.lastFootstep, holdWeight: this.holdWeight, blocked: this.blocked, swimming: this.swimming, airborne:!!this.airborne, stride:this.stride, cadence:this.cadence, supportDuty:this.duty, terrainWeight:this.terrainWeight, root: point(this.root.position), yaw: this.root.rotation.y, cameraBob: false, camera: Object.freeze({position:point(this.camera.getWorldPosition(new THREE.Vector3())), quaternion:Object.freeze(this.camera.getWorldQuaternion(new THREE.Quaternion()).toArray()), fov:this.camera.fov, pitch:this.camera.rotation.x}), projected:Object.freeze({hands:Object.freeze(projected.hands),feet:Object.freeze(projected.feet)}), soles:Object.freeze(soles), hands: Object.freeze(hands), feet: Object.freeze(feet), ik: Object.freeze(ik), contacts: Object.freeze(contacts), triangles: this.triangles, meshes: Object.freeze(this.meshes.map(({ object, triangles, shadowOnly }) => Object.freeze({ name: object.name, triangles, visible: object.visible, shadowOnly, depthTest: (Array.isArray(object.material) ? object.material : [object.material]).every(m => m.depthTest) }))) });
  }
}
