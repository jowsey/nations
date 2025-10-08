using System;
using System.Collections.Generic;
using System.Text;
using Cysharp.Threading.Tasks;
using JetBrains.Annotations;
using MikeSchweitzer.WebSocket;
using Newtonsoft.Json;
using UnityEngine;
using UnityEngine.Events;
using UnityEngine.Networking;

public record InboundMessage
{
    public string Type;
    public object Data;
}

public class NetworkManager : MonoBehaviour
{
    [Serializable]
    public class SocketState
    {
        [CanBeNull] public string Token;
    }

    public class MapCell
    {
        public uint Q;
        public uint R;
        public uint Height;
    }

    private const string TokenPrefKey = "token";

    public static NetworkManager Instance { get; private set; }

    [field: SerializeField] public string SocketUrl { get; private set; } = "ws://localhost:3000/ws";
    [field: SerializeField] public string ApiUrl { get; private set; } = "http://localhost:3000/api";
    [SerializeField] private WebSocketConnection _socket;
    [SerializeField] private bool _clearPrefs;

    [field: SerializeField] public SocketState State { get; private set; } = new();

    public UnityEvent<List<MapCell>, Vector2Int> OnMapDataReceived = new();

    private void OnValidate()
    {
        if (_socket == null) _socket = GetComponent<WebSocketConnection>();
    }

    private void Awake()
    {
        if (Instance != null && Instance != this)
        {
            Destroy(gameObject);
            return;
        }

        Instance = this;
    }

    private void Start()
    {
        if (_clearPrefs) PlayerPrefs.DeleteKey(TokenPrefKey);

        State.Token = PlayerPrefs.GetString(TokenPrefKey);
        Debug.Log($"Loaded token: {State.Token}");

        _socket.MessageReceived += OnMessageReceived;
        _socket.StateChanged += OnStateChanged;
        _ = Connect();
    }

    private void OnStateChanged(WebSocketConnection connection, WebSocketState oldState, WebSocketState newState)
    {
        Debug.Log($"Socket state: {oldState} -> {newState}");
    }

    private void OnMessageReceived(WebSocketConnection connection, WebSocketMessage message)
    {
        Debug.Log($"Message received: {message}");

        var data = JsonConvert.DeserializeObject<InboundMessage>(message.String);
        Debug.Log($"Message type: {data.Type}");

        switch (data.Type)
        {
            // case "newUser":
            // {
            //     Debug.Log("New user data: " + data.Data);
            //     var userData = JsonConvert.DeserializeObject<NewUserData>(data.Data.ToString());
            //     PlayerPrefs.SetString(TokenPrefKey, userData.Token);
            //     State.Token = userData.Token;
            //     break;
            // }
            default:
            {
                Debug.Log("Unknown message type: " + data.Type);
                break;
            }
        }
    }

    private async UniTaskVoid Connect()
    {
        Debug.Log("Connecting...");

        if (string.IsNullOrEmpty(State.Token))
        {
            Debug.Log("Getting new token...");

            var req = UnityWebRequest.Get(ApiUrl + "/new-user");
            await req.SendWebRequest();

            if (req.result != UnityWebRequest.Result.Success)
            {
                Debug.LogError("No token & failed getting new: " + req.error);
                return; // todo retry or something
            }

            State.Token = req.downloadHandler.text;
            PlayerPrefs.SetString(TokenPrefKey, State.Token);
            Debug.Log("New token: " + State.Token);
        }

        _socket.DesiredConfig = new WebSocketConfig
        {
            Url = SocketUrl,
            MaxReceiveBytes = 1 * 1024 * 1024, // 1 MB
            MaxSendBytes = 1 * 1024 * 1024, // 1 MB
            DotNetHeaders = new Dictionary<string, string>
            {
                ["token"] = State.Token
            }
        };

        _socket.Connect();
        await UniTask.WaitUntil(() => _socket.State == WebSocketState.Connected);
        Debug.Log("User authenticated.");

        var mapReq = UnityWebRequest.Get(ApiUrl + "/map");
        mapReq.SetRequestHeader("token", State.Token);
        await mapReq.SendWebRequest();
        if (mapReq.result != UnityWebRequest.Result.Success)
        {
            Debug.LogError("Failed getting map data: " + mapReq.error);
            return;
        }

        var mapData = ParseMapData(mapReq.downloadHandler.data);
        OnMapDataReceived.Invoke(mapData.cells, mapData.dimensions);
        Debug.Log($"Map data received: {mapData.dimensions.x}x{mapData.dimensions.y}, {mapData.cells.Count} cells");
    }

    private (List<MapCell> cells, Vector2Int dimensions) ParseMapData(byte[] data)
    {
        var dimensions = new Vector2Int(
            BitConverter.ToUInt16(data, 0),
            BitConverter.ToUInt16(data, 2)
        );

        var cells = new List<MapCell>(dimensions.x * dimensions.y);

        const int stride = 1;
        var cellI = 0;
        for (var i = 4; i < data.Length; i += stride)
        {
            var q = (uint)(cellI % dimensions.x);
            var r = (uint)(cellI / dimensions.x);
            var height = data[i];

            cells.Add(new MapCell
            {
                Q = q,
                R = r,
                Height = height
            });

            cellI++;
        }

        return (cells, dimensions);
    }
}