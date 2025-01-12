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
  const sources = req.query.sources?.split(",") || [
    "New York Times",
    "News Api",
    "Gnews",
  ];

  if (!req.headers.origin || !SUPPORTED_ORIGINS.includes(req.headers.origin)) {
    return res
      .status(400)
      .json({ error: "Unsupported origin: " + req.headers.origin });
  }

  if (!keyword && !sources) {
    return res.status(400).json({ error: "Keyword and source is required" });
  }

  const formatDate = (dateString) => {
    const date = new Date(dateString);

    // Check if the date is valid
    if (isNaN(date)) {
      return "Invalid Date";
    }

    const options = { year: "numeric", month: "long", day: "numeric" };
    return date.toLocaleDateString("en-US", options);
  };

  // Function to normalize the article data
  const formatedDataArticles = (article, source) => {
    const formatedData = {
      title: article.headline?.main || article.title || "No Title Available",
      content:
        article.abstract ||
        article.content ||
        article.description ||
        "No Content Available",
      author:
        article.byline?.original ||
        article.author ||
        article.author_name ||
        "Unknown Author",
      link:
        article.url || article.web_url || article.link || "There is no link",
      image:
        article.urlToImage ||
        article.image ||
        (article.multimedia && article.multimedia[0]?.url) ||
        null,
      date: formatDate(
        article.published_date ||
          article.publishedAt ||
          article.pub_date ||
          article.date ||
          "Unknown Date"
      ),
      source: source || "Unknown Source",
    };

    // Handle image URL specific logic
    if (article.urlToImage) {
      formatedData.image = article.urlToImage;
    } else if (article.image) {
      formatedData.image = article.image;
    } else if (article.multimedia && article.multimedia.length > 0) {
      const mediaUrl = article.multimedia[0]?.url;
      if (mediaUrl) {
        formatedData.image = mediaUrl.startsWith("https://static01.nyt.com/")
          ? mediaUrl
          : `https://static01.nyt.com/${mediaUrl}`;
      }
    }

    return formatedData;
  };

  try {
    // Conditional fetching for each source
    const fetchNYT = sources.includes("New York Times")
      ? needle(
          "get",
          `${NYT_API_SEARCH_URL}?q=${keyword}&api-key=${NYT_API_KEY}`
        )
      : Promise.resolve({ body: { response: { docs: [] } } });

    const fetchNewsAPI = sources.includes("News Api")
      ? needle(
          "get",
          `${NEWSAPI_SEARCH_URL}?q=${keyword}&apiKey=${NEWSAPI_KEY}`
        )
      : Promise.resolve({ body: { articles: [] } });

    const fetchGNews = sources.includes("Gnews")
      ? needle(
          "get",
          `${GNEWS_API_SEARCH_URL}?q=${keyword}&lang=en&country=us&max=10&apikey=${GNEWS_API_KEY}`
        )
      : Promise.resolve({ body: { articles: [] } });

    // Fetch data from all selected sources in parallel
    const [nytResponse, newsapiResponse, gnewsResponse] = await Promise.all([
      fetchNYT,
      fetchNewsAPI,
      fetchGNews,
    ]);

    // Extract and normalize the articles
    const nytData =
      nytResponse.body?.response?.docs?.map((article) =>
        formatedDataArticles(article, "NYT")
      ) || [];
    const newsapiData =
      newsapiResponse.body?.articles?.map((article) =>
        formatedDataArticles(article, "NewsAPI")
      ) || [];
    const gnewsData =
      gnewsResponse.body?.articles?.map((article) =>
        formatedDataArticles(article, "GNews")
      ) || [];

    // Combine all articles into one unified array and filter out the duplicates by 'link'
    const allArticles = [...nytData, ...newsapiData, ...gnewsData]
      .filter((article) => article.content !== "[Removed]") // Filter out unwanted content
      .reduce((uniqueArticles, article) => {
        if (!uniqueArticles.some((unique) => unique.link === article.link)) {
          uniqueArticles.push(article);
        }
        return uniqueArticles;
      }, []);

    // Return all unique articles together in a unified response
    res.status(200).json({ articles: allArticles });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

export default keywordSearchRouter;
