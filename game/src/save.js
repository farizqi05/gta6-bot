// Cahaya Bay — save / load. One job: persist progress in localStorage and
// restore it (mission, cash, position). Nothing else touches storage.
const KEY = 'cahaya-bay.save.v1';

export function saveGame(state) {
  try {
    localStorage.setItem(KEY, JSON.stringify({
      missionIndex: state.missionIndex,
      cash: state.cash,
      health: state.health,
      completed: state.completed,
      pos: [state.player.pos.x, state.player.pos.z],
      savedAt: Date.now(),
    }));
    return true;
  } catch (e) { return false; }
}

export function loadGame() {
  try {
    const raw = localStorage.getItem(KEY);
    return raw ? JSON.parse(raw) : null;
  } catch (e) { return null; }
}

export function hasSave() { return !!loadGame(); }
