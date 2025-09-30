import alea from 'alea';
import { createNoise2D } from 'simplex-noise';
import { db } from '../db';
import { mapCells } from '../db/schema';
import type { CellPosition, HexCell, StringCoords, Vector2 } from '$lib/shared/types';
import { offsetToEvenQ } from '$lib/shared/map';

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

class WorldMap {
	private cells: Map<StringCoords, HexCell> = new Map();
	private dimensions: Vector2 = { x: 0, y: 0 };
	private seed: string = '';

	// Generate a new map
	public regenerate(dimensions: Vector2, seed: string) {
		this.dimensions = dimensions;
		this.seed = seed;

		const prng = alea(seed);
		const noise = createNoise2D(prng);
		this.cells.clear();

		let lowestHeight = Infinity;
		let highestHeight = -Infinity;

		for (let q = 0; q <= dimensions.x; q++) {
			for (let r = 0; r <= dimensions.y; r++) {
				const axialPos = { q, r };
				const offsetPos = offsetToEvenQ(axialPos);
				const height = fractal(noise, { x: offsetPos.x / 50, y: offsetPos.y / 50 }, 5) * 0.5 + 0.5;

				this.cells.set(`${q},${r}`, { q, r, height });

				if (height < lowestHeight) lowestHeight = height;
				if (height > highestHeight) highestHeight = height;
			}
		}

		// normalize
		const heightRange = highestHeight - lowestHeight;
		this.cells.forEach((cell) => {
			cell.height = (cell.height - lowestHeight) / heightRange;
		});
	}

	public async pushToDb() {
		console.log('Pushing map to db...');

		await db.transaction(async (tx) => {
			await tx.delete(mapCells);
			const values = Array.from(this.cells.values());
			values.forEach(async (cell) => {
				await tx.insert(mapCells).values(cell);
			});
		});

		console.log('^ Done.');
	}

	public async pullFromDb() {
		console.log('Pulling map from db...');

		const rows = await db.select().from(mapCells);
		this.cells.clear();
		for (const row of rows) {
			this.cells.set(`${row.q},${row.r}`, row);
		}

		console.log('^ Done.');
	}

	public getCell(position: CellPosition): HexCell | undefined {
		return this.cells.get(`${position.q},${position.r}`);
	}
}

const map = new WorldMap();
// await map.pullFromDb();
await map.regenerate({ x: 200, y: 120 }, 'gaming5');
await map.pushToDb();
