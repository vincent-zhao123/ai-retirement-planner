import { useState } from "react";
import axios from "axios";
import "./App.css";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from "recharts";

function App() {
  const [formData, setFormData] = useState({
    currentAge: 30,
    yearsToRetire: 35,
    yearsToPlan: 50,

    incomeAnnual: 100000,
    expensesAnnual: 50000,
    inflationRate: 2,

    rrspInitialBalance: 50000,
    rrspContribute: 10000,
    rrspRoi: 6,

    tfsaInitialBalance: 30000,
    tfsaContribute: 6000,
    tfsaRoi: 5,

    nonRegisteredInitialBalance: 20000,
    nonRegisteredRoi: 4,
  });

  const [mode, setMode] = useState("solve_years");
  const [loading, setLoading] = useState(false);

  const [result, setResult] = useState(null);

  const hiddenFieldsByMode = {
    solve_years: ["yearsToPlan"],
    solve_expenses: ["expensesAnnual"],
    solve_retirement: ["yearsToRetire"],
  };

  const hiddenFields = hiddenFieldsByMode[mode] || [];

  const handleChange = (e) => {
    setFormData({
      ...formData,
      [e.target.name]: Number(e.target.value),
    });
  };

  const handleSubmit = async () => {
    try {
      setLoading(true);

      const response = await axios.post(
        `${import.meta.env.VITE_API_URL}/api/analyze-retirement`,
        {
          ...formData,
          mode,
        }
      );
      setResult(response.data);
    } catch (error) {
      console.error(error);
      alert("Failed to analyze retirement plan");
    } finally {
      setLoading(false);
    }
  };

  const handleDownloadExcel = async () => {
    try {
      const response = await axios.post(
        `${import.meta.env.VITE_API_URL}/api/analyze-retirement/excel`,
        { results: result.results },
        {
          responseType: "blob",
        }
      );
  
      const url = window.URL.createObjectURL(
        new Blob([response.data])
      );
  
      const link = document.createElement("a");
  
      link.href = url;
  
      link.setAttribute(
        "download",
        "retirement_projection.xlsx"
      );
  
      document.body.appendChild(link);
  
      link.click();
  
      link.remove();
    } catch (error) {
      console.error(error);
  
      alert("Failed to download Excel");
    }
  };

  return (
    <div className="app-container">
      <div className="header">
        <h1>AI Retirement Planner</h1>
        <p>Plan retirement scenarios with AI-powered financial analysis.</p>
      </div>

      <div className="mode-buttons">
        <button
          className={mode === "solve_years" ? "active" : ""}
          onClick={() => setMode("solve_years")}
        >
          Asset Duration
        </button>

        <button
          className={mode === "solve_expenses" ? "active" : ""}
          onClick={() => setMode("solve_expenses")}
        >
          Max Expenses
        </button>

        <button
          className={mode === "solve_retirement" ? "active" : ""}
          onClick={() => setMode("solve_retirement")}
        >
          Retirement Time
        </button>
      </div>

      <div className="form-card">
        <div className="form-grid">
        {Object.keys(formData).map((key) => (
          <div
          key={key}
          className={`input-group ${
            hiddenFields.includes(key)
              ? "disabled"
              : ""
          }`}
        >
          <p>{key}</p>
            <input
              type="number"
              name={key}
              value={
                hiddenFields.includes(key)
                  ? ""
                  : formData[key]
              }
              onChange={handleChange}
              disabled={hiddenFields.includes(key)}
            />
          </div>
        ))}
        
      </div>

      <button
        className="primary-button"
        onClick={handleSubmit}
      >
        {loading ? "Analyzing..." : "Analyze Retirement Plan"}
      </button> </div>

      {result && (
        <div>
          <div className="chart-card">
            <h2>Total Assets Projection</h2>

            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={result.results}>
                <CartesianGrid strokeDasharray="3 3" />

                <XAxis dataKey="age" />

                <YAxis width={120} />

                <Tooltip />

                <Legend />

                <Line
                  type="monotone"
                  dataKey="totalAssets"
                  stroke="#8884d8"
                  strokeWidth={3}
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
          
          <div className="chart-card">
            <h2>Account Breakdown</h2>

            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={result.results}>
                <CartesianGrid strokeDasharray="3 3" />

                <XAxis dataKey="age" />

                <YAxis width={120}/>

                <Tooltip />

                <Legend />

                <Line
                  type="monotone"
                  dataKey="rrspBalance"
                  stroke="#8884d8"
                />

                <Line
                  type="monotone"
                  dataKey="tfsaBalance"
                  stroke="#82ca9d"
                />

                <Line
                  type="monotone"
                  dataKey="nonRegisteredBalance"
                  stroke="#ff7300"
                />
              </LineChart>
            </ResponsiveContainer>
          </div>

          <div className="result-card">

          <button
            className="download-button"
            onClick={handleDownloadExcel}
          >
            Download Excel Report
          </button>

          {result.solvedValue && (
            <div className="calculated-box">
              <h3>Calculated Result</h3>

              {result.solvedValue.type === "asset_duration" && (
                <p>
                  Assets last for {result.solvedValue.yearsLasted} years. Depletion age:{" "}
                  {result.solvedValue.depletionAge}
                </p>
              )}

              {result.solvedValue.type === "max_expenses" && (
                <p>
                  Maximum sustainable annual expenses: $
                  {Number(result.solvedValue.maxExpenses).toLocaleString()}
                </p>
              )}
              {result.solvedValue.type === "retirement_time" && (
                <p>
                  Earliest retirement time:{" "}
                  {result.solvedValue.yearsToRetire} years from now.
                  Retirement age: {result.solvedValue.retirementAge}
                </p>
              )}
            </div>
          )}

          <div>
            <p>
              <strong>Summary:</strong>{" "}
              {result.aiAnalysis.summary}
            </p>

            <p>
              <strong>Risk Level:</strong>{" "}
              {result.aiAnalysis.riskLevel}
            </p>

            <p>
              <strong>Asset Depletion Age:</strong>{" "}
              {result.aiAnalysis.assetDepletionAge}
            </p>

            <h3>Key Findings</h3>

            <ul>
              {result.aiAnalysis.keyFindings?.map(
                (item, index) => (
                  <li key={index}>{item}</li>
                )
              )}
            </ul>

            <h3>Recommendations</h3>

            <ul>
              {result.aiAnalysis.recommendations?.map(
                (item, index) => (
                  <li key={index}>{item}</li>
                )
              )}
            </ul>
          </div>
        </div>
        </div>
      )}
    </div>
  );
}

export default App;