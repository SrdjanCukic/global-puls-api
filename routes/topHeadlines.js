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

const formatDate = (dateString) => {
  const date = new Date(dateString);

  // Check if the date is valid
  if (isNaN(date)) {
    return "Invalid Date";
  }

  const options = { year: "numeric", month: "long", day: "numeric" };
  return date.toLocaleDateString("en-US", options);
};

// Normalize the article data to a uniform structure
const normalizeArticleData = (apiResponse, source) => {
  const normalizedData = {
    title:
      apiResponse.headline?.main || apiResponse.title || "No Title Available",
    content:
      apiResponse.abstract ||
      apiResponse.content ||
      apiResponse.description ||
      "No Content Available",
    author:
      apiResponse.byline?.original ||
      apiResponse.author ||
      apiResponse.author_name ||
      "Unknown Author",
    link:
      apiResponse.url ||
      apiResponse.web_url ||
      apiResponse.link ||
      "There is no link",
    image: null,
    date: formatDate(
      apiResponse.published_date ||
        apiResponse.publishedAt ||
        apiResponse.pub_date ||
        apiResponse.date ||
        "Unknown Date"
    ),
    source: apiResponse.source?.name || apiResponse.source || source || null,
  };

  // Handle image URL
  if (apiResponse.urlToImage) {
    normalizedData.image = apiResponse.urlToImage;
  } else if (apiResponse.image) {
    normalizedData.image = apiResponse.image;
  } else if (apiResponse.multimedia && apiResponse.multimedia.length > 0) {
    const mediaUrl = apiResponse.multimedia[0]?.url;
    if (mediaUrl) {
      normalizedData.image = mediaUrl.startsWith("https://static01.nyt.com/")
        ? mediaUrl
        : `https://static01.nyt.com/${mediaUrl}`;
    }
  }

  return normalizedData;
};

// Process the articles by filtering and limiting to the first 4 valid ones
const processArticles = (articles) => {
  return (
    articles
      ?.filter(
        (item) => item.content && item.content !== "[Removed]" && item.link
      )
      ?.slice(0, 4) || []
  );
};

topHeadlines.get("/", cache("10 minutes"), async (req, res) => {
  if (!req.headers.origin || !SUPPORTED_ORIGINS.includes(req.headers.origin)) {
    return res
      .status(400)
      .json({ error: "Unsupported origin: " + req.headers.origin });
  }

  try {
    // Fetch NYT Data
    const nytParams = new URLSearchParams({
      [NYT_API_NAME]: NYT_API_KEY,
    });
    const nytUrl = `${NYT_API_URL}?${nytParams}`;
    const nytResponse = await needle("get", nytUrl);
    const nytData = nytResponse.body;

    // Fetch GNews Data
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

    // Fetch NewsAPI Data
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

    // Normalize data for each source
    const normalizedNYTData = nytData.results
      ? nytData.results.map((article) => normalizeArticleData(article, "NYT"))
      : [];
    const normalizedGNewsData = gnewsData.articles
      ? gnewsData.articles.map((article) =>
          normalizeArticleData(article, "GNews")
        )
      : [];
    const normalizedNewsApiData = newsapiData.articles
      ? newsapiData.articles.map((article) =>
          normalizeArticleData(article, "NewsAPI")
        )
      : [];

    // Process the articles
    const processedDataNyTimes = processArticles(normalizedNYTData);
    const processedDataNewsApi = processArticles(normalizedNewsApiData);
    const processedDataGNewsApi = processArticles(normalizedGNewsData);

    const removeDuplicatesByLink = (articles) => {
      return articles.reduce((acc, article) => {
        if (!acc.some((unique) => unique.link === article.link)) {
          acc.push(article);
        }
        return acc;
      }, []);
    };

    const uniqueNYTData = removeDuplicatesByLink(processedDataNyTimes);
    const uniqueNewsApiData = removeDuplicatesByLink(processedDataNewsApi);
    const uniqueGNewsApiData = removeDuplicatesByLink(processedDataGNewsApi);

    // Send each source's processed data separately in the response
    res.status(200).json({
      nyt: uniqueNYTData,
      gnews: uniqueGNewsApiData,
      newsapi: uniqueNewsApiData,
    });
  } catch (error) {
    if (!res.headersSent) {
      res.status(500).json({ error: error.message });
    }
  }
});

export default topHeadlines;
