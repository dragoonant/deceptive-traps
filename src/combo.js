// Per-intruder combo tracking. Pure logic, no rendering, so it can be unit-tested.
import { COMBO } from './config.js';

export class ComboTracker {
  constructor(config = COMBO) {
    this.config = config;
    this.chain = []; // names of hits in the current chain
    this.timer = 0; // time left before the chain expires
    this.bestChain = 0;
  }

  get count() {
    return this.chain.length;
  }

  get active() {
    return this.timer > 0 && this.chain.length > 0;
  }

  // Damage multiplier the NEXT hit would receive.
  nextMultiplier() {
    const n = this.active ? this.chain.length : 0;
    return Math.min(1 + n * this.config.stepMultiplier, this.config.maxMultiplier);
  }

  // Register a hit. Returns the damage multiplier applied to this hit.
  hit(sourceName) {
    const mult = this.nextMultiplier();
    if (!this.active) this.chain = [];
    this.chain.push(sourceName);
    this.timer = this.config.window;
    this.bestChain = Math.max(this.bestChain, this.chain.length);
    return mult;
  }

  update(dt) {
    if (this.timer > 0) {
      this.timer -= dt;
      if (this.timer <= 0) {
        this.timer = 0;
        return this.finish();
      }
    }
    return null;
  }

  // Close the chain and return its scoring summary (or null if nothing to score).
  finish() {
    if (this.chain.length === 0) return null;
    const summary = scoreChain(this.chain, this.config);
    this.chain = [];
    this.timer = 0;
    return summary;
  }
}

export function scoreChain(chain, config = COMBO) {
  const distinct = new Set(chain).size;
  const hits = chain.length;
  // Triangular growth rewards long chains: 1, 3, 6, 10 ... x 10 points.
  const chainScore = ((hits * (hits + 1)) / 2) * 10;
  const variety = Math.max(0, distinct - 1) * config.varietyBonus;
  return { hits, distinct, chain: [...chain], score: chainScore + variety };
}
