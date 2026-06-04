const fs = require('fs');
const path = require('path');
const { MongoClient } = require('mongodb');

const DATA_DIR = path.join(__dirname, 'data');

// Ensure data directory exists
if (!fs.existsSync(DATA_DIR)) {
  fs.mkdirSync(DATA_DIR, { recursive: true });
}

// In-Memory Cache
const cache = {};
const collectionsList = ['users', 'products', 'coupons', 'orders', 'notifications', 'settings'];

function getFilePath(collection) {
  return path.join(DATA_DIR, `${collection}.json`);
}

function readLocal(collection) {
  const filePath = getFilePath(collection);
  if (!fs.existsSync(filePath)) {
    return [];
  }
  try {
    const data = fs.readFileSync(filePath, 'utf8');
    return JSON.parse(data || '[]');
  } catch (err) {
    console.error(`Error reading local collection ${collection}:`, err);
    return [];
  }
}

function writeLocal(collection, data) {
  const filePath = getFilePath(collection);
  try {
    fs.writeFileSync(filePath, JSON.stringify(data, null, 2), 'utf8');
    return true;
  } catch (err) {
    console.error(`Error writing local collection ${collection}:`, err);
    return false;
  }
}

// 1. Initializing memory cache synchronously with local JSON files for instant local dev
collectionsList.forEach(col => {
  cache[col] = readLocal(col);
});

// 2. Connect to MongoDB if MONGODB_URI is provided
let db = null;
const MONGODB_URI = process.env.MONGODB_URI;

if (MONGODB_URI) {
  console.log('MongoDB URI detected! Establishing connection...');
  MongoClient.connect(MONGODB_URI)
    .then(async (client) => {
      const dbName = MONGODB_URI.split('/').pop().split('?')[0] || 'gayaji-traders';
      db = client.db(dbName);
      console.log(`Successfully connected to MongoDB Database: ${dbName}`);

      // Sync MongoDB collections to Cache
      for (const col of collectionsList) {
        try {
          const mongoItems = await db.collection(col).find({}).toArray();
          if (mongoItems.length > 0) {
            cache[col] = mongoItems;
            console.log(`Loaded ${mongoItems.length} records for '${col}' from MongoDB.`);
          } else {
            // MongoDB is empty, seed it with the current cache (from local JSON files)
            if (cache[col] && cache[col].length > 0) {
              console.log(`MongoDB collection '${col}' is empty. Seeding with ${cache[col].length} items from local seed data...`);
              await db.collection(col).insertMany(cache[col]);
            }
          }
        } catch (err) {
          console.error(`Error syncing MongoDB collection '${col}':`, err);
        }
      }
      console.log('MongoDB database initialization and synchronization complete.');
    })
    .catch(err => {
      console.error('Failed to connect to MongoDB. Defaulting to local JSON file database.', err);
    });
} else {
  console.log('No MONGODB_URI provided in environment. Running on local JSON file database.');
}

// 3. Helper to persist updates asynchronously
function persist(collection) {
  // Always update local files in background
  setTimeout(() => {
    writeLocal(collection, cache[collection]);
  }, 0);

  // If MongoDB is connected, update it in background
  if (db) {
    setTimeout(async () => {
      try {
        await db.collection(collection).deleteMany({});
        if (cache[collection] && cache[collection].length > 0) {
          await db.collection(collection).insertMany(cache[collection]);
        }
      } catch (err) {
        console.error(`Error persisting collection '${collection}' to MongoDB:`, err);
      }
    }, 0);
  }
}

const localDb = {
  find(collection, query = {}) {
    const items = cache[collection] || [];
    return items.filter(item => {
      for (const key in query) {
        if (item[key] !== query[key]) return false;
      }
      return true;
    });
  },

  findOne(collection, query = {}) {
    const items = cache[collection] || [];
    return items.find(item => {
      for (const key in query) {
        if (item[key] !== query[key]) return false;
      }
      return true;
    }) || null;
  },

  insert(collection, doc) {
    if (!cache[collection]) {
      cache[collection] = [];
    }
    const newDoc = {
      _id: Date.now().toString() + Math.random().toString(36).substring(2, 7),
      createdAt: new Date().toISOString(),
      ...doc
    };
    cache[collection].push(newDoc);
    persist(collection);
    return newDoc;
  },

  update(collection, query, updateObj) {
    const items = cache[collection] || [];
    let updatedCount = 0;
    cache[collection] = items.map(item => {
      let matches = true;
      for (const key in query) {
        if (item[key] !== query[key]) {
          matches = false;
          break;
        }
      }
      if (matches) {
        updatedCount++;
        return { ...item, ...updateObj, updatedAt: new Date().toISOString() };
      }
      return item;
    });
    if (updatedCount > 0) {
      persist(collection);
    }
    return updatedCount;
  },

  delete(collection, query) {
    const items = cache[collection] || [];
    let deletedCount = 0;
    cache[collection] = items.filter(item => {
      let matches = true;
      for (const key in query) {
        if (item[key] !== query[key]) {
          matches = false;
          break;
        }
      }
      if (matches) {
        deletedCount++;
        return false;
      }
      return true;
    });
    if (deletedCount > 0) {
      persist(collection);
    }
    return deletedCount;
  }
};

module.exports = localDb;
