'use strict';
// Slot-based inventory with stacking. Slots hold { id, qty } or null.

class Inventory {
  constructor(size = 24) {
    this.size = size;
    this.slots = new Array(size).fill(null);
  }

  // Adds items; returns the quantity that did not fit.
  add(id, qty = 1) {
    const it = G.item(id);
    for (const s of this.slots) {
      if (qty <= 0) break;
      if (s && s.id === id && s.qty < it.stack) {
        const n = Math.min(qty, it.stack - s.qty);
        s.qty += n;
        qty -= n;
      }
    }
    for (let i = 0; i < this.size && qty > 0; i++) {
      if (!this.slots[i]) {
        const n = Math.min(qty, it.stack);
        this.slots[i] = { id, qty: n };
        qty -= n;
      }
    }
    return qty;
  }

  canFit(id, qty = 1) {
    const it = G.item(id);
    let room = 0;
    for (const s of this.slots) {
      if (!s) room += it.stack;
      else if (s.id === id) room += it.stack - s.qty;
      if (room >= qty) return true;
    }
    return false;
  }

  count(id) {
    let n = 0;
    for (const s of this.slots) if (s && s.id === id) n += s.qty;
    return n;
  }

  has(id, qty = 1) { return this.count(id) >= qty; }

  remove(id, qty = 1) {
    if (!this.has(id, qty)) return false;
    for (let i = this.size - 1; i >= 0 && qty > 0; i--) {
      const s = this.slots[i];
      if (s && s.id === id) {
        const n = Math.min(qty, s.qty);
        s.qty -= n;
        qty -= n;
        if (s.qty <= 0) this.slots[i] = null;
      }
    }
    return true;
  }

  removeAt(i, qty = 1) {
    const s = this.slots[i];
    if (!s) return null;
    const n = Math.min(qty, s.qty);
    s.qty -= n;
    if (s.qty <= 0) this.slots[i] = null;
    return { id: s.id, qty: n };
  }

  // Moves slot a onto slot b: the same item stacks onto it (what does not fit stays), anything else swaps places.
  move(a, b) {
    const s = this.slots[a], t = this.slots[b];
    if (!s || a === b || b < 0 || b >= this.size) return false;
    if (t && t.id === s.id) {
      const n = Math.min(s.qty, G.item(s.id).stack - t.qty);
      if (n > 0) { t.qty += n; s.qty -= n; if (s.qty <= 0) this.slots[a] = null; return true; }
    }
    this.slots[a] = t; this.slots[b] = s;
    return true;
  }

  items() { return this.slots.filter(Boolean); }

  get used() { return this.slots.filter(Boolean).length; }

  sort() {
    const order = ['weapon', 'ammo', 'armor', 'trinket', 'clothing', 'consumable', 'tool', 'material', 'misc', 'quest'];
    const list = this.items();
    this.slots.fill(null);
    list.sort((a, b) => order.indexOf(G.item(a.id).type) - order.indexOf(G.item(b.id).type) || G.item(a.id).name.localeCompare(G.item(b.id).name));
    for (const s of list) this.add(s.id, s.qty);
  }

  toJSON() { return { size: this.size, slots: this.slots }; }

  static from(data) {
    const inv = new Inventory(data.size);
    inv.slots = data.slots.map((s) => (s ? { id: s.id, qty: s.qty } : null));
    return inv;
  }
}

G.Inventory = Inventory;
