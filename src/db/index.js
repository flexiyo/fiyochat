import mongoose from "mongoose";

export const getDatabaseInstance = async (dbName) => {
  try {
    if (!dbName || typeof dbName !== "string") {
      throw new Error("Database name must be a non-empty string.");
    }

    const selectedDb = mongoose.connection.useDb(dbName);

    return selectedDb;
  } catch (error) {
    console.error(`Error selecting database "${dbName}":`, error);
    throw new Error(`Failed to connect to database: ${dbName}`);
  }
};

export const connectToMongoServer = async () => {
  try {
    if (mongoose.connection.readyState === 0) {
      await mongoose.connect(process.env.MONGODB_CHAT_URI, {
        useNewUrlParser: true,
        useUnifiedTopology: true,
      });
      console.log("Database connected successfully");
    }
  } catch (error) {
    console.error("Error connecting to MongoDB server:", error);
    throw new Error("Failed to connect to MongoDB server.");
  }
};
