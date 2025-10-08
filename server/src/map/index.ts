import alea from "alea";
import { createNoise2D } from "simplex-noise";
import { db } from "../db";
import { mapCells } from "../db/schema";

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

// even-q coordinates to 2D space
export const evenQToXY = (cell: CellPosition): Vector2 => {
  return { x: cell.q, y: cell.r + (cell.q & 1) / 2 };
};

export const qrToIndex = (cell: CellPosition, mapWidth: number): number => {
  return cell.r * mapWidth + cell.q;
};

export const indexToQR = (index: number, mapWidth: number): CellPosition => {
  const q = index % mapWidth;
  const r = Math.floor(index / mapWidth);
  return { q, r };
};

// Generate fractal noise
const fractal = (
  noiseFn: (x: number, y: number) => number,
  position: Vector2,
  octaves: number = 5,
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

export class WorldMap {
  private cells: HexCell[] = [];
  private dimensions: Vector2 = { x: 0, y: 0 };
  private seed: string = "";

  // Generate a new map
  public regenerate(dimensions: Vector2, seed: string) {
    this.dimensions = dimensions;
    this.seed = seed;

    const prng = alea(seed);
    const noise = createNoise2D(prng);
    this.cells = new Array(dimensions.x * dimensions.y);

    let lowestHeight = Infinity;
    let highestHeight = -Infinity;

    for (let q = 0; q < dimensions.x; q++) {
      for (let r = 0; r < dimensions.y; r++) {
        const axialPos = { q, r };
        const offsetPos = evenQToXY(axialPos);
        const height = fractal(noise, { x: offsetPos.x / 50, y: offsetPos.y / 50 }, 5) * 0.5 + 0.5;

        this.cells[qrToIndex(axialPos, dimensions.x)] = { q, r, height };

        if (height < lowestHeight) lowestHeight = height;
        if (height > highestHeight) highestHeight = height;
      }
    }

    // normalize to 0-1 & quantize to step
    const quantizeStep = 0.025; // 0-40
    const quantizeMult = 1 / quantizeStep;

    const heightRange = highestHeight - lowestHeight;

    this.cells.forEach((cell) => {
      const scaledHeight = (cell.height - lowestHeight) / heightRange;
      const quantizedIntHeight = Math.round(scaledHeight * quantizeMult);
      cell.height = quantizedIntHeight;
    });
  }

  public async pushToDb() {
    console.write("Pushing map to db... ");

    await db.transaction(async (tx) => {
      await tx.delete(mapCells);

      const batchSize = 1_000;

      for (let i = 0; i < this.cells.length; i += batchSize) {
        const batch = this.cells.slice(i, i + batchSize);
        await tx.insert(mapCells).values(batch);
      }
    });

    console.log("Done.");
  }

  public async pullFromDb() {
    console.write("Pulling map from db... ");

    const cells = await db
      .select({ q: mapCells.q, r: mapCells.r, height: mapCells.height })
      .from(mapCells);

    this.cells = new Array(cells.length);

    if (cells.length === 0) {
      this.dimensions = { x: 0, y: 0 };
      console.log("Done (no cells).");
      return;
    }

    // sort into q/r order
    cells.sort((a, b) => {
      if (a.r === b.r) {
        return a.q - b.q;
      }
      return a.r - b.r;
    });

    const lastCell = cells[cells.length - 1]!;
    this.dimensions = { x: lastCell.q + 1, y: lastCell.r + 1 };

    this.cells = cells;
    console.log("Done.");
  }

  public getCell(position: CellPosition): HexCell | undefined {
    return this.cells[qrToIndex(position, this.dimensions.x)];
  }

  public getCells(): [HexCell[], Vector2] {
    return [this.cells, this.dimensions];
  }
}
