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

    private void OnMapDataReceived(List<MapCell> mapCells, Vector2Int dimensions)
    {
        Dimensions = dimensions;

        _baseLayer.ClearAllTiles();
        _detailsLayer.ClearAllTiles();

        foreach (var cell in mapCells)
        {
            var position = new Vector3Int(cell.Q, cell.R, 0);
            var biome = cell.Biome;

            var baseTile = biome switch
            {
                CellBiome.Grass => _grassTile,
                CellBiome.Water => _waterTile,
                CellBiome.Forest => _forestTile,
                CellBiome.Mountain => _mountainTile,
                CellBiome.Beach => _beachTile,
                _ => null
            };

            var cosmetic = cell.Cosmetic;
            var detailTile = biome switch
            {
                CellBiome.Grass => cosmetic switch
                {
                    0b0001 => _longGrassTile,
                    _ => null
                },
                _ => null
            };

            _baseLayer.SetTile(position, baseTile);
            _detailsLayer.SetTile(position, detailTile);
        }
    }
}