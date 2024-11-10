import express from "express";
import needle from "needle";
import "dotenv/config";

const keywordSearchRouter = express.Router();

const NYT_API_SEARCH_URL = process.env.NYT_API_SEARCH_URL;
const NYT_API_KEY = process.env.NYT_API_KEY;

const NEWSAPI_SEARCH_URL = process.env.NEWSAPI_SEARCH_URL;
const NEWSAPI_KEY = process.env.NEWSAPI_KEY;

const GNEWS_API_SEARCH_URL = process.env.GNEWS_API_SEARCH_URL;
const GNEWS_API_KEY = process.env.GNEWS_API_KEY;
const SUPPORTED_ORIGINS = process.env.SUPPORTED_ORIGINS;

keywordSearchRouter.get("/", async (req, res) => {
  const keyword = req.query.keyword;
  if (!keyword) {
    return res.status(400).json({ error: "Keyword is required" });
  }

  if (!req.hostname || !SUPPORTED_ORIGINS.includes(req.hostname)) {
    console.log({ hostname });
    return res.status(400).json({ error: "Unsupported origin" });
  }

  try {
    const nytParams = new URLSearchParams({
      q: keyword,
      "api-key": NYT_API_KEY,
    });
    const newsapiParams = new URLSearchParams({
      q: keyword,
      apiKey: NEWSAPI_KEY,
    });
    const gnewsParams = new URLSearchParams({
      q: keyword,
      lang: "en",
      country: "us",
      max: "10",
      apikey: GNEWS_API_KEY,
    });

    const [nytResponse, newsapiResponse, gnewsResponse] = await Promise.all([
      needle("get", `${NYT_API_SEARCH_URL}?${nytParams}`),
      needle("get", `${NEWSAPI_SEARCH_URL}?${newsapiParams}`),
      needle("get", `${GNEWS_API_SEARCH_URL}?${gnewsParams}`),
    ]);

    const nytData = nytResponse.body?.response?.docs || [];
    const newsapiData = newsapiResponse.body?.articles || [];
    const gnewsData = gnewsResponse.body?.articles || [];

    res.status(200).json({
      nyTimes: nytData,
      newsApi: newsapiData,
      gNews: gnewsData,
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

export default keywordSearchRouter;
