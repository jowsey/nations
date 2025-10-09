import alea from "alea";
import { createNoise2D } from "simplex-noise";
import { db } from "../db";
import { mapCells, mapMetadata } from "../db/schema";

export interface CellPosition {
  // Column
  q: number;
  // Row
  r: number;
}

export interface HexCell extends CellPosition {
  /**
   * 2-byte bitfield
   * ```
   * biome: 0 grass, 1 forest, 2 water, 3 beach, 4 mountain
   * |    cosmetic: 0 none, grass: 1 tall grass
   * |    |                 water:
   * |    |    reserved
   * |    |    |    reserved
   * |    |    |    |
   * 0000 0000 0000 0000
   * ```
   */
  details: number;
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

// Generate fractal noise between 0-1
const fractal = (
  noiseFn: (x: number, y: number) => number,
  position: Vector2,
  frequency: number = 1,
  octaves: number = 5,
) => {
  let total = 0;
  let amplitude = 1;
  let maxValue = 0;

  for (let i = 0; i < octaves; i++) {
    total += noiseFn(position.x * frequency, position.y * frequency) * amplitude;
    maxValue += amplitude;
    amplitude *= 0.5;
    frequency *= 2;
  }

  return (total / maxValue) * 0.5 + 0.5; // normalize to 0-1
};

export class WorldMap {
  private cells: HexCell[] = [];
  private dimensions: Vector2 = { x: 0, y: 0 };
  private seed: string = "";

  // Generate a new map
  public async regenerate(dimensions: Vector2, seed: string) {
    this.dimensions = dimensions;
    this.seed = seed;

    const prng = alea(seed);
    const noise = createNoise2D(prng);
    this.cells = new Array(dimensions.x * dimensions.y);

    const frequency = 1 / 150;

    // todo create reusable biome layer type with freq/threshold/etc
    const forestFreq = 1 / 80;
    const forestThreshold = 0.75;

    const seaLevel = 0.37;
    const beachHeight = 0.035;
    const mountainHeight = 0.8;

    const longGrassChance = 0.15;

    for (let q = 0; q < dimensions.x; q++) {
      for (let r = 0; r < dimensions.y; r++) {
        const axialPos = { q, r };
        const offsetPos = evenQToXY(axialPos);
        const height = fractal(noise, { x: offsetPos.x, y: offsetPos.y }, frequency);

        let details: number = 0b0000_0000_0000_0000;
        if (height <= seaLevel) {
          details |= 2 << 12; // water
        } else if (height <= seaLevel + beachHeight) {
          details |= 3 << 12; // beach
        } else if (height >= mountainHeight) {
          details |= 4 << 12; // mountain
        } else {
          const forestHeight = fractal(
            noise,
            { x: offsetPos.x + 4000, y: offsetPos.y + 4000 },
            forestFreq,
          );

          if (forestHeight >= forestThreshold) {
            details |= 1 << 12; // forest
          } else {
            details |= 0 << 12; // grass

            if (Math.random() < longGrassChance) {
              details |= 1 << 8; // tall grass cosmetic
            }
          }
        }

        this.cells[qrToIndex(axialPos, dimensions.x)] = { q, r, details };
      }
    }
  }

  public async pushToDb() {
    console.write("Pushing map to db... ");

    await db.transaction(async (tx) => {
      await tx.delete(mapMetadata);
      await tx.insert(mapMetadata).values({
        width: this.dimensions.x,
        height: this.dimensions.y,
        seed: this.seed,
      });

      await tx.delete(mapCells);

      const cells = [...this.cells];

      // auto-batch inserts
      // todo, use copy from stdin instead
      const maxParams = 32767; // postgres limit
      const paramsPerRow = Object.keys(cells[0]!).length;
      const cellsPerBatch = Math.floor(maxParams / paramsPerRow);

      for (let i = 0; i < cells.length; i += cellsPerBatch) {
        const batch = cells.slice(i, i + cellsPerBatch);
        await tx.insert(mapCells).values(batch);
      }
    });

    console.log("Done.");
  }

  public async pullFromDb() {
    console.write("Pulling map from db... ");

    const metadata = await db.select().from(mapMetadata).limit(1);
    if (!metadata[0]) throw new Error("No map metadata found in db!");

    this.dimensions = { x: metadata[0].width, y: metadata[0].height };
    this.seed = metadata[0].seed;

    this.cells = await db
      .select({ q: mapCells.q, r: mapCells.r, details: mapCells.details })
      .from(mapCells)
      .limit(this.dimensions.x * this.dimensions.y);

    // sort into q/r order (if all is well, nothing should change)
    this.cells.sort((a, b) => {
      if (a.r === b.r) {
        return a.q - b.q;
      }
      return a.r - b.r;
    });

    console.log("Done.");
  }

  public getCell(position: CellPosition): HexCell | undefined {
    return this.cells[qrToIndex(position, this.dimensions.x)];
  }

  public getCells(): [HexCell[], Vector2] {
    return [this.cells, this.dimensions];
  }
}
