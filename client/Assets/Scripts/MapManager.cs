using System.Collections.Generic;
using Map;
using UnityEngine;
using UnityEngine.Tilemaps;

public class MapManager : MonoBehaviour
{
    [Header("Maps")] [SerializeField] private Tilemap _baseLayer;
    [SerializeField] private Tilemap _detailsLayer;

    [Header("Tiles")] [SerializeField] private Tile _grassTile;
    [SerializeField] private Tile _longGrassTile;

    [SerializeField] private Tile _forestTile;
    [SerializeField] private Tile _waterTile;
    [SerializeField] private Tile _beachTile;
    [SerializeField] private Tile _mountainTile;

    [field: SerializeField] public Vector2Int Dimensions { get; private set; }

    private void Start()
    {
        NetworkManager.Instance.OnMapDataReceived.AddListener(OnMapDataReceived);
    }

    private void OnMapDataReceived(MapCell[] mapCells, Vector2Int dimensions)
    {
        Dimensions = dimensions;

        _baseLayer.ClearAllTiles();
        _detailsLayer.ClearAllTiles();

        var baseTiles = new TileBase[mapCells.Length];
        var detailTiles = new TileBase[mapCells.Length];

        for (var i = 0; i < mapCells.Length; i++)
        {
            var cell = mapCells[i];

            var biome = cell.Biome;
            var cosmetic = cell.Cosmetic;

            baseTiles[i] = biome switch
            {
                CellBiome.Grass => _grassTile,
                CellBiome.Water => _waterTile,
                CellBiome.Forest => _forestTile,
                CellBiome.Mountain => _mountainTile,
                CellBiome.Beach => _beachTile,
                _ => null
            };

            detailTiles[i] = biome switch
            {
                CellBiome.Grass => cosmetic switch
                {
                    0b0001 => _longGrassTile,
                    _ => null
                },
                _ => null
            };
        }

        var bounds = new BoundsInt(0, 0, 0, Dimensions.x, Dimensions.y, 1);
        _baseLayer.SetTilesBlock(bounds, baseTiles);
        _detailsLayer.SetTilesBlock(bounds, detailTiles);
    }
}