import express from "express";
import needle from "needle";
import "dotenv/config";
import apicache from "apicache";

const topHeadlines = express.Router();

const NYT_API_URL = process.env.NYT_API_URL;
const NYT_API_NAME = process.env.NYT_API_NAME;
const NYT_API_KEY = process.env.NYT_API_KEY;

const NEWSAPI_URL = process.env.NEWSAPI_URL;
const NEWSAPI_KEY = process.env.NEWSAPI_KEY;

const GNEWS_API_URL = process.env.GNEWS_API_URL;
const GNEWS_API_KEY = process.env.GNEWS_API_KEY;

const SUPPORTED_ORIGINS = process.env.SUPPORTED_ORIGINS;

let cache = apicache.middleware;

topHeadlines.get("/", cache("10 minutes"), async (req, res) => {
  if (!req.hostname || !SUPPORTED_ORIGINS.includes(req.hostname)) {
    return res.status(400).json({ error: "Unsupported origin" });
  }
  try {
    const nytParams = new URLSearchParams({
      [NYT_API_NAME]: NYT_API_KEY,
    });
    const nytUrl = `${NYT_API_URL}?${nytParams}`;
    const nytResponse = await needle("get", nytUrl);
    const nytData = nytResponse.body;

    const gnewsParams = new URLSearchParams({
      category: "general",
      lang: "en",
      country: "us",
      max: "10",
      apikey: GNEWS_API_KEY,
    });
    const gnewsUrl = `${GNEWS_API_URL}?${gnewsParams}`;
    const gnewsResponse = await needle("get", gnewsUrl);
    const gnewsData = gnewsResponse.body;

    const newsapiParams = new URLSearchParams({
      country: "us",
      apiKey: NEWSAPI_KEY,
    });
    const newsapiUrl = `${NEWSAPI_URL}?${newsapiParams}`;
    const newsapiResponse = await needle("get", newsapiUrl);
    const newsapiData = newsapiResponse.body;

    if (nytResponse.statusCode !== 200) throw new Error("NYT API call failed");
    if (gnewsResponse.statusCode !== 200)
      throw new Error("GNews API call failed");
    if (newsapiResponse.statusCode !== 200)
      throw new Error("NewsAPI API call failed");

    res.status(200).json({
      nyt: nytData,
      gnews: gnewsData,
      newsapi: newsapiData,
    });
  } catch (error) {
    if (!res.headersSent) {
      res.status(500).json({ error: error.message });
    }
  }
});

export default topHeadlines;
