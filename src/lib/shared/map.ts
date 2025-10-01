import { Vector3 } from 'three';
import type { CellPosition, HexCell, Vector2 } from './types';

// even-q coordinates to 2D space
export const evenQToXY = (hex: CellPosition): Vector2 => {
	return { x: hex.q, y: hex.r + (hex.q & 1) / 2 };
};

// even-q coordinates to Three X/Z (x right, -z forward)
export const evenQToThreePos = (hex: CellPosition, scale: number = 1): Vector3 => {
	return new Vector3(hex.q * scale, 0, (hex.r - (hex.q & 1) / 2) * scale);
};

export const mapToBuffer = (map: HexCell[]) => {
	const stride = 4 + 4 + 1; // bytes per cell
	const buffer = new ArrayBuffer(4 + 4 + map.length * stride);
	const view = new DataView(buffer);

	const dimensions: Vector2 = { x: 0, y: 0 };

	map.forEach((cell, i) => {
		if (cell.q > dimensions.x) dimensions.x = cell.q;
		if (cell.r > dimensions.y) dimensions.y = cell.r;

		view.setUint32(8 + i * stride + 0, cell.q, true);
		view.setUint32(8 + i * stride + 4, cell.r, true);
		view.setUint8(8 + i * stride + 8, cell.height);
	});

	view.setUint32(0, dimensions.x, true);
	view.setUint32(4, dimensions.y, true);
	return buffer;
};

export const deserializeMapBuffer = (buffer: ArrayBuffer): [HexCell[], Vector2] => {
	const view = new DataView(buffer);
	const stride = 4 + 4 + 1; // bytes per cell

	const dimensions: Vector2 = { x: view.getUint32(0, true), y: view.getUint32(4, true) };
	const cells: HexCell[] = [];

	for (let offset = 8; offset < buffer.byteLength; offset += stride) {
		const q = view.getUint32(offset + 0, true);
		const r = view.getUint32(offset + 4, true);
		const height = view.getUint8(offset + 8);
		cells.push({ q, r, height });
	}

	return [cells, dimensions];
};
