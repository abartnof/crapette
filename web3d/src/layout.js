// Layout geometry and card poses for Crapette (Russian Bank)
// Pure JavaScript: NO Three.js dependencies so tests run in pure Node.js.
//
// Units: Centimetres (cm), y up, table top at y = 0.
// Human (Player 0) sits at +z looking towards -z; x runs to human's right.
// Opponent (Player 1) sits at -z looking towards +z.

export const CARD = Object.freeze({
  width: 6.35,
  height: 8.89,
  thickness: 0.03,
  radius: 0.3175,
});

export const RISE = 0.04; // Stack thickness per card in cm
export const LIFT = 3.0;  // Lifted / floating card height in cm
export const CASCADE_STEP_X = 2.2; // Tableau outward cascade step

const ROW_PITCH_Z = 10.5;
const FOUND_X = 4.2;
const TABLEAU_BASE_X = 14.5;
const PLAYER_Z = 28.5;
const PLAYER_SIDE_X = 26.0;
const WASTE_X = 16.0;

export function rowZ(r) {
  return (r - 1.5) * ROW_PITCH_Z;
}

export function slotPositions(aspect = 16 / 9) {
  const { width: W, height: H } = CARD;
  const slots = {};

  const makeSlot = (id, x, z, extra = {}) => {
    return {
      id,
      x,
      y: 0,
      z,
      width: W,
      height: H,
      bounds: {
        minX: x - W / 2,
        maxX: x + W / 2,
        minZ: z - H / 2,
        maxZ: z + H / 2,
      },
      ...extra,
    };
  };

  // 8 Foundations: 2 central columns of 4 rows between the players
  // Left column: h0..h3 (rows 0..3)
  // Right column: h4..h7 (rows 0..3)
  for (let r = 0; r < 4; r++) {
    const z = rowZ(r);
    slots[`h${r}`] = makeSlot(`h${r}`, -FOUND_X, z, { type: "foundation", index: r, col: 0, row: r });
    slots[`h${r + 4}`] = makeSlot(`h${r + 4}`, +FOUND_X, z, { type: "foundation", index: r + 4, col: 1, row: r });
  }

  // 8 Tableau columns: 4 on left (t0..t3) cascading left; 4 on right (t4..t7) cascading right
  for (let r = 0; r < 4; r++) {
    const z = rowZ(r);
    slots[`t${r}`] = makeSlot(`t${r}`, -TABLEAU_BASE_X, z, {
      type: "tableau",
      index: r,
      side: "left",
      row: r,
      dir: -1,
    });
    slots[`t${r + 4}`] = makeSlot(`t${r + 4}`, +TABLEAU_BASE_X, z, {
      type: "tableau",
      index: r + 4,
      side: "right",
      row: r,
      dir: 1,
    });
  }

  // Player 0 (Human at +z facing -z):
  // Reserve 'r' on human's right (+x, +z)
  slots.r = makeSlot("r", +PLAYER_SIDE_X, +PLAYER_Z, { type: "reserve", player: 0 });
  // Stock 's' on human's left (-x, +z)
  slots.s = makeSlot("s", -PLAYER_SIDE_X, +PLAYER_Z, { type: "stock", player: 0 });
  // Waste 'w' to the right of Stock
  slots.w = makeSlot("w", -WASTE_X, +PLAYER_Z, { type: "waste", player: 0 });
  // Drawn card floating in front of stock/waste
  slots.drawn = makeSlot("drawn", (-PLAYER_SIDE_X + -WASTE_X) / 2, +PLAYER_Z - 6.0, {
    type: "drawn",
    player: 0,
    y: LIFT,
  });

  // Player 1 (Opponent at -z facing +z):
  // Reserve 'opp_r' on opponent's right (-x, -z)
  slots.opp_r = makeSlot("opp_r", -PLAYER_SIDE_X, -PLAYER_Z, { type: "reserve", player: 1 });
  // Stock 'opp_s' on opponent's left (+x, -z)
  slots.opp_s = makeSlot("opp_s", +PLAYER_SIDE_X, -PLAYER_Z, { type: "stock", player: 1 });
  // Waste 'opp_w' to the right of opponent stock (+x towards center)
  slots.opp_w = makeSlot("opp_w", +WASTE_X, -PLAYER_Z, { type: "waste", player: 1 });
  // Opponent drawn card
  slots.opp_drawn = makeSlot("opp_drawn", (+PLAYER_SIDE_X + +WASTE_X) / 2, -PLAYER_Z + 6.0, {
    type: "drawn",
    player: 1,
    y: LIFT,
  });

  return slots;
}

