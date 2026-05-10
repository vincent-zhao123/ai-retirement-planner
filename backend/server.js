const express = require("express");
const cors = require("cors");
require("dotenv").config({ override: true });
console.log("Loaded key ending:", process.env.OPENAI_API_KEY?.slice(-4));

const analyzeRetirementRoute = require("./routes/analyzeRetirement");

const app = express();

app.use(cors());
app.use(express.json());

app.get("/", (req, res) => {
  res.send("AI Retirement Planner backend is running");
});

app.use("/api/analyze-retirement", analyzeRetirementRoute);

const PORT = process.env.PORT || 5001;

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});