using System.Collections;
using UnityEngine;
using UnityEngine.Networking;


public class NetworkManager : MonoBehaviour
{
    private record SignInResponse
    {
        public string url;
        public bool redirect;
    }

    public string ServerURL = "http://localhost:3000";

    public IEnumerator AttemptSignIn()
    {
        // launch http server on 47105
        
        Application.OpenURL(ServerURL + "/api/auth/sign-in/discord");
        yield return null;
     
        // const string data = "{ \"provider\": \"discord\" }";
        // var request = UnityWebRequest.Post(ServerURL + "/api/auth/sign-in/social", data, "application/json");
        // yield return request.SendWebRequest();
        //
        // if (request.result != UnityWebRequest.Result.Success)
        // {
        //     Debug.LogError("Error: " + request.error);
        //     yield break;
        // }
        //
        // Debug.Log("Response: " + request.downloadHandler.text);
        //
        // var response = JsonUtility.FromJson<SignInResponse>(request.downloadHandler.text);
        // Application.OpenURL(response.url);
    }
}