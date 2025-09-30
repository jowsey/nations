<script lang="ts">
	import type { HexCell, StringCoords, Vector2 } from '$lib/shared/types';
	import type { SvelteHTMLElements } from 'svelte/elements';
	import { onMount, untrack } from 'svelte';
	import { offsetToEvenQ } from '$lib/shared/map';

	import * as THREE from 'three';
	import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
	import { MeshoptDecoder } from 'three/addons/libs/meshopt_decoder.module.js';
	import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
	import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
	import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';
	import { OrbitControls } from 'three/addons/controls/OrbitControls.js';

	type DivAttribs = SvelteHTMLElements['div'];
	interface Props extends DivAttribs {
		data: ArrayBuffer | undefined;
	}

	let { data, ...attribs }: Props = $props();

	const tileSize = 8;
	const tileOversizing = 4 / 3; // reduce gaps
	const zAxisScale = 0.866; // cos(30deg)  hexagons suck

	// fuck you and your slow-ass map implementation
	// eslint-disable-next-line svelte/prefer-svelte-reactivity
	const map: Map<StringCoords, HexCell> = new Map();
	let mapDimensions: Vector2 | undefined = $state(undefined);

	let mapContainer: HTMLDivElement;
	let mapCanvas: HTMLCanvasElement;

	let renderer: THREE.WebGLRenderer;
	let camera: THREE.PerspectiveCamera;
	let scene: THREE.Scene;
	let composer: EffectComposer;
	let orbit: OrbitControls;

	let batchedMesh: THREE.BatchedMesh;
	let meshGeometryId: number = 0;
	let tileMeshLoaded = $state(false);

	let tileMaterial: THREE.MeshStandardMaterial;
	let grassColour: THREE.Color;
	let waterColour: THREE.Color;
	let mountainColour: THREE.Color;

	let lastTime: number | undefined = undefined;
	const animate = (time: number) => {
		if (!mapContainer) return;

		const deltaTime = lastTime ? (time - lastTime) / 1000 : 0;
		lastTime = time;

		const containerWidth = mapContainer.clientWidth; // set by layout engine
		const containerHeight = mapContainer.clientHeight;
		const canvasWidth = renderer.domElement.width; // set by us
		const canvasHeight = renderer.domElement.height;

		if (containerWidth !== canvasWidth || containerHeight !== canvasHeight) {
			renderer.setSize(containerWidth, containerHeight);
			composer.setSize(containerWidth, containerHeight);
			renderer.setPixelRatio(window.devicePixelRatio);
			composer.setPixelRatio(window.devicePixelRatio);

			if (camera) {
				camera.aspect = containerWidth / containerHeight;
				camera.updateProjectionMatrix();
			}

			orbit.update(deltaTime);
			composer.render(deltaTime);
		}
	};

	onMount(() => {
		// materials & colours
		tileMaterial = new THREE.MeshStandardMaterial({
			metalness: 0.1,
			roughness: 0.2
		});

		grassColour = new THREE.Color(0x94bf30);
		waterColour = new THREE.Color(0x25acf5);
		mountainColour = new THREE.Color(0xa69a9c);

		// mesh loading
		const loader = new GLTFLoader();
		loader.setMeshoptDecoder(MeshoptDecoder);
		loader.load('/3d/hexagon_tile.glb', (gltf) => {
			const tileMesh = gltf.scene.children[0] as THREE.Mesh;
			tileMesh.geometry.rotateY(Math.PI / 6);

			const vertexCount = tileMesh.geometry.attributes.position.count;
			const indexCount = tileMesh.geometry.index?.count;

			batchedMesh = new THREE.BatchedMesh(0, vertexCount, indexCount, tileMaterial);
			meshGeometryId = batchedMesh.addGeometry(tileMesh.geometry);
			tileMeshLoaded = true;
		});

		// general scene
		scene = new THREE.Scene();
		const ambientLight = new THREE.AmbientLight(0xffffff, 1);
		scene.add(ambientLight);

		const sunLight = new THREE.DirectionalLight(0xffffff, 1);
		sunLight.position.set(100, 100, 250);
		sunLight.castShadow = true;
		scene.add(sunLight);

		// renderer
		renderer = new THREE.WebGLRenderer({
			canvas: mapCanvas,
			alpha: true,
			logarithmicDepthBuffer: true
		});
		const width = mapContainer.clientWidth;
		const height = mapContainer.clientHeight;
		renderer.setSize(width, height);
		renderer.setPixelRatio(window.devicePixelRatio);
		renderer.setClearColor(0x1793e6, 1);

		renderer.toneMapping = THREE.ACESFilmicToneMapping;

		renderer.setAnimationLoop(animate);

		// camera
		camera = new THREE.PerspectiveCamera(75, width / height, 0.1, 10_000);

		// orbit controls
		orbit = new OrbitControls(camera, renderer.domElement);
		orbit.enableDamping = true;
		orbit.minDistance = 50;
		orbit.maxDistance = 1000;
		orbit.maxTargetRadius = 1000;
		orbit.maxPolarAngle = Math.PI / 2 - 0.35;
		orbit.screenSpacePanning = false;
		orbit.mouseButtons = {
			LEFT: THREE.MOUSE.PAN,
			MIDDLE: THREE.MOUSE.DOLLY,
			RIGHT: THREE.MOUSE.ROTATE
		};
		orbit.zoomToCursor = true;

		orbit.update();

		composer = new EffectComposer(renderer);
		composer.setSize(width, height);
		composer.setPixelRatio(window.devicePixelRatio);

		const renderPass = new RenderPass(scene, camera!);
		composer.addPass(renderPass);

		const outputPass = new OutputPass();
		composer.addPass(outputPass);

		return () => {
			renderer.dispose();
			composer.dispose();
			orbit.dispose();
		};
	});

	// update orbit target when map dimensions change
	$effect(() => {
		if (orbit && mapDimensions) {
			orbit.target.set((mapDimensions.x * tileSize) / 2, 0, (mapDimensions.y * tileSize) / 2);
			orbit.update();
		}
	});

	// load map data when available
	$effect(() => {
		if (tileMeshLoaded && data) {
			untrack(() => {
				scene.remove(batchedMesh);

				console.log(`Map data is ${data.byteLength} bytes`);
				let dataView = new DataView(data);

				let x = dataView.getFloat32(0);
				let y = dataView.getFloat32(4);

				mapDimensions = { x, y };
				console.log(`Map dimensions: ${mapDimensions?.x}, ${mapDimensions?.y}`);

				for (let offset = 8; offset < data.byteLength; offset += 12) {
					const q = dataView.getFloat32(offset);
					const r = dataView.getFloat32(offset + 4);
					const height = dataView.getFloat32(offset + 8);

					map.set(`${q},${r}`, { q, r, height });
				}

				console.log(`Loaded ${map.size} cells`);
				batchedMesh.setInstanceCount(map.size);

				for (const cell of map.values()) {
					const worldPos = offsetToEvenQ({ q: cell.q, r: cell.r });

					const instanceId = batchedMesh!.addInstance(meshGeometryId);
					const matrix = new THREE.Matrix4();
					matrix.makeScale(tileSize * tileOversizing, 8, tileSize * tileOversizing);
					matrix.setPosition(
						worldPos.x * tileSize,
						cell.height * 20,
						(worldPos.y * tileSize) / zAxisScale
					);
					batchedMesh?.setMatrixAt(instanceId, matrix);

					if (cell.height < 0.42) {
						batchedMesh?.setColorAt(instanceId, waterColour);
					} else if (cell.height < 0.8) {
						batchedMesh?.setColorAt(instanceId, grassColour);
					} else {
						batchedMesh?.setColorAt(instanceId, mountainColour);
					}
				}

				scene.add(batchedMesh);
			});
		}
	});
</script>

<div {...attribs} bind:this={mapContainer}>
	<canvas bind:this={mapCanvas} class="size-full"></canvas>
</div>