export function cardPose(slot, index = 0, { faceUp = true, yaw = 0, lift = 0 } = {}) {
  const x = slot.type === "tableau"
    ? slot.x + slot.dir * index * CASCADE_STEP_X
    : slot.x;
  const z = slot.z;
  const y = (slot.y ?? 0) + index * RISE + lift;

  // Face up for human: rotX = -PI/2, yaw = 0
  // Face down for human: rotX = +PI/2, yaw = 0
  // Opponent facing (+yaw = PI):
  const rotX = faceUp ? -Math.PI / 2 : Math.PI / 2;
  const rotY = yaw;
  const rotZ = 0;

  return {
    x,
    y,
    z,
    rotX,
    rotY,
    rotZ,
    faceUp,
    slot: slot.id,
    zone: slot.type,
    index,
  };
}

export function layout(state, aspect = 16 / 9) {
  const slots = slotPositions(aspect);
  const poses = {};

  const placeCard = (card, slot, index, { faceUp = true, yaw = 0, lift = 0 } = {}) => {
    if (!card) return;
    const pose = cardPose(slot, index, { faceUp, yaw, lift });
    poses[card.id] = pose;
  };

  // 1. Foundations
  const foundations = state.foundations ?? [];
  for (let f = 0; f < 8; f++) {
    const slot = slots[`h${f}`];
    const cards = foundations[f] ?? [];
    for (let i = 0; i < cards.length; i++) {
      placeCard(cards[i], slot, i, { faceUp: true, yaw: 0 });
    }
  }

  // 2. Tableau
  const tableau = state.tableau ?? [];
  for (let t = 0; t < 8; t++) {
    const slot = slots[`t${t}`];
    const cards = tableau[t] ?? [];
    for (let i = 0; i < cards.length; i++) {
      placeCard(cards[i], slot, i, { faceUp: true, yaw: 0 });
    }
  }

  // 3. Player 0 (Human)
  const p0 = state.players?.[0];
  if (p0) {
    // Reserve: 12 face down, top face up
    const rCards = p0.reserve ?? [];
    for (let i = 0; i < rCards.length; i++) {
      const isTop = i === rCards.length - 1;
      placeCard(rCards[i], slots.r, i, { faceUp: isTop, yaw: 0 });
    }

    // Stock: all face down
    const sCards = p0.stock ?? [];
    for (let i = 0; i < sCards.length; i++) {
      placeCard(sCards[i], slots.s, i, { faceUp: false, yaw: 0 });
    }

    // Waste: all face up
    const wCards = p0.waste ?? [];
    for (let i = 0; i < wCards.length; i++) {
      placeCard(wCards[i], slots.w, i, { faceUp: true, yaw: 0 });
    }
  }

  // 4. Player 1 (Opponent at -z facing +z, yaw = Math.PI)
  const p1 = state.players?.[1];
  if (p1) {
    // Opponent Reserve: 12 face down, top face up
    const rCards = p1.reserve ?? [];
    for (let i = 0; i < rCards.length; i++) {
      const isTop = i === rCards.length - 1;
      placeCard(rCards[i], slots.opp_r, i, { faceUp: isTop, yaw: Math.PI });
    }

    // Opponent Stock: all face down
    const sCards = p1.stock ?? [];
    for (let i = 0; i < sCards.length; i++) {
      placeCard(sCards[i], slots.opp_s, i, { faceUp: false, yaw: Math.PI });
    }

    // Opponent Waste: all face up
    const wCards = p1.waste ?? [];
    for (let i = 0; i < wCards.length; i++) {
      placeCard(wCards[i], slots.opp_w, i, { faceUp: true, yaw: Math.PI });
    }
  }

  // 5. Drawn Card
  if (state.drawnCard) {
    const active = state.activePlayer ?? 0;
    const slot = active === 0 ? slots.drawn : slots.opp_drawn;
    const yaw = active === 0 ? 0 : Math.PI;
    placeCard(state.drawnCard, slot, 0, { faceUp: true, yaw, lift: LIFT });
  }

  return { slots, poses };
}

export function hitSlot(slots, x, z) {
  for (const slot of Object.values(slots)) {
    const b = slot.bounds;
    // For tableau, also allow hit testing across the cascade area if extended
    if (x >= b.minX - 0.2 && x <= b.maxX + 0.2 && z >= b.minZ - 0.2 && z <= b.maxZ + 0.2) {
      return slot;
    }
  }
  return null;
}
