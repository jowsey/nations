using UnityEngine;
using UnityEngine.UI;

namespace UI
{
    [RequireComponent(typeof(Button))]
    public class DiscordSignInButton : MonoBehaviour
    {
        [SerializeField] private Button _button;

        private void OnValidate()
        {
            if (_button == null) _button = GetComponent<Button>();
        }

        private void Start()
        {
            _button.onClick.AddListener(() =>
            {
                var networkManager = FindAnyObjectByType<NetworkManager>();
                if (networkManager)
                {
                    StartCoroutine(networkManager.AttemptSignIn());
                }
            });
        }
    }
}