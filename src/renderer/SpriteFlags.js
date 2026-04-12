// Shared flag written by GameApp after Assets.load() completes (or fails).
// CarRenderer and ShooterRenderer read this once the renderers are created —
// by that point the flag is already set for the lifetime of the session.
export const spriteFlags = { loaded: false };
