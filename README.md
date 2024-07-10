**App Store**
*app_store_scraper_server.py*
- Flask server with a single endpoint to retrieve an app's store listing privacy information on the app store, given a URL

*targeting_children.js*
- Checks whether an application is targeting children or not, based on app title, description, and front page of reviews
- Requires *exceljs* and *app-store-scraper*

*app_store_scraper*
- Uses *app-store-scraper* by Facundo Olano and the developed *app_store_scraper_server.py* to fetch App Store app information

*app_store_scraper_from_gplay*
- Uses *app-store-scraper* by Facundo Olano and the developed *app_store_scraper_server.py* to find matching applications on the App Store, from those identified on the Play Store


trafilatura_extractor.py
- Script used to retrieve privacy policy (PP) text given a PP URL

spacy_tokenization.py
- Script used to extract relevant paragraphs from PP texts for every data type category

data.xlsx
- Data bank of scraped applications used for various purposes

