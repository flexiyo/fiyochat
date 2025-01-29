import dotenv from "dotenv";
import { server } from "./app.js";
import { connectToMongoServer } from "./db/index.js";

dotenv.config();

const PORT = process.env.PORT || 8000;

connectToMongoServer()
  .then(() => {
    server.listen(PORT, () => {
      console.log(`⚙️ Server is running on port ${PORT}`);
    });

    server.on("error", (error) => {
      console.error("Server failed to listen :: ", error);
      throw error;
    });
  })
  .catch((error) => {
    console.error("Error connecting to MongoDB:", error);
  });
