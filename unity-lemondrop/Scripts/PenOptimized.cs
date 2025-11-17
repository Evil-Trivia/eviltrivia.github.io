using UnityEngine;

/// <summary>
/// Optimized pen script that works with object pooling
/// Use with PenSpawnerOptimized.cs
/// </summary>
public class PenOptimized : MonoBehaviour
{
    [Header("Settings")]
    public float lifetime = 10f;
    public float fallSpeedMultiplier = 1f;

    private Rigidbody2D rb;
    private float aliveTime = 0f;
    private ObjectPool parentPool;
    private bool isActive = false;

    void Awake()
    {
        rb = GetComponent<Rigidbody2D>();
    }

    void OnEnable()
    {
        // Called when object is activated from pool
        ResetPen();
    }

    void Update()
    {
        if (!isActive) return;

        aliveTime += Time.deltaTime;

        // Return to pool if alive too long
        if (aliveTime > lifetime)
        {
            ReturnToPool();
        }

        // Update fall speed based on current game speed
        if (rb != null)
        {
            rb.gravityScale = GameManager.Instance.GetGameSpeed() * fallSpeedMultiplier;
        }

        // Check if far below screen - return to pool
        if (transform.position.y < -15f)
        {
            ReturnToPool();
        }
    }

    public void ResetPen()
    {
        aliveTime = 0f;
        isActive = true;
        
        if (rb != null)
        {
            rb.velocity = Vector2.zero;
            rb.angularVelocity = 0f;
            rb.gravityScale = GameManager.Instance.GetGameSpeed() * fallSpeedMultiplier;
        }
    }

    void ReturnToPool()
    {
        if (!isActive) return;
        
        isActive = false;
        
        // Find parent pool
        if (parentPool == null)
        {
            parentPool = GetComponentInParent<ObjectPool>();
        }

        if (parentPool != null)
        {
            parentPool.ReturnToPool(gameObject);
        }
        else
        {
            // Fallback if no pool found
            gameObject.SetActive(false);
        }
    }

    void OnCollisionEnter2D(Collision2D collision)
    {
        // If hit lemon, don't return to pool immediately (let game over happen)
        if (collision.gameObject.CompareTag("Player") || collision.gameObject.name == "Lemon")
        {
            // Lemon will handle game over
            // We'll return to pool when spawner stops
        }
    }

    void OnBecameInvisible()
    {
        // Return to pool when leaves camera view
        if (isActive && transform.position.y < -10f)
        {
            ReturnToPool();
        }
    }
}

