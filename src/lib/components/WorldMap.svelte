<script lang="ts">
	import type { HexCell, StringCoords, Vector2 } from '$lib/shared/types';
	import type { SvelteHTMLElements } from 'svelte/elements';
	import { onMount, untrack } from 'svelte';
	import { evenQToThreePos } from '$lib/shared/map';

	import * as THREE from 'three';
	import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
	import { MeshoptDecoder } from 'three/addons/libs/meshopt_decoder.module.js';
	import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
	import {
		EffectComposer,
		RenderPass,
		EffectPass,
		SMAAEffect,
		SSAOEffect,
		NormalPass,
		ToneMappingEffect,
		ToneMappingMode,
		BlendFunction,
		DepthDownsamplingPass,
		EdgeDetectionMode
	} from 'postprocessing';
	import { browser } from '$app/environment';

	interface MapLayer {
		id: string;
		mesh?: THREE.InstancedMesh;
		material: THREE.MeshStandardMaterial;
		tileCount: number;
		instanceId: number;
	}

	type DivAttribs = SvelteHTMLElements['div'];
	interface Props extends DivAttribs {
		data: ArrayBuffer | undefined;
	}

	let { data, ...attribs }: Props = $props();

	const tileScale = 8;
	const tileOversizing = 4 / 3 - 0.0001; // remove gaps with 4/3 & prevent z-fighting with -0.0001
	const zAxisScale = 0.866; // cos(30deg)  hexagons r weird

	const seaLevel = 0.42;
	const beachHeight = 0.04;
	const mountainHeight = 0.8;

	const waterShallowColour = new THREE.Color(0x25acf5);
	const waterDeepColour = new THREE.Color(0x1c75bd);

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

	const mapLayers: MapLayer[] = [
		{
			id: 'grass',
			material: new THREE.MeshStandardMaterial({
				color: new THREE.Color(0x94bf30),
				metalness: 0.0,
				roughness: 0.8
			}),
			tileCount: 0,
			instanceId: 0
		},
		{
			id: 'water',
			material: new THREE.MeshStandardMaterial({
				metalness: 0.0,
				roughness: 0.5
			}),
			tileCount: 0,
			instanceId: 0
		},
		{
			id: 'sand',
			material: new THREE.MeshStandardMaterial({
				color: new THREE.Color(0xf7e9a0),
				metalness: 0.0,
				roughness: 0.9
			}),
			tileCount: 0,
			instanceId: 0
		},
		{
			id: 'mountain',
			material: new THREE.MeshStandardMaterial({
				color: new THREE.Color(0xa69a9c),
				metalness: 0.0,
				roughness: 0.7
			}),
			tileCount: 0,
			instanceId: 0
		}
	];

	let tileGeometry: THREE.BufferGeometry | undefined;
	let tileMeshLoaded = $state(false);

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
			composer.setSize(containerWidth, containerHeight);

			camera.aspect = containerWidth / containerHeight;
			camera.updateProjectionMatrix();
		}

		orbit.update(deltaTime);
		composer.render(deltaTime);
	};

	// stuff we can work on before dom has loaded
	if (browser) {
		// mesh loading
		const loader = new GLTFLoader();
		loader.setMeshoptDecoder(MeshoptDecoder);
		loader.load('/3d/hexagon_tile.glb', (gltf) => {
			const tileMesh = gltf.scene.children[0] as THREE.Mesh;
			tileMesh.geometry.rotateY(Math.PI / 6); // flat top
			tileMesh.geometry.translate(0, 0.25, 0); // set pivot to bottom center
			tileGeometry = tileMesh.geometry;
			tileMeshLoaded = true;
		});

		// scene
		scene = new THREE.Scene();

		// lighting
		const ambientLight = new THREE.AmbientLight(0xffffff, 1);
		scene.add(ambientLight);

		const sunLight = new THREE.DirectionalLight(0xffffff, 1);
		sunLight.position.set(100, 100, 250);
		sunLight.castShadow = true;
		scene.add(sunLight);
	}

	onMount(() => {
		// renderer
		renderer = new THREE.WebGLRenderer({
			powerPreference: 'high-performance',
			canvas: mapCanvas,
			alpha: true,
			antialias: false, // postprocessing recommended defaults
			stencil: false, // ^
			depth: false // ^
		});

		const width = mapContainer.clientWidth;
		const height = mapContainer.clientHeight;
		renderer.setSize(width, height);
		renderer.setPixelRatio(window.devicePixelRatio);
		renderer.setClearColor(0x1793e6, 1);

		renderer.setAnimationLoop(animate);

		// camera
		camera = new THREE.PerspectiveCamera(75, width / height, 0.1, 10_000);

		// orbit controls
		orbit = new OrbitControls(camera, renderer.domElement);
		orbit.enableDamping = true;
		orbit.minDistance = 50;
		orbit.maxDistance = 1000;
		orbit.maxPolarAngle = Math.PI / 2 - 0.35;
		orbit.screenSpacePanning = false;
		orbit.mouseButtons = {
			LEFT: THREE.MOUSE.PAN,
			MIDDLE: THREE.MOUSE.DOLLY,
			RIGHT: THREE.MOUSE.ROTATE
		};
		orbit.zoomToCursor = true;

		// constrain orbit target to map area
		orbit.addEventListener('change', () => {
			if (!mapDimensions) return;

			const rect = new THREE.Vector3(
				mapDimensions.x,
				0,
				mapDimensions.y / zAxisScale
			).multiplyScalar(tileScale);
			const pos = orbit.target;

			if (pos.x < 0) pos.x = 0;
			if (pos.x > rect.x) pos.x = rect.x;
			if (pos.z < 0) pos.z = 0;
			if (pos.z > rect.z) pos.z = rect.z;
		});

		orbit.update();

		// effect composer
		composer = new EffectComposer(renderer, {
			frameBufferType: THREE.HalfFloatType
		});

		composer.addPass(new RenderPass(scene, camera));

		const normalPass = new NormalPass(scene, camera);
		composer.addPass(normalPass);

		const depthDownsamplingPass = new DepthDownsamplingPass({
			normalBuffer: normalPass.texture,
			resolutionScale: 0.5
		});
		composer.addPass(depthDownsamplingPass);

		// values copied + tweaked from https://github.com/pmndrs/postprocessing/blob/main/demo/src/demos/SSAODemo.js
		const ssaoEffect = new SSAOEffect(camera, normalPass.texture, {
			blendFunction: BlendFunction.MULTIPLY,
			distanceScaling: true,
			depthAwareUpsampling: true,
			normalDepthBuffer: depthDownsamplingPass.texture,
			samples: 7,
			rings: 4,
			distanceThreshold: 0.01,
			distanceFalloff: 0.005,
			rangeThreshold: 0.0003,
			rangeFalloff: 0.0001,
			luminanceInfluence: 0.7,
			minRadiusScale: 0.33,
			radius: 0.1,
			intensity: 1.33,
			bias: 0.025,
			fade: 0.01,
			resolutionScale: 0.5
		});
		const smaaEffect = new SMAAEffect({ edgeDetectionMode: EdgeDetectionMode.DEPTH });
		const tonemappingEffect = new ToneMappingEffect({ mode: ToneMappingMode.ACES_FILMIC });

		const effectPass = new EffectPass(camera, ssaoEffect, smaaEffect, tonemappingEffect);
		composer.addPass(effectPass);

		return () => {
			renderer.dispose();
			composer.dispose();
			orbit.dispose();
		};
	});

	// when map data is available and the tile mesh is done loading, build the map
	$effect(() => {
		if (tileMeshLoaded && data) {
			untrack(() => {
				for (const layer of mapLayers) {
					if (layer.mesh) {
						scene.remove(layer.mesh);
					}

					layer.instanceId = 0;
					layer.tileCount = 0;
				}

				map.clear();

				console.log(`Map data is ${data.byteLength} bytes`);
				let dataView = new DataView(data);

				let x = dataView.getFloat32(0);
				let y = dataView.getFloat32(4);

				mapDimensions = { x, y };
				console.log(`Map dimensions: ${mapDimensions.x}, ${mapDimensions.y}`);

				const mapCenter = new THREE.Vector3(mapDimensions.x, 0, mapDimensions.y / zAxisScale)
					.multiplyScalar(tileScale)
					.divideScalar(2);

				orbit.target.copy(mapCenter);
				camera.position.set(mapCenter.x, 500, mapCenter.z + 300);

				const grassLayer = mapLayers.find((l) => l.id === 'grass')!;
				const waterLayer = mapLayers.find((l) => l.id === 'water')!;
				const sandLayer = mapLayers.find((l) => l.id === 'sand')!;
				const mountainLayer = mapLayers.find((l) => l.id === 'mountain')!;

				for (let offset = 8; offset < data.byteLength; offset += 12) {
					const q = dataView.getFloat32(offset);
					const r = dataView.getFloat32(offset + 4);
					const height = dataView.getFloat32(offset + 8);

					if (height < seaLevel) {
						waterLayer.tileCount++;
					} else if (height < seaLevel + beachHeight) {
						sandLayer.tileCount++;
					} else if (height > mountainHeight) {
						mountainLayer.tileCount++;
					} else {
						grassLayer.tileCount++;
					}

					map.set(`${q},${r}`, { q, r, height });
				}

				console.log(`Loaded ${map.size} cells`);

				for (const layer of mapLayers) {
					layer.mesh = new THREE.InstancedMesh(tileGeometry!, layer.material, layer.tileCount);
					layer.mesh.instanceMatrix.setUsage(THREE.StaticDrawUsage);
				}

				// eslint-disable-next-line svelte/prefer-svelte-reactivity
				const depthColourMap: Map<number, THREE.Color> = new Map();

				for (const cell of map.values()) {
					let worldPos = evenQToThreePos({ q: cell.q, r: cell.r }, tileScale);
					worldPos.z /= zAxisScale;

					// if (worldPos.x == 0 && worldPos.z == 0) cell.height = 8;
					// if (worldPos.x == 1 && worldPos.z == -0.5) cell.height = 5;
					// if (worldPos.x == 0 && worldPos.z == 1) cell.height = 3;

					let stylisedHeight = cell.height;
					if (cell.height < seaLevel) {
						stylisedHeight = seaLevel;
					} else if (cell.height > mountainHeight) {
						const excess = cell.height - mountainHeight;
						stylisedHeight = mountainHeight + excess ** 0.5;
					}

					let layer: MapLayer;

					if (cell.height < seaLevel) {
						layer = waterLayer;

						const depth = seaLevel - cell.height;
						let colour = depthColourMap.get(depth);
						if (!colour) {
							colour = waterShallowColour.clone().lerp(waterDeepColour, depth / seaLevel);
							depthColourMap.set(depth, colour);
						}
						layer.mesh!.setColorAt(layer.instanceId, colour);
					} else if (cell.height < seaLevel + beachHeight) {
						layer = sandLayer;
					} else if (cell.height > mountainHeight) {
						layer = mountainLayer;
					} else {
						layer = grassLayer;
					}

					const matrix = new THREE.Matrix4()
						.makeScale(tileScale * tileOversizing, stylisedHeight * 50, tileScale * tileOversizing)
						.setPosition(worldPos);
					layer.mesh?.setMatrixAt(layer.instanceId, matrix);
					layer.instanceId++;
				}

				for (const layer of mapLayers) {
					if (layer.mesh) {
						layer.mesh.instanceMatrix.needsUpdate = true;
						if (layer.mesh.instanceColor) layer.mesh.instanceColor.needsUpdate = true;
						scene.add(layer.mesh);
					}
				}
			});
		}
	});
</script>

<div {...attribs} bind:this={mapContainer} class={['bg-[#86ccde]', attribs.class]}>
	<canvas bind:this={mapCanvas} class="size-full"></canvas>
</div>
