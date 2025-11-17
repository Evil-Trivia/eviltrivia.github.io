using UnityEngine;
using System.Collections.Generic;

/// <summary>
/// Object pooling system for better performance
/// Use this instead of Instantiate/Destroy for frequently spawned objects like pens
/// </summary>
public class ObjectPool : MonoBehaviour
{
    [Header("Pool Settings")]
    public GameObject prefab;
    public int initialPoolSize = 20;
    public bool canGrow = true;

    private List<GameObject> pooledObjects;

    void Start()
    {
        pooledObjects = new List<GameObject>();

        // Pre-instantiate objects
        for (int i = 0; i < initialPoolSize; i++)
        {
            CreateNewObject();
        }
    }

    GameObject CreateNewObject()
    {
        GameObject obj = Instantiate(prefab);
        obj.SetActive(false);
        obj.transform.SetParent(transform); // Keep hierarchy clean
        pooledObjects.Add(obj);
        return obj;
    }

    /// <summary>
    /// Get an inactive object from the pool
    /// </summary>
    public GameObject GetPooledObject()
    {
        // Find first inactive object
        foreach (GameObject obj in pooledObjects)
        {
            if (!obj.activeInHierarchy)
            {
                return obj;
            }
        }

        // If all objects are active and pool can grow, create new one
        if (canGrow)
        {
            return CreateNewObject();
        }

        // Pool is full and can't grow
        return null;
    }

    /// <summary>
    /// Get and activate object at position
    /// </summary>
    public GameObject SpawnFromPool(Vector3 position, Quaternion rotation)
    {
        GameObject obj = GetPooledObject();
        
        if (obj != null)
        {
            obj.transform.position = position;
            obj.transform.rotation = rotation;
            obj.SetActive(true);
        }

        return obj;
    }

    /// <summary>
    /// Return object to pool (call this instead of Destroy)
    /// </summary>
    public void ReturnToPool(GameObject obj)
    {
        obj.SetActive(false);
        obj.transform.SetParent(transform);
    }

    /// <summary>
    /// Return all active objects to pool
    /// </summary>
    public void ReturnAllToPool()
    {
        foreach (GameObject obj in pooledObjects)
        {
            if (obj.activeInHierarchy)
            {
                obj.SetActive(false);
            }
        }
    }

    /// <summary>
    /// Get count of available objects
    /// </summary>
    public int GetAvailableCount()
    {
        int count = 0;
        foreach (GameObject obj in pooledObjects)
        {
            if (!obj.activeInHierarchy)
                count++;
        }
        return count;
    }
}

