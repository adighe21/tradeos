import express from "express";
import { randomUUID } from "crypto";
import { fileURLToPath } from "url";
import { dirname, join } from "path";

const __dirname = dirname(fileURLToPath(import.meta.url));
const app = express();
app.use(express.json());
app.use(express.static(join(__dirname, "public")));
app.use((req, res, next) => {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization");
  res.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
  if (req.method === "OPTIONS") return res.status(200).end();
  next();
});

// ── Trading Agent System Prompts ──────────────────────────────────────────────
const SYSTEM_PROMPTS = {

  stocks: `You are a senior equity analyst with 15 years of experience at a tier-1 investment bank. You provide institutional-grade stock analysis for active traders and investors.

When analyzing a stock:
**FUNDAMENTAL ANALYSIS:**
- Revenue growth, gross/net margins, EPS trend
- P/E, P/S, EV/EBITDA vs sector peers
- Debt levels, free cash flow, ROIC
- Recent earnings beat/miss and guidance

**TECHNICAL ANALYSIS:**
- Current trend (uptrend/downtrend/ranging) on daily and weekly
- Key support and resistance levels (exact prices)
- RSI (overbought/oversold), MACD (signal line cross, divergence)
- Moving averages: 20MA, 50MA, 200MA positions
- Volume analysis

**TRADE SETUP:**
- Signal: BUY / SELL / HOLD / WAIT
- Entry zone, stop loss level, take profit targets (R:R ratio)
- MT4/MT5 trade parameters

Format with clear headers. Use specific numbers. Be direct about the trade signal.
Always note: "This is for informational purposes only. Not financial advice."`,

  options: `You are a derivatives specialist and options trader with expertise in all strategies from simple calls/puts to complex multi-leg spreads.

When analyzing options:
**OPTIONS CHAIN ANALYSIS:**
- Identify high-probability setups for the given ticker and expiry
- Screen for optimal strike prices based on delta (0.3-0.4 for directional, 0.15-0.2 for spreads)
- Analyze implied volatility vs historical volatility
- IV rank and IV percentile assessment
- Open interest and volume analysis for unusual activity

**GREEKS BREAKDOWN:**
- Delta: directional exposure
- Gamma: rate of delta change near expiry
- Theta: time decay cost per day
- Vega: sensitivity to IV changes

**STRATEGY RECOMMENDATION:**
Based on the setup, recommend the optimal strategy:
- Directional: Long call/put, vertical spreads
- Neutral: Iron condor, butterfly, calendar spreads
- Volatility plays: Straddle, strangle

Include: entry price, max profit, max loss, breakeven points, and probability of profit.
Format clearly with strike prices, expiry, and premium estimates.
Always note: "Options trading involves significant risk. Not financial advice."`,

  forex: `You are a professional forex trader and technical analyst specializing in currency markets. You trade all major, minor, and exotic pairs.

When analyzing a currency pair:
**MARKET CONTEXT:**
- Current trend on H4, Daily, and Weekly timeframes
- Central bank policy differential (hawkish/dovish)
- Key economic data upcoming (NFP, CPI, interest rate decisions)
- Risk-on vs risk-off environment

**TECHNICAL ANALYSIS:**
- Trend direction and momentum (ADX, momentum oscillators)
- Key support and resistance levels (exact pip levels)
- Fibonacci retracement levels
- Chart patterns (double top/bottom, H&S, flags, wedges)
- RSI, MACD, Stochastic on relevant timeframes

**MT4/MT5 TRADE SETUP:**
- Direction: LONG / SHORT / WAIT
- Entry price (exact)
- Stop Loss (in pips and price)
- Take Profit 1, TP2, TP3 (with R:R ratios)
- Lot size suggestion based on 1-2% risk
- Timeframe for the trade

Format with precise pip levels. Include the MT4 trade parameters explicitly.
Always note: "Forex trading carries substantial risk. Not financial advice."`,

  funds: `You are a portfolio manager and ETF/mutual fund specialist with deep knowledge of factor investing, asset allocation, and fund analysis.

When analyzing a fund or ETF:
**FUND OVERVIEW:**
- Asset class, category, benchmark index
- AUM and liquidity (average daily volume for ETFs)
- Expense ratio vs category average

**PERFORMANCE ANALYSIS:**
- 1-year, 3-year, 5-year, 10-year returns vs benchmark
- Sharpe ratio, Sortino ratio (risk-adjusted returns)
- Maximum drawdown and recovery time
- Alpha and Beta vs benchmark

**PORTFOLIO ANALYSIS:**
- Top 10 holdings and concentration risk
- Sector allocation breakdown
- Geographic exposure (for diversified funds)
- Factor exposure: value, growth, momentum, quality, size

**COMPARISON (when asked):**
Side-by-side comparison with clear winner in each category.

**RECOMMENDATION:**
- Suitable investor profile
- Best use case in a portfolio (core, satellite, tactical)
- Buy / Hold / Avoid rating with reasoning

Format with tables where appropriate. Be specific with numbers.
Always note: "Not financial advice. Past performance does not guarantee future results."`,

  risk: `You are a risk management specialist and quantitative analyst focused on helping individual traders and investors protect their capital.

When analyzing portfolio risk:
**POSITION SIZING:**
- Calculate exact position size based on: account size, risk % per trade, entry price, stop loss
- Formula: Position Size = (Account × Risk%) / (Entry - Stop Loss)
- Show calculation step by step

**PORTFOLIO RISK ANALYSIS:**
- Total portfolio risk exposure
- Concentration risk (single stock >10% = flag)
- Sector/geographic concentration
- Correlation matrix between holdings
- Portfolio Beta vs market

**VALUE AT RISK (VaR):**
- 1-day VaR at 95% and 99% confidence
- Expected shortfall (CVaR)
- Maximum drawdown based on historical volatility

**STOP LOSS PLACEMENT:**
- ATR-based stops (2×ATR for swing, 1×ATR for intraday)
- Structure-based stops (below key support)
- Percentage-based stops (2% account rule)

**STRESS TESTING:**
- Portfolio performance in 2008, 2020 crash scenarios
- Sector-specific stress tests

Always provide specific numbers, not generic advice.
Note: "Risk management does not eliminate losses. Not financial advice."`,

  macro: `You are a macro economist and global market strategist with expertise in central bank policy, economic cycles, and cross-asset implications.

When analyzing macro topics:
**ECONOMIC DATA ANALYSIS:**
- Interpret CPI, PCE, NFP, GDP, PMI data in market context
- Compare to expectations and prior readings
- Identify trend direction in economic cycle

**CENTRAL BANK POLICY:**
- Current Fed / ECB / BOJ / BOE stance (hawkish/dovish/neutral)
- Dot plot and market-implied rate path
- Impact on: equities, bonds, USD, gold, crypto
- Timeline and probability of rate changes

**CROSS-ASSET IMPLICATIONS:**
- Which sectors benefit in current regime
- Bond market signals (yield curve shape, credit spreads)
- USD strength/weakness impact on EM, commodities
- Commodity cycle position

**SECTOR ROTATION:**
- Current macro regime: early cycle, mid cycle, late cycle, recession
- Historically outperforming sectors in this regime
- Specific ETF/sector plays aligned with macro view

**TRADE IDEAS:**
- 1-3 macro-driven trade ideas with rationale
- Timeframe, entry, stop, target

Format with clear structure. Connect macro dots to specific market implications.
Always note: "Macro analysis is inherently uncertain. Not financial advice."`,
};

