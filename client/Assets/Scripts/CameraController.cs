using UnityEngine;
using UnityEngine.InputSystem;

public class CameraController : MonoBehaviour
{
    private Camera _camera;
    private InputAction _panAction;
    private InputAction _zoomAction;

    [SerializeField] private float _zoomOutSpeedUpMultiplier = 6;

    [Header("Pan")] [SerializeField] private float _panSpeed = 32;
    [SerializeField] private float _panLerpSpeed = 10;

    [Header("Zoom")] [SerializeField] private float _zoomSpeed = 1.6f;
    [SerializeField] private float _minZoom = 4;
    [SerializeField] private float _maxZoom = 144;
    [SerializeField] private float _zoomLerpSpeed = 10;

    private Vector3 _targetPosition;
    private float _targetZoom;

    private void Awake()
    {
        _camera = Camera.main;
        _panAction = InputSystem.actions.FindAction("Pan");
        _zoomAction = InputSystem.actions.FindAction("Zoom");

        _targetPosition = transform.position;
        _targetZoom = _camera!.orthographicSize;
    }

    private void Update()
    {
        var panInput = _panAction.ReadValue<Vector2>();
        var zoomInput = _zoomAction.ReadValue<float>();

        // 1 - zoomOutSpeedUpMultiplier as zoom approaches max
        var zoomFactor = 1 + Mathf.InverseLerp(_minZoom, _maxZoom, _targetZoom) * _zoomOutSpeedUpMultiplier;

        // Pan
        _targetPosition += new Vector3(panInput.x, panInput.y, 0) * (_panSpeed * zoomFactor * Time.deltaTime);
        transform.position = Vector3.Lerp(transform.position, _targetPosition, Time.deltaTime * _panLerpSpeed);

        // Zoom
        _targetZoom = Mathf.Clamp(_targetZoom + zoomInput * _zoomSpeed * zoomFactor, _minZoom, _maxZoom);
        _camera.orthographicSize = Mathf.Lerp(_camera.orthographicSize, _targetZoom, Time.deltaTime * _zoomLerpSpeed);
    }
}