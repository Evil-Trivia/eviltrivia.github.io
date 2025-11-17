using UnityEngine;
using UnityEngine.SceneManagement;
using UnityEngine.UI;

public class GameManager : MonoBehaviour
{
    public static GameManager Instance { get; private set; }

    [Header("UI References")]
    public Text scoreText;
    public GameObject gameOverPanel;
    public Text finalScoreText;

    [Header("Game Settings")]
    public float gameSpeed = 1f;
    public float speedIncreaseRate = 0.05f; // Speed increases over time
    public float speedIncreaseInterval = 5f; // Every 5 seconds

    private float score = 0f;
    private bool isGameActive = false;
    private float speedIncreaseTimer = 0f;

    void Awake()
    {
        if (Instance == null)
        {
            Instance = this;
        }
        else
        {
            Destroy(gameObject);
        }
    }

    void Start()
    {
        StartGame();
    }

    void Update()
    {
        if (isGameActive)
        {
            // Update score (time survived)
            score += Time.deltaTime;
            UpdateScoreDisplay();

            // Gradually increase game speed
            speedIncreaseTimer += Time.deltaTime;
            if (speedIncreaseTimer >= speedIncreaseInterval)
            {
                speedIncreaseTimer = 0f;
                gameSpeed += speedIncreaseRate;
            }
        }
    }

    public void StartGame()
    {
        isGameActive = true;
        score = 0f;
        gameSpeed = 1f;
        speedIncreaseTimer = 0f;
        
        if (gameOverPanel != null)
            gameOverPanel.SetActive(false);
        
        UpdateScoreDisplay();
    }

    public void GameOver()
    {
        if (!isGameActive) return;
        
        isGameActive = false;
        
        if (gameOverPanel != null)
        {
            gameOverPanel.SetActive(true);
            if (finalScoreText != null)
                finalScoreText.text = "TIME SURVIVED:\n" + Mathf.FloorToInt(score) + " SECONDS";
        }

        // Stop all pen spawning
        PenSpawner spawner = FindObjectOfType<PenSpawner>();
        if (spawner != null)
            spawner.StopSpawning();
    }

    void UpdateScoreDisplay()
    {
        if (scoreText != null)
            scoreText.text = "TIME: " + Mathf.FloorToInt(score) + "s";
    }

    public void RestartGame()
    {
        SceneManager.LoadScene(SceneManager.GetActiveScene().name);
    }

    public bool IsGameActive()
    {
        return isGameActive;
    }

    public float GetGameSpeed()
    {
        return gameSpeed;
    }
}

