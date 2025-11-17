using UnityEngine;

public class PenSpawner : MonoBehaviour
{
    [Header("Spawning Settings")]
    public GameObject penPrefab;
    public float spawnInterval = 1f;
    public float minSpawnInterval = 0.3f;
    public float spawnIntervalDecrease = 0.05f; // Decrease interval over time
    public float spawnHeight = 10f;
    
    [Header("Spawn Area")]
    public float spawnMinX = -8f;
    public float spawnMaxX = 8f;

    private float spawnTimer = 0f;
    private bool isSpawning = true;
    private float currentSpawnInterval;

    void Start()
    {
        currentSpawnInterval = spawnInterval;
    }

    void Update()
    {
        if (!isSpawning || !GameManager.Instance.IsGameActive())
            return;

        spawnTimer += Time.deltaTime;

        if (spawnTimer >= currentSpawnInterval)
        {
            SpawnPen();
            spawnTimer = 0f;

            // Gradually decrease spawn interval (spawn faster over time)
            currentSpawnInterval = Mathf.Max(minSpawnInterval, currentSpawnInterval - spawnIntervalDecrease);
        }
    }

    void SpawnPen()
    {
        if (penPrefab == null)
        {
            Debug.LogWarning("Pen prefab not assigned to PenSpawner!");
            return;
        }

        // Random X position
        float spawnX = Random.Range(spawnMinX, spawnMaxX);
        Vector2 spawnPosition = new Vector2(spawnX, spawnHeight);

        // Instantiate pen
        GameObject pen = Instantiate(penPrefab, spawnPosition, Quaternion.identity);
        
        // Give it a slight random rotation
        float randomRotation = Random.Range(-30f, 30f);
        pen.transform.rotation = Quaternion.Euler(0, 0, randomRotation);

        // Add slight horizontal velocity
        Rigidbody2D penRb = pen.GetComponent<Rigidbody2D>();
        if (penRb != null)
        {
            float randomHorizontalVelocity = Random.Range(-1f, 1f);
            penRb.velocity = new Vector2(randomHorizontalVelocity, 0);
        }
    }

    public void StopSpawning()
    {
        isSpawning = false;
    }

    void OnDrawGizmosSelected()
    {
        // Draw spawn area in editor
        Gizmos.color = Color.red;
        Vector3 leftPoint = new Vector3(spawnMinX, spawnHeight, 0);
        Vector3 rightPoint = new Vector3(spawnMaxX, spawnHeight, 0);
        Gizmos.DrawLine(leftPoint, rightPoint);
        Gizmos.DrawWireSphere(leftPoint, 0.3f);
        Gizmos.DrawWireSphere(rightPoint, 0.3f);
    }
}

