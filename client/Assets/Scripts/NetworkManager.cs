using System.Collections.Generic;
using MikeSchweitzer.WebSocket;
using Newtonsoft.Json;
using UnityEngine;

public record InboundMessage
{
    public string Type;
    public object Data;
}

public record NewUserData
{
    public string Id;
    public string Token;
}

public class NetworkManager : MonoBehaviour
{
    public string ServerURL = "ws://localhost:3000/ws";
    [SerializeField] private WebSocketConnection _socket;

    [SerializeField] private bool _clearPrefs;

    private const string IdPrefKey = "userid";
    private const string TokenPrefKey = "token";

    private void OnValidate()
    {
        if (_socket == null) _socket = GetComponent<WebSocketConnection>();
    }

    private void Start()
    {
        if (_clearPrefs)
        {
            PlayerPrefs.DeleteKey(IdPrefKey);
            PlayerPrefs.DeleteKey(TokenPrefKey);
        }

        _socket.DesiredConfig = new WebSocketConfig
        {
            Url = ServerURL,
            DotNetHeaders = new Dictionary<string, string>
            {
                ["id"] = PlayerPrefs.GetString(IdPrefKey),
                ["token"] = PlayerPrefs.GetString(TokenPrefKey)
            }
        };

        _socket.MessageReceived += OnMessageReceived;
        _socket.Connect();
    }

    private void OnMessageReceived(WebSocketConnection connection, WebSocketMessage message)
    {
        Debug.Log($"Message received: {message}");

        var data = JsonConvert.DeserializeObject<InboundMessage>(message.String);
        Debug.Log($"Message type: {data.Type}");

        switch (data.Type)
        {
            case "newUser":
            {
                Debug.Log("New user data: " + data.Data);
                var userData = JsonConvert.DeserializeObject<NewUserData>(data.Data.ToString());
                PlayerPrefs.SetString(IdPrefKey, userData.Id);
                PlayerPrefs.SetString(TokenPrefKey, userData.Token);
                break;
            }
            default:
            {
                Debug.Log("Unknown message type: " + data.Type);
                break;
            }
        }
    }
}