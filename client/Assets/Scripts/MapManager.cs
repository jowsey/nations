using System.Collections.Generic;
using UnityEngine;
using UnityEngine.Tilemaps;

public class MapManager : MonoBehaviour
{
    [Header("Maps")] [SerializeField] private Tilemap _baseLayer;
    [SerializeField] private Tilemap _detailsLayer;

    [Header("Tiles")] [SerializeField] private Tile _grassTile;

    [field: SerializeField] public Vector2Int Dimensions { get; private set; }

    private void Start()
    {
        NetworkManager.Instance.OnMapDataReceived.AddListener(OnMapDataReceived);
    }

    private void OnMapDataReceived(List<NetworkManager.MapCell> mapCells, Vector2Int dimensions)
    {
        Dimensions = dimensions;

        foreach (var cell in mapCells)
        {
            // todo
            var position = new Vector3Int((int)cell.Q, (int)cell.R, 0); // todo this conversion kinda yucky
            _baseLayer.SetTile(position, _grassTile);
        }
    }
}