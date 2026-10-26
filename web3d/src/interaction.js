// Mouse and touch interaction controller for Crapette 3D table

export class InteractionController {
  constructor({
    table,
    canvas,
    getGameState,
    onMove,
    onDraw,
    onWaste,
  } = {}) {
    this.table = table;
    this.canvas = canvas;
    this.getGameState = getGameState;
    this.onMove = onMove;
    this.onDraw = onDraw;
    this.onWaste = onWaste;

    this.selectedSource = null;
    this.legalDestinations = [];
    this.draggedSource = null;
    this.dragPointer = null;

    if (this.canvas) {
      this._attachDOMEvents();
    }
  }

  _attachDOMEvents() {
    let lastClickTime = 0;
    let lastClickTarget = null;
    let isDragging = false;
    let startX = 0;
    let startY = 0;

    const getNormalizedCoords = (e) => {
      if (!this.canvas) return { x: 0, y: 0 };
      const rect = this.canvas.getBoundingClientRect();
      const clientX = e.touches ? e.touches[0].clientX : e.clientX;
      const clientY = e.touches ? e.touches[0].clientY : e.clientY;
      return {
        x: ((clientX - rect.left) / rect.width) * 2 - 1,
        y: -((clientY - rect.top) / rect.height) * 2 + 1,
      };
    };

    const onPointerDown = (e) => {
      const coords = getNormalizedCoords(e);
      startX = e.clientX ?? (e.touches ? e.touches[0].clientX : 0);
      startY = e.clientY ?? (e.touches ? e.touches[0].clientY : 0);

      if (this.table && typeof this.table.raycast === "function") {
        const hit = this.table.raycast(coords);
        if (hit && hit.card && this._isMovable(hit.card.sourceSlot)) {
          this.handleDragStart(hit.card);
          isDragging = true;
        }
      }
    };

    const onPointerMove = (e) => {
      if (!isDragging || !this.draggedSource) return;
      const coords = getNormalizedCoords(e);
      this.handleDragMove(coords);
    };

    const onPointerUp = (e) => {
      const endX = e.clientX ?? (e.changedTouches ? e.changedTouches[0].clientX : 0);
      const endY = e.clientY ?? (e.changedTouches ? e.changedTouches[0].clientY : 0);
      const dist = Math.hypot(endX - startX, endY - startY);

      const coords = getNormalizedCoords(e);
      let hit = null;
      if (this.table && typeof this.table.raycast === "function") {
        hit = this.table.raycast(coords);
      }

      if (isDragging && dist > 15) {
        // Drag-and-drop release
        const targetSlot = hit ? (hit.slot || (hit.card ? hit.card.sourceSlot : null)) : null;
        this.handleDragEnd(targetSlot);
      } else {
        // It was a click / tap
        if (isDragging) {
          this.handleDragEnd(null);
        }

        const now = Date.now();
        const isDouble = (now - lastClickTime < 350) && (lastClickTarget && hit && hit.card && lastClickTarget === hit.card.sourceSlot);
        lastClickTime = now;
        lastClickTarget = hit && hit.card ? hit.card.sourceSlot : null;

        if (hit) {
          if (isDouble && hit.card) {
            this.handleCardDoubleClick(hit.card);
          } else if (hit.card) {
            this.handleCardClick(hit.card);
          } else if (hit.slot) {
            this.handleSlotClick(hit.slot);
          }
        } else {
          this.clearSelection();
        }
      }

      isDragging = false;
    };

    this.canvas.addEventListener("pointerdown", onPointerDown);
    this.canvas.addEventListener("pointermove", onPointerMove);
    this.canvas.addEventListener("pointerup", onPointerUp);
    this.canvas.addEventListener("pointercancel", () => {
      isDragging = false;
      this.handleDragEnd(null);
    });
  }

  _isMovable(sourceSlot) {
    if (!sourceSlot) return false;
    const state = typeof this.getGameState === "function" ? this.getGameState() : null;
    if (!state || state.activePlayer !== 0) return false;

    // Available cards for Player 0:
    // 1. Drawn card (if any)
    if (state.drawnCard) {
      return sourceSlot === "drawn";
    }
    // 2. Reserve top ('r')
    if (sourceSlot === "r") return true;
    // 3. Tableau columns ('t0'..'t7')
    if (sourceSlot.startsWith("t")) return true;

    return false;
  }

  _getLegalDestinationsFor(sourceSlot) {
    const state = typeof this.getGameState === "function" ? this.getGameState() : null;
    if (!state || !state.legal) return [];

    const prefix = `m ${sourceSlot}>`;
    const destinations = [];

    for (const move of state.legal) {
      if (move.startsWith(prefix)) {
        const dst = move.slice(prefix.length).trim();
        destinations.push(dst);
      }
    }

    return Array.from(new Set(destinations));
  }