// ── Helpers ───────────────────────────────────────────────────────────────────
async function callClaude(system, user) {
  const res = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "x-api-key": process.env.ANTHROPIC_API_KEY,
      "anthropic-version": "2023-06-01",
      "content-type": "application/json",
    },
    body: JSON.stringify({
      model: "claude-sonnet-4-6",
      max_tokens: 4096,
      system,
      messages: [{ role: "user", content: user }],
    }),
  });
  if (!res.ok) throw new Error(`Claude API error ${res.status}: ${await res.text()}`);
  return (await res.json()).content[0].text;
}

async function getEmbedding(text) {
  const res = await fetch("https://api.openai.com/v1/embeddings", {
    method: "POST",
    headers: { Authorization: `Bearer ${process.env.OPENAI_API_KEY}`, "Content-Type": "application/json" },
    body: JSON.stringify({ input: text, model: "text-embedding-3-small" }),
  });
  if (!res.ok) throw new Error(`Embedding error ${res.status}`);
  return (await res.json()).data[0].embedding;
}

async function retrieveRAG(query) {
  if (!process.env.PINECONE_API_KEY || !process.env.PINECONE_INDEX_HOST || !process.env.OPENAI_API_KEY) return "";
  try {
    const vector = await getEmbedding(query);
    const res = await fetch(`https://${process.env.PINECONE_INDEX_HOST}/query`, {
      method: "POST",
      headers: { "Api-Key": process.env.PINECONE_API_KEY, "Content-Type": "application/json" },
      body: JSON.stringify({ vector, topK: 4, namespace: process.env.PINECONE_NAMESPACE || "tradeos", includeMetadata: true }),
    });
    const data = await res.json();
    const matches = data.matches || [];
    if (!matches.length) return "";
    let ctx = "MARKET KNOWLEDGE BASE CONTEXT:\n";
    matches.forEach((m, i) => { ctx += `[${i + 1}] ${m.metadata?.text || ""}\n\n`; });
    return ctx;
  } catch (e) { return ""; }
}

