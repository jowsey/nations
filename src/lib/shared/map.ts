import { Vector3 } from 'three';
import type { CellPosition, Vector2 } from './types';

// even-q coordinates to 2D space
export const evenQToXY = (hex: CellPosition): Vector2 => {
	return { x: hex.q, y: hex.r + (hex.q & 1) / 2 };
};

// even-q coordinates to Three X/Z (x right, -z forward)
export const evenQToThreePos = (hex: CellPosition, scale: number = 1): Vector3 => {
	return new Vector3(hex.q * scale, 0, (hex.r - (hex.q & 1) / 2) * scale);
};
