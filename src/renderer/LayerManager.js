// LayerManager — owns all PixiJS display containers in spec-defined Z-order.
// All rendering code requests a container by name rather than creating its own,
// keeping the scene graph predictable and making it easy to toggle whole systems.
//
// Layer order (bottom → top) matches Phase2_Architecture spec section 3:
//   backgroundLayer, laneLayer, carLayer, shooterColumnLayer,
//   activeShooterLayer, particleLayer, hudLayer, dragLayer
import { Container } from 'pixi.js';

const LAYER_NAMES = [
  'backgroundLayer',
  'laneLayer',
  'carLayer',
  'shooterColumnLayer',
  'activeShooterLayer',
  'particleLayer',
  'hudLayer',
  'dragLayer',       // always on top — dragged shooter lives here
];

export class LayerManager {
  constructor(stage) {
    this._layers = {};
    for (const name of LAYER_NAMES) {
      const container  = new Container();
      container.label  = name;
      this._layers[name] = container;
      stage.addChild(container);
    }
  }

  // Return the named container.  Throws loudly on unknown names so callers
  // don't silently draw into the wrong layer.
  get(name) {
    if (!this._layers[name]) throw new Error(`LayerManager: unknown layer "${name}"`);
    return this._layers[name];
  }
}
