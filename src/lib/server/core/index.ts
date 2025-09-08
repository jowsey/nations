import alea from 'alea';
import { createNoise2D } from 'simplex-noise';
import { db } from '../db';
import { mapCells } from '../db/schema';

interface CellPosition {
	q: number;
	r: number;
}

interface HexCell extends CellPosition {
	height: number;
}

interface Vector2 {
	x: number;
	y: number;
}

// Generate fractal noise
const fractal = (
	noiseFn: (x: number, y: number) => number,
	position: Vector2,
	octaves: number = 5
) => {
	let total = 0;
	let frequency = 1;
	let amplitude = 1;
	let maxValue = 0;

	for (let i = 0; i < octaves; i++) {
		total += noiseFn(position.x * frequency, position.y * frequency) * amplitude;
		maxValue += amplitude;
		amplitude *= 0.5;
		frequency *= 2;
	}
	return total / maxValue;
};

// Convert axial coordinates to odd-r offset coordinates
const hexToXY = (hex: CellPosition): Vector2 => {
	return { x: hex.q + (hex.r - (hex.r % 2)) * 0.5, y: hex.r };
};

class WorldMap {
	private cells: Map<string, HexCell> = new Map();
	private dimensions: Vector2;
	private seed: string;

	constructor(dimensions: Vector2, seed?: string) {
		this.dimensions = dimensions;

		this.seed = seed || Math.random().toString();
		this.regenerate(this.seed);
	}

	// Generate a new map
	private regenerate(seed: string) {
		const prng = alea(seed);
		const noise = createNoise2D(prng);
		this.cells.clear();

		for (let q = 0; q <= this.dimensions.x; q++) {
			for (let r = 0; r <= this.dimensions.y; r++) {
				const axialPos = { q, r };
				const offsetPos = hexToXY(axialPos);
				const height = fractal(noise, { x: offsetPos.x / 50, y: offsetPos.y / 50 }, 5);

				this.cells.set(`${q},${r}`, { q, r, height });
			}
		}
	}

	public async pushToDb() {
		console.log('Pushing map to db...');

		await db.transaction(async (tx) => {
			await tx.delete(mapCells);
			await tx.insert(mapCells).values(Array.from(this.cells.values()));
		});

		console.log('^ Done.');
	}

	public getCell(position: CellPosition): HexCell | undefined {
		return this.cells.get(`${position.q},${position.r}`);
	}
}

const map = new WorldMap({ x: 200, y: 100 }, 'gaming');
await map.pushToDb();
