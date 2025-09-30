import type { CellPosition, Vector2 } from './types';

// Convert axial coordinates to even-q offset coordinates
export const offsetToEvenQ = (hex: CellPosition): Vector2 => {
	return { x: hex.q, y: hex.r + (hex.q & 1) / 2 };
};
