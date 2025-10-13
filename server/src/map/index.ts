import alea from "alea";
import { createNoise4D } from "simplex-noise";
import { db } from "../db";
import { mapCells, mapMetadata } from "../db/schema";
import { from as copyFrom } from "pg-copy-streams";
import { Readable, pipeline } from "node:stream";
// import { pipeline } from "node:stream/promises"; // todo

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

// Convert offset coordinates to pointy-top/odd-q world-space
export const offsetToWorldSpace = (cell: CellPosition): Vector2 => {
  // return { x: cell.q, y: cell.r + (cell.q & 1) / 2 };
  return { x: cell.q + (cell.r & 1) / 2, y: cell.r };
};

export const qrToIndex = (cell: CellPosition, mapWidth: number): number => {
  return cell.r * mapWidth + cell.q;
};

export const indexToQR = (index: number, mapWidth: number): CellPosition => {
  const q = index % mapWidth;
  const r = Math.floor(index / mapWidth);
  return { q, r };
};

// Generate tiled noise
const genTiledNoise = (
  noiseFn: (x: number, y: number, z: number, w: number) => number,
  position: Vector2,
  dimensions: Vector2,
  frequency: number = 1,
  octaves: number = 5,
) => {
  const persistence = 0.6;
  const lacunarity = 2.0;

  let total = 0;
  let amplitude = 1;
  let maxValue = 0;

  const radiusX = dimensions.x / (2 * Math.PI);
  const radiusY = dimensions.y / (2 * Math.PI);

  const angleX = 2 * Math.PI * (position.x / dimensions.x);
  const angleY = 2 * Math.PI * (position.y / dimensions.y);

  for (let i = 0; i < octaves; i++) {
    const octaveRadiusX = radiusX * frequency;
    const octaveRadiusY = radiusY * frequency;

    total +=
      noiseFn(
        octaveRadiusX * Math.cos(angleX),
        octaveRadiusX * Math.sin(angleX),
        octaveRadiusY * Math.cos(angleY),
        octaveRadiusY * Math.sin(angleY),
      ) * amplitude;

    maxValue += amplitude;
    amplitude *= persistence;
    frequency *= lacunarity;
  }

  return (total / maxValue) * 0.5 + 0.5; // normalize to 0-1
};

export class WorldMap {
  private cells: HexCell[] = [];
  private dimensions: Vector2 = { x: 0, y: 0 };
  private seed: string = "";

  // Generate a new map
  public async regenerate(dimensions: Vector2, seed: string) {
    console.write("Generating new map... ");
    this.dimensions = dimensions;
    this.seed = seed;

    const prng = alea(seed);
    const noise4d = createNoise4D(prng);
    this.cells = new Array(dimensions.x * dimensions.y);

    const octaves = 12;
    const frequency = 1 / 600;

    // todo create reusable biome layer type with freq/threshold/etc
    const forestFreq = 1 / 100;
    const forestThreshold = 0.65;

    const seaLevel = 0.44;
    const beachHeight = 0.01;
    const mountainHeight = 0.84;

    const longGrassChance = 0.15;

    const heights = new Array(dimensions.x * dimensions.y);

    // pre-generate everything so we can normalise it
    let lowest = Infinity;
    let highest = -Infinity;

    for (let r = 0; r < dimensions.y; r++) {
      for (let q = 0; q < dimensions.x; q++) {
        const coords = { q, r };
        const worldPos = offsetToWorldSpace(coords);
        const height = genTiledNoise(noise4d, worldPos, dimensions, frequency, octaves);
        heights[qrToIndex(coords, dimensions.x)] = height;

        if (height < lowest) lowest = height;
        if (height > highest) highest = height;
      }
    }

    // normalise heights
    const heightRange = highest - lowest;
    for (let i = 0; i < heights.length; i++) {
      heights[i] = (heights[i] - lowest) / heightRange;
    }

    for (let i = 0; i < heights.length; i++) {
      const coords = indexToQR(i, dimensions.x);
      const worldPos = offsetToWorldSpace(coords);
      const height = heights[i];

      let details: number = 0b0000_0000_0000_0000;
      if (height <= seaLevel) {
        details |= 2 << 12; // water
      } else if (height <= seaLevel + beachHeight) {
        details |= 3 << 12; // beach
      } else if (height >= mountainHeight) {
        details |= 4 << 12; // mountain
      } else {
        const forestHeight = genTiledNoise(
          noise4d,
          { x: worldPos.x + 4000, y: worldPos.y + 4000 },
          dimensions,
          forestFreq,
        );

        if (forestHeight >= forestThreshold) {
          details |= 1 << 12; // forest
        } else {
          details |= 0 << 12; // grass

          if (prng() < longGrassChance) {
            details |= 1 << 8; // tall grass cosmetic
          }
        }
      }

      this.cells[qrToIndex(coords, dimensions.x)] = { ...coords, details };
    }

    console.log("Done.");
  }

  public async pushToDb() {
    console.write("Pushing map to db... ");

    await db.delete(mapMetadata);
    await db.insert(mapMetadata).values({
      width: this.dimensions.x,
      height: this.dimensions.y,
      seed: this.seed,
    });

    await db.delete(mapCells);

    const cells = [...this.cells];

    const ingestStream = db.$client.query(copyFrom("COPY map_cell FROM STDIN"));
    // todo is this best way of doing this?
    const sourceStream = new Readable({
      read() {
        for (const c of cells) {
          this.push(`${c.q}\t${c.r}\t${c.details}\n`);
        }
        this.push(null);
      },
    });
    // async pipeline throws a TypeError(?), todo investigate
    pipeline(sourceStream, ingestStream, () => {});

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
