// The cost of each move as a share of a full energy store (1 = fresh). A vault keeps the speed and spends less than a jump,
// which pays for its height with speed lost on landing and a harder push-off. Tracked for every run; it slows the runner only on courses that ask for it (`course.tiring`).
export const JUMP_COST = 0.06;
export const VAULT_COST = 0.025;
