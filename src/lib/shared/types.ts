export interface CellPosition {
	q: number;
	r: number;
}

export interface HexCell extends CellPosition {
	height: number;
}

export interface Vector2 {
	x: number;
	y: number;
}

export type StringCoords = `${number},${number}`;
