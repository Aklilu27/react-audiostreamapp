import express from "express";
import cors from "cors";

import authRoute from "./routes/auth"; 

const app = express();
app.use(express.json());
app.use(cors());

const PORT = process.env.PORT || 5000;


app.use("/auth", authRoute);

app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});
