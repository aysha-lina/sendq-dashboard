// Plugin hook system (parity with the PHP HookManager): WordPress-style actions
// (fire-and-collect) + filters (chain a value). Callbacks run in priority order
// (lower first); a throwing callback is isolated so it can't break the chain.

class HookManager {
  constructor() {
    this.actions = new Map();
    this.filters = new Map();
  }

  _add(map, name, cb, priority) {
    if (typeof cb !== 'function') return;
    const list = map.get(name) || [];
    list.push({ cb, priority });
    list.sort((a, b) => a.priority - b.priority);
    map.set(name, list);
  }

  addAction(name, cb, priority = 10) { this._add(this.actions, name, cb, priority); }

  addFilter(name, cb, priority = 10) { this._add(this.filters, name, cb, priority); }

  // Run every callback registered for `name`. Returns the array of results.
  async doAction(name, ...args) {
    const results = [];
    for (const { cb } of this.actions.get(name) || []) {
      try {
         
        results.push(await cb(...args));
      } catch (err) {
        console.error(`[hook] action "${name}" failed:`, err.message);
      }
    }
    return results;
  }

  // Chain `value` through every filter registered for `name`; each returns the next value.
  async applyFilters(name, value, ...args) {
    let acc = value;
    for (const { cb } of this.filters.get(name) || []) {
      try {
         
        const next = await cb(acc, ...args);
        if (next !== undefined) acc = next;
      } catch (err) {
        console.error(`[hook] filter "${name}" failed:`, err.message);
      }
    }
    return acc;
  }

  hasAction(name) { return (this.actions.get(name) || []).length > 0; }
  hasFilter(name) { return (this.filters.get(name) || []).length > 0; }
  countAction(name) { return (this.actions.get(name) || []).length; }
  removeAll() { this.actions.clear(); this.filters.clear(); }
}

// App-wide singleton shared by the loader, the core hook points, and every plugin.
const hooks = new HookManager();

module.exports = { HookManager, hooks };
