using UnityEngine;

public class CameraController : MonoBehaviour
{
    [Header("Settings")]
    public float pixelsPerUnit = 16f; // For pixel-perfect rendering
    public bool pixelPerfect = true;

    void Start()
    {
        SetupPixelPerfectCamera();
    }

    void SetupPixelPerfectCamera()
    {
        if (!pixelPerfect) return;

        Camera cam = GetComponent<Camera>();
        if (cam != null)
        {
            // Set orthographic size based on screen height and pixels per unit
            cam.orthographic = true;
            cam.orthographicSize = Screen.height / (pixelsPerUnit * 2f);
        }
    }
}

