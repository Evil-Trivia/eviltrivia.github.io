using UnityEngine;

/// <summary>
/// Optimized pen spawner using object pooling
/// Use this instead of PenSpawner.cs for better performance
/// </summary>
public class PenSpawnerOptimized : MonoBehaviour
{
    [Header("Spawning Settings")]
    public GameObject penPrefab;
    public float spawnInterval = 1f;
    public float minSpawnInterval = 0.3f;
    public float spawnIntervalDecrease = 0.05f;
    public float spawnHeight = 10f;
    
    [Header("Spawn Area")]
    public float spawnMinX = -8f;
    public float spawnMaxX = 8f;

    [Header("Object Pooling")]
    public int initialPoolSize = 30;

    private ObjectPool penPool;
    private float spawnTimer = 0f;
    private bool isSpawning = true;
    private float currentSpawnInterval;

    void Start()
    {
        currentSpawnInterval = spawnInterval;
        SetupObjectPool();
    }

    void SetupObjectPool()
    {
        // Create object pool
        GameObject poolObject = new GameObject("PenPool");
        poolObject.transform.SetParent(transform);
        
        penPool = poolObject.AddComponent<ObjectPool>();
        penPool.prefab = penPrefab;
        penPool.initialPoolSize = initialPoolSize;
        penPool.canGrow = true;
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
            Debug.LogWarning("Pen prefab not assigned to PenSpawnerOptimized!");
            return;
        }

        // Random X position
        float spawnX = Random.Range(spawnMinX, spawnMaxX);
        Vector2 spawnPosition = new Vector2(spawnX, spawnHeight);

        // Get pen from pool
        float randomRotation = Random.Range(-30f, 30f);
        Quaternion rotation = Quaternion.Euler(0, 0, randomRotation);
        
        GameObject pen = penPool.SpawnFromPool(spawnPosition, rotation);

        if (pen != null)
        {
            // Reset pen properties
            Rigidbody2D penRb = pen.GetComponent<Rigidbody2D>();
            if (penRb != null)
            {
                penRb.velocity = Vector2.zero;
                penRb.angularVelocity = 0f;
                
                // Add slight horizontal velocity
                float randomHorizontalVelocity = Random.Range(-1f, 1f);
                penRb.velocity = new Vector2(randomHorizontalVelocity, 0);
            }

            // Reset pen script
            Pen penScript = pen.GetComponent<Pen>();
            if (penScript != null)
            {
                penScript.ResetPen();
            }
        }
    }

    public void StopSpawning()
    {
        isSpawning = false;
        
        // Return all pens to pool when game ends
        if (penPool != null)
        {
            penPool.ReturnAllToPool();
        }
    }

    public void StartSpawning()
    {
        isSpawning = true;
        currentSpawnInterval = spawnInterval;
        spawnTimer = 0f;
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

