import type { RequestHandler } from './$types';
import { db } from '$lib/server/db';
import { mapCells } from '$lib/server/db/schema';
import { mapToBuffer } from '$lib/shared/map';
// import { gzipSync } from 'zlib';

export const GET: RequestHandler = async ({ locals }) => {
	if (!locals.session) {
		return new Response('Unauthorized', { status: 401 });
	}

	const map = await db.select().from(mapCells);
	console.log(`Loaded ${map.length} cells from db.`);

	const buffer = mapToBuffer(map);

	// const gzipped = gzipSync(Buffer.from(buffer));
	// console.log(
	// 	`Size is ${buffer.byteLength.toLocaleString()} / ${gzipped.byteLength.toLocaleString()} gzipped`
	// );

	return new Response(buffer, { headers: { 'Content-Type': 'application/octet-stream' } });
};
