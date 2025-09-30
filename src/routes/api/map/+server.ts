import { db } from '$lib/server/db';
import { mapCells } from '$lib/server/db/schema';
import type { Vector2 } from '$lib/shared/types';
import type { RequestHandler } from './$types';

export const GET: RequestHandler = async ({ locals }) => {
	if (!locals.session) {
		return new Response('Unauthorized', { status: 401 });
	}

	const map = await db.select().from(mapCells);
	console.log(`Loaded ${map.length} cells from db.`);

	// dimensions x, y as float32
	// q, r, height as float32
	const binaryMap = new ArrayBuffer(4 + 4 + map.length * (4 + 4 + 4));
	const view = new DataView(binaryMap);
	const dimensions: Vector2 = { x: 0, y: 0 };

	map.forEach((cell, i) => {
		if (cell.q > dimensions.x) dimensions.x = cell.q;
		if (cell.r > dimensions.y) dimensions.y = cell.r;

		view.setFloat32(8 + i * 12 + 0, cell.q);
		view.setFloat32(8 + i * 12 + 4, cell.r);
		view.setFloat32(8 + i * 12 + 8, cell.height);
	});

	view.setFloat32(0, dimensions.x);
	view.setFloat32(4, dimensions.y);

	return new Response(binaryMap, { headers: { 'Content-Type': 'application/octet-stream' } });
};
