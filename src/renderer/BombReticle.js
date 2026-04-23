// BombReticle — visual targeting overlay shown during bomb placement mode.
//
// Renders a sweeping horizontal band across the road at the current pointer
// Y position, showing the blast zone width.  Highlights cars within the zone.
// Disappears when bomb mode is cancelled or a bomb is placed.
import { Graphics, Text, Container } from 'pixi.js';
import {
  ROAD_TOP_Y, ROAD_BOTTOM_Y,
  posToScreenY,
} from './LaneRenderer.js';

// How many road-position units the bomb blast reaches up and down.
const BLAST_POS_RADIUS = 22;   // must match BOMB_POS_RADIUS in GameLoop.js

// Width of the sweep band in screen pixels at a given Y
function bandWidthAt(screenY) {
  const t = (screenY - ROAD_TOP_Y) / (ROAD_BOTTOM_Y - ROAD_TOP_Y);
  // Road narrows from 390 px at bottom to 160 px at top
  return 160 + t * (390 - 160);
}
function bandXAt(screenY) {
  const t = (screenY - ROAD_TOP_Y) / (ROAD_BOTTOM_Y - ROAD_TOP_Y);
  return (1 - t) * 115;  // left edge of road (115 at top, 0 at bottom)
}

export class BombReticle {
  constructor(layerManager, appW) {
    this._appW       = appW;
    this._layer      = layerManager.get('hudLayer');
    this._container  = new Container();
    this._container.visible = false;
    this._layer.addChild(this._container);

    this._bg    = new Graphics();          // band fill
    this._edge  = new Graphics();          // animated sweep line edges
    this._label = new Text({
      text: 'TAP TO PLACE BOMB',
      style: {
        fontSize:   14,
        fontWeight: 'bold',
        fill:       0xffdd00,
        dropShadow: { color: 0x000000, blur: 6, distance: 2, alpha: 0.9 },
      },
    });
    this._label.anchor.set(0.5, 0.5);

    this._cancelBtn = new Text({
      text: '✕ CANCEL',
      style: {
        fontSize:   15,
        fontWeight: 'bold',
        fill:       0xff6644,
        dropShadow: { color: 0x000000, blur: 4, distance: 1, alpha: 0.8 },
      },
    });
    this._cancelBtn.anchor.set(0.5, 0.5);
    this._cancelBtn.eventMode = 'static';
    this._cancelBtn.cursor    = 'pointer';

    this._container.addChild(this._bg);
    this._container.addChild(this._edge);
    this._container.addChild(this._label);
    this._container.addChild(this._cancelBtn);

    this._animT     = 0;
    this._pointerY  = ROAD_BOTTOM_Y * 0.6;  // default center of road
  }

  show() {
    this._container.visible = true;
  }

  hide() {
    this._container.visible = false;
  }

  setPointerY(y) {
    this._pointerY = Math.max(ROAD_TOP_Y + 10, Math.min(ROAD_BOTTOM_Y - 10, y));
  }

  onCancel(cb) {
    this._cancelBtn.on('pointerdown', cb);
  }

  // Convert screen Y to road position (0-100).
  screenYToPos(y) {
    return Math.max(0, Math.min(100, (y - ROAD_TOP_Y) / (ROAD_BOTTOM_Y - ROAD_TOP_Y) * 100));
  }

  update(dt, lanes) {
    if (!this._container.visible) return;
    this._animT += dt;

    const cy  = this._pointerY;
    const pos = this.screenYToPos(cy);

    // Calculate top and bottom of blast band in screen Y
    const topPos    = Math.max(0, pos - BLAST_POS_RADIUS);
    const botPos    = Math.min(100, pos + BLAST_POS_RADIUS);
    const topScreenY = posToScreenY(topPos);
    const botScreenY = posToScreenY(botPos);

    // Band fill — semi-transparent amber rect clipped to road trapezoid
    this._bg.clear();
    // Gradient effect using two rects at different alphas
    this._bg.rect(0, topScreenY, this._appW, botScreenY - topScreenY);
    this._bg.fill({ color: 0xff6600, alpha: 0.22 });
    // Bright center line at exact pointer position
    this._bg.rect(0, cy - 1, this._appW, 3);
    this._bg.fill({ color: 0xffaa00, alpha: 0.55 });

    // Animated edge lines (sweep pulse)
    const sweep = Math.sin(this._animT * 5) * 0.5 + 0.5;
    this._edge.clear();
    this._edge.rect(0, topScreenY, this._appW, 2);
    this._edge.fill({ color: 0xffdd00, alpha: 0.55 + sweep * 0.35 });
    this._edge.rect(0, botScreenY - 2, this._appW, 2);
    this._edge.fill({ color: 0xffdd00, alpha: 0.55 + sweep * 0.35 });

    // Count cars in blast zone for label
    let carsInZone = 0;
    if (lanes) {
      for (const lane of lanes) {
        for (const car of lane.cars) {
          if (Math.abs(car.position - pos) <= BLAST_POS_RADIUS) carsInZone++;
        }
      }
    }

    this._label.text = carsInZone > 0
      ? `BLAST ZONE  •  ${carsInZone} CAR${carsInZone !== 1 ? 'S' : ''}`
      : 'BLAST ZONE  •  NO TARGETS';
    this._label.x = this._appW / 2;
    this._label.y = cy - 18;

    this._cancelBtn.x = this._appW / 2;
    this._cancelBtn.y = ROAD_BOTTOM_Y + 24;
  }

  destroy() {
    this._container.destroy({ children: true });
  }
}
