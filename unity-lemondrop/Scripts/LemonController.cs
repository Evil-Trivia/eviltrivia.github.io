using UnityEngine;

public class LemonController : MonoBehaviour
{
    [Header("Movement Settings")]
    public float moveForce = 5f;
    public float maxSpeed = 8f;
    public float jumpForce = 0f; // No jumping for now, but ready if needed

    [Header("Ground Check")]
    public Transform groundCheck;
    public float groundCheckRadius = 0.2f;
    public LayerMask groundLayer;

    private Rigidbody2D rb;
    private bool isGrounded = false;
    private float moveInput;
    private SpriteRenderer spriteRenderer;
    private bool isDead = false;

    void Start()
    {
        rb = GetComponent<Rigidbody2D>();
        spriteRenderer = GetComponent<SpriteRenderer>();
        
        // Ensure rigidbody is set up for proper physics
        rb.collisionDetectionMode = CollisionDetectionMode2D.Continuous;
        rb.interpolation = RigidbodyInterpolation2D.Interpolate;
    }

    void Update()
    {
        if (isDead || !GameManager.Instance.IsGameActive())
            return;

        // Get input
        moveInput = 0f;
        
        if (Input.GetKey(KeyCode.LeftArrow) || Input.GetKey(KeyCode.A))
            moveInput = -1f;
        else if (Input.GetKey(KeyCode.RightArrow) || Input.GetKey(KeyCode.D))
            moveInput = 1f;

        // Mobile touch controls
        if (Input.touchCount > 0)
        {
            Touch touch = Input.GetTouch(0);
            if (touch.position.x < Screen.width / 2)
                moveInput = -1f;
            else
                moveInput = 1f;
        }
    }

    void FixedUpdate()
    {
        if (isDead || !GameManager.Instance.IsGameActive())
            return;

        // Check if grounded
        isGrounded = Physics2D.OverlapCircle(groundCheck.position, groundCheckRadius, groundLayer);

        // Apply movement force
        if (Mathf.Abs(rb.velocity.x) < maxSpeed)
        {
            rb.AddForce(new Vector2(moveInput * moveForce, 0));
        }

        // Limit max speed
        if (Mathf.Abs(rb.velocity.x) > maxSpeed)
        {
            rb.velocity = new Vector2(Mathf.Sign(rb.velocity.x) * maxSpeed, rb.velocity.y);
        }
    }

    void OnCollisionEnter2D(Collision2D collision)
    {
        // Check if hit by pen
        if (collision.gameObject.CompareTag("Pen"))
        {
            Die();
        }
    }

    void Die()
    {
        if (isDead) return;
        
        isDead = true;
        
        // Visual feedback - make lemon explode into particles or change color
        if (spriteRenderer != null)
            spriteRenderer.color = new Color(1f, 1f, 0f, 0.5f);

        // Create juice splatter effect
        CreateJuiceSplatter();

        // Game over
        GameManager.Instance.GameOver();
    }

    void CreateJuiceSplatter()
    {
        // Create simple particle effect with lemon juice
        GameObject particles = new GameObject("LemonJuice");
        particles.transform.position = transform.position;
        
        // You can add a ParticleSystem component in the editor
        // For now, we'll just create a simple visual effect
        
        Destroy(particles, 2f);
    }

    void OnDrawGizmosSelected()
    {
        // Draw ground check radius in editor
        if (groundCheck != null)
        {
            Gizmos.color = Color.yellow;
            Gizmos.DrawWireSphere(groundCheck.position, groundCheckRadius);
        }
    }
}