  handleCardClick(card) {
    if (!card) return;
    const sourceSlot = card.sourceSlot;
    const state = typeof this.getGameState === "function" ? this.getGameState() : null;

    // Direct draw action on stock click
    if (sourceSlot === "s" || sourceSlot === "s0") {
      this.clearSelection();
      this.onDraw?.();
      return;
    }

    // Direct waste action on waste pile click when a drawn card is held
    if (state?.drawnCard && (sourceSlot === "w" || sourceSlot === "w0")) {
      this.clearSelection();
      this.onWaste?.();
      return;
    }

    // If currently selected source is clicked again, deselect
    if (this.selectedSource === sourceSlot) {
      this.clearSelection();
      return;
    }

    // If a source is already selected and we click another card that sits on a legal destination slot
    if (this.selectedSource && sourceSlot) {
      if (this._tryMoveToSlot(sourceSlot)) {
        return;
      }
    }

    // If this card is movable by active player, select it and highlight legal target slots
    if (this._isMovable(sourceSlot)) {
      this.selectedSource = sourceSlot;
      this.legalDestinations = this._getLegalDestinationsFor(sourceSlot);

      if (this.table && typeof this.table.highlightSlots === "function") {
        this.table.highlightSlots(this.legalDestinations);
      }
    } else {
      this.clearSelection();
    }
  }

  handleSlotClick(slotKey) {
    const state = typeof this.getGameState === "function" ? this.getGameState() : null;

    // Direct draw action on empty stock slot click
    if (slotKey === "s" || slotKey === "s0") {
      this.clearSelection();
      this.onDraw?.();
      return;
    }

    // Direct waste action on waste slot click when a drawn card is held
    if (state?.drawnCard && (slotKey === "w" || slotKey === "w0")) {
      this.clearSelection();
      this.onWaste?.();
      return;
    }

    if (!this.selectedSource) return;
    this._tryMoveToSlot(slotKey);
  }

  _tryMoveToSlot(slotKey) {
    if (!this.selectedSource || !slotKey) return false;

    // Check if slotKey directly matches or matches via foundation alias
    let validDst = null;
    if (this.legalDestinations.includes(slotKey)) {
      validDst = slotKey;
    } else if (slotKey.startsWith("h") && this.legalDestinations.includes("h")) {
      validDst = slotKey;
    }

    if (validDst && this.onMove) {
      const src = this.selectedSource;
      this.clearSelection();
      this.onMove(src, validDst);
      return true;
    }

    return false;
  }

  handleCardDoubleClick(card) {
    if (!card) return;
    const sourceSlot = card.sourceSlot;
    if (!this._isMovable(sourceSlot)) return;

    // Check if legal foundation move exists for this card
    const destinations = this._getLegalDestinationsFor(sourceSlot);
    const foundationDst = destinations.find((d) => d === "h" || d.startsWith("h"));

    if (foundationDst && this.onMove) {
      this.clearSelection();
      this.onMove(sourceSlot, foundationDst);
    }
  }

  handleDragStart(card) {
    if (!card || !this._isMovable(card.sourceSlot)) return;
    this.draggedSource = card.sourceSlot;
    this.legalDestinations = this._getLegalDestinationsFor(card.sourceSlot);

    if (this.table && typeof this.table.highlightSlots === "function") {
      this.table.highlightSlots(this.legalDestinations);
    }
  }

  handleDragMove(pointer) {
    this.dragPointer = pointer;
  }

  handleDragEnd(targetSlot) {
    if (!this.draggedSource) return;

    const src = this.draggedSource;
    this.draggedSource = null;
    this.dragPointer = null;

    if (src === "drawn" && (targetSlot === "w" || targetSlot === "w0")) {
      this.clearSelection();
      this.onWaste?.();
      return;
    }

    if (targetSlot) {
      let validDst = null;
      if (this.legalDestinations.includes(targetSlot)) {
        validDst = targetSlot;
      } else if (targetSlot.startsWith("h") && this.legalDestinations.includes("h")) {
        validDst = targetSlot;
      }

      if (validDst && this.onMove) {
        this.clearSelection();
        this.onMove(src, validDst);
        return;
      }
    }

    this.clearSelection();
  }

  clearSelection() {
    this.selectedSource = null;
    this.legalDestinations = [];
    this.draggedSource = null;
    if (this.table && typeof this.table.clearHighlights === "function") {
      this.table.clearHighlights();
    }
  }
}
