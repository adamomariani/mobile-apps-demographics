# Repository Overview
This repository contains a collection of scripts for various data scraping and processing tasks. Below is an overview of the scripts and their functionalities, organized by category.

## Note
Currently working on a bash script to automate these processes more efficiently.

## Generic Scripts
Scripts that serve general purposes across different platforms.

### 1. **test_openai_gpt_model.js**
- **Purpose:** Communicates with OpenAI's GPT model to retrieve answers based on input from an Excel file.
- **Dependencies:** `openai`

### 2. **data.xlsx**
- **Purpose:** Data bank containing scraped application data for various uses.

### 3. **levenshtein_distance.js**
- **Purpose:** Calculates the Levenshtein distance and similarity ratio between application titles and descriptions.

## App Store Tools
Scripts specifically designed for scraping and analyzing data from the App Store.

### 1. **app_store_scraper_server.py**
- **Purpose:** Flask server that retrieves privacy information from an app's store listing on the App Store.
- **Dependencies:** `flask`, `selenium`

### 2. **targeting_children.js**
- **Purpose:** Determines whether an application targets children based on its title, description, and reviews.
- **Dependencies:** `app-store-scraper` by Facundo Olano

### 3. **app_store_scraper**
- **Purpose:** Fetch information from the App Store.
- **Dependencies:** `app-store-scraper`, `app_store_scraper_server.py`

### 4. **app_store_scraper_from_gplay**
- **Purpose:** Find matching applications on the App Store using the identified apps on the Play Store.
- **Dependencies:** `app-store-scraper`, `app_store_scraper_server.py`

## Google Play Tools
Scripts for scraping data from Google Play.

### 1. **gplay_scraper.js**
- **Purpose:** Scrapes application data from Google Play.
- **Dependencies:** `google-play-scraper`

## Privacy Policy Parsing
Scripts designed for extracting and processing text from privacy policies.

### 1. **trafilatura_extractor.py**
- **Purpose:** Retrieves the text of a privacy policy from a provided URL.
- **Dependencies:** `trafilatura`

### 2. **spacy_tokenization.py**
- **Purpose:** Extract relevant paragraphs from privacy policy texts according to different data type categories.
- **Dependencies:** `spacy`, `selenium`
