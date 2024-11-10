import express from "express";
import cors from "cors";
import "dotenv/config";
import topHeadlines from "./routes/topHeadlines.js";
import keywordSearchRouter from "./routes/keywordSearch.js";
import { rateLimit } from "express-rate-limit";

const PORT = process.env.PORT || 3000;

const app = express();

const limiter = rateLimit({
  windowMs: 10 * 60 * 1000,
  max: 100,
});

app.use(limiter);
app.set("trust proxy", 1);

app.use(cors());
app.use(express.json());

app.use(express.static("public"));

app.use("/api", topHeadlines);
app.use("/keyword", keywordSearchRouter);

app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
