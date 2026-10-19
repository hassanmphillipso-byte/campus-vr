import * as THREE from 'three';

// Visual assets share geometry/materials. Physics and interaction proxies remain
// the existing objects: a ball visual never creates a second rigid body.
export class OpenSportsAssets {
  constructor(loader) {
    this.loader = loader;
    this.prototypes = new Map();
    this.errors = [];
    this.tables = [];
    this.props = [];
    this.balls = [];
    this.ready = false;
    this.bytes = 0;
  }
  async load() {
    try {
      const response = await fetch('assets/sports/manifest.json');
      if (!response.ok) throw Error('Sports manifest ' + response.status);
      const { assets } = await response.json();
      await Promise.all(assets.map(async asset => {
        try {
          const gltf = await this.loader.loadAsync('assets/sports/' + asset.file);
          gltf.scene.traverse(o => {
            if (o.isMesh) { o.castShadow = o.receiveShadow = true; }
          });
          gltf.scene.userData.openSports = asset.id;
          this.prototypes.set(asset.id, gltf.scene);
          this.bytes += asset.bytes;
        } catch (e) {
          this.errors.push({ asset: asset.id, error: String(e) });
        }
      }));
    } catch (e) { this.errors.push({ asset: 'manifest', error: String(e) }); }
    this.ready = true;
    for (const error of this.errors) console.warn('[sports-assets]', error);
    return this;
  }
  clone(id) { return this.prototypes.get(id)?.clone(true) || null; }
  installTable(group) {
    const visual = this.clone('table-tennis-table');
    if (!visual) return false;
    group.clear();
    group.add(visual);
    group.updateMatrixWorld(true);
    const bounds = new THREE.Box3().setFromObject(group);
    this.tables.push({ position: group.position.toArray(),
      bounds: { min: bounds.min.toArray(), max: bounds.max.toArray() } });
    return true;
  }
  equipmentRack() {
    const rack = new THREE.Group();
    const colliders = [];
    const frame = new THREE.MeshStandardMaterial({ color: 0x344957, metalness: .35, roughness: .6 });
    const shelf = new THREE.MeshStandardMaterial({ color: 0xc7ac7f, roughness: .8 });
    const add = (w, h, d, x, y, z, mat) => {
      const mesh = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat);
      mesh.position.set(x, y, z); mesh.castShadow = mesh.receiveShadow = true; rack.add(mesh);
      colliders.push({ minX: -4 + x - w / 2, maxX: -4 + x + w / 2,
        minZ: -60.5 + z - d / 2, maxZ: -60.5 + z + d / 2, y0: y - h / 2, y1: y + h / 2 });
    };
    add(2, .05, .54, 0, .655, 0, shelf);
    for (const x of [-.88, .88]) for (const z of [-.19, .19]) add(.045, .63, .045, x, .315, z, frame);
    for (const z of [-.25, .25]) add(2, .07, .03, 0, .715, z, frame);
    for (const x of [-.98, .98]) add(.03, .07, .5, x, .715, 0, frame);
    rack.position.set(-4, 0, -60.5);
    rack.userData.colliders = colliders;
    return rack;
  }
  dressBall(ball, id) {
    if (ball.mesh.userData.openSports) return false;
    const visual = this.clone(id);
    if (!visual) return false;
    // Keep the spherical root for the existing non-recursive click raycast.
    // Its material is hidden; visible CC0 children inherit radius and rotation.
    ball.mesh.material = ball.mesh.material.clone();
    ball.mesh.material.visible = false;
    ball.mesh.add(visual);
    ball.mesh.userData.openSports = id;
    this.balls.push(ball);
    return true;
  }
  dressProp(group, id, scale, actor) {
    if (group.userData.openSports) return false;
    const visual = this.clone(id);
    if (!visual) return false;
    for (const child of group.children) child.visible = false;
    visual.scale.setScalar(scale);
    group.add(visual);
    group.userData.openSports = id;
    this.props.push({ actor, group });
    return true;
  }
  actorProps(actor) {
    const props = actor.activity?.props;
    if (!props) return;
    if (props.paddle) this.dressProp(props.paddle, 'table-tennis-paddle', 1, actor.n);
    if (props.ball) this.dressProp(props.ball, 'basketball', .12, actor.n);
    if (props['ping-ball']) this.dressProp(props['ping-ball'], 'table-tennis-ball', .02, actor.n);
  }
  state() {
    return { ready: this.ready, loaded: [...this.prototypes.keys()], errors: this.errors,
      bytes: this.bytes, tables: this.tables,
      balls: this.balls.map(b => ({ index: b.sportsIndex, asset: b.mesh.userData.openSports,
        radius: b.r, held: b.held, position: b.mesh.position.toArray(),
        physics: b.body.translation(), bodyType: Number(b.body.bodyType()) })),
      props: this.props.map(({ actor, group }) => ({ actor, asset: group.userData.openSports,
        visible: group.visible, position: group.position.toArray() })) };
  }
}
