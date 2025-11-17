using UnityEngine;

public class Pen : MonoBehaviour
{
    [Header("Settings")]
    public float lifetime = 10f; // Auto-destroy after falling off screen
    public float fallSpeedMultiplier = 1f;

    private Rigidbody2D rb;
    private float aliveTime = 0f;

    void Start()
    {
        rb = GetComponent<Rigidbody2D>();
        
        // Apply game speed to fall speed
        if (rb != null)
        {
            rb.gravityScale = GameManager.Instance.GetGameSpeed() * fallSpeedMultiplier;
        }
    }

    void Update()
    {
        aliveTime += Time.deltaTime;

        // Auto-destroy if alive too long (fell off screen)
        if (aliveTime > lifetime)
        {
            Destroy(gameObject);
        }

        // Update fall speed based on current game speed
        if (rb != null)
        {
            rb.gravityScale = GameManager.Instance.GetGameSpeed() * fallSpeedMultiplier;
        }
    }

    void OnBecameInvisible()
    {
        // Destroy pen when it leaves camera view
        Destroy(gameObject, 1f);
    }

    /// <summary>
    /// Reset pen state (useful if upgrading to pooling later)
    /// </summary>
    public void ResetPen()
    {
        aliveTime = 0f;
        if (rb != null)
        {
            rb.velocity = Vector2.zero;
            rb.angularVelocity = 0f;
        }
    }
}