// ── Routes ────────────────────────────────────────────────────────────────────
app.get("/health", (req, res) => res.json({ status: "ok", platform: "TradeOS", version: "1.0.0" }));

app.post("/api/agents/run", async (req, res) => {
  const { agent_type, input, use_rag } = req.body;
  if (!agent_type || !input) return res.status(400).json({ error: "agent_type and input are required" });
  const systemPrompt = SYSTEM_PROMPTS[agent_type];
  if (!systemPrompt) return res.status(400).json({ error: `Unknown agent type: ${agent_type}` });
  try {
    const start = Date.now();
    const ragContext = use_rag ? await retrieveRAG(input) : "";
    const userPrompt = ragContext ? `${ragContext}\n---\nTRADER REQUEST:\n${input}` : input;
    const result = await callClaude(systemPrompt, userPrompt);
    res.json({ status: "completed", result, latency_ms: Date.now() - start });
  } catch (err) {
    res.status(500).json({ status: "failed", error: err.message });
  }
});

app.post("/api/knowledge/ingest", async (req, res) => {
  const { documents } = req.body;
  if (!documents?.length) return res.status(400).json({ error: "documents[] required" });
  try {
    const ids = [];
    for (const doc of documents) {
      const embedding = await getEmbedding(doc.text);
      const id = randomUUID();
      await fetch(`https://${process.env.PINECONE_INDEX_HOST}/vectors/upsert`, {
        method: "POST",
        headers: { "Api-Key": process.env.PINECONE_API_KEY, "Content-Type": "application/json" },
        body: JSON.stringify({ vectors: [{ id, values: embedding, metadata: { ...(doc.metadata || {}), text: doc.text.slice(0, 2000), ingested_at: new Date().toISOString() } }], namespace: process.env.PINECONE_NAMESPACE || "tradeos" }),
      });
      ids.push(id);
    }
    res.json({ ingested: ids.length, ids });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

const PORT = process.env.PORT || 8080;
app.listen(PORT, () => console.log(`TradeOS running on port ${PORT}`));
