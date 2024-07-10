*Note: Currently working on bash script to automate the process without the use of an Excel databank or running different scripts*

**Generic**

1. *test_openai_gpt_model.js*
   * Script to communicate with OpenAI's GPT model. The script retrieves relevant information from the Excel file provided, and using the given system message, it will prompt the indicated GPT model for an answer
  
2. *data.xlsx*
   * Data bank of scraped applications used for various purposes

3. *levenshtein_distance.js*
   * Script used to calculate Levenshtein distance and ratio between app titles and app descriptions

**App Store**

1. *app_store_scraper_server.py*
   * Flask server with a single endpoint to retrieve an app's store listing privacy information on the app store, given a URL

2. *targeting_children.js*
   * Checks whether an application is targeting children or not, based on app title, description, and front page of reviews
   * Requires *exceljs* and *app-store-scraper*

3. *app_store_scraper*
   * Uses *app-store-scraper* by Facundo Olano and the developed *app_store_scraper_server.py* to fetch App Store app information

4. *app_store_scraper_from_gplay*
   * Uses *app-store-scraper* by Facundo Olano and the developed *app_store_scraper_server.py* to find matching applications on the App Store from those identified on the Play Store

**Google Play**

1. *gplay_scraper.js*
   * The scraper used to collect app data from Google Play
   * Requires *google-play-scraper*

**Privacy Policy (PP) Parsing**

1. *trafilatura_extractor.py*
   * Script used to retrieve PP text given a PP URL

2. *spacy_tokenization.py*
   * Script used to extract relevant paragraphs from PP texts for every data type category
