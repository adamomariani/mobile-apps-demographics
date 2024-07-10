from trafilatura import fetch_url, extract
import json
import pandas as pd

from spacy_tokenization import spacy_nlp

######################################################################
###Simple script using Trafilatura to fetch privacy policy contents###
###given an Excel column with PP urls to retrieve & one to write to###
######################################################################

EXCEL_PATH = 'data.xlsx'
SHEET_NAME = 'google'
PP_URL_COLUMN = 'privacyPolicyUrl' #Title of privacy policy url column
PP_TEXT_COLUMN = 'privacyPolicyText' #Title of privacy policy text column


def retrieve_all_texts():
    df = pd.read_excel(EXCEL_PATH, sheet_name=SHEET_NAME)

    # Ensure columns exist
    if PP_TEXT_COLUMN not in df.columns or PP_URL_COLUMN not in df.columns:
        print("Required columns are missing in the Excel sheet.")
        return
    
    df[PP_TEXT_COLUMN] = ""
    
    success = 0
    attempts = 0
    
    for index, row in df.iterrows():
        url = row[PP_URL_COLUMN]

        if pd.notna(url):
            attempts += 1
            try:
                downloaded = fetch_url(url)
#                print(f"DOWNLOADED {downloaded}")
                if downloaded:
                    result = extract(downloaded, output_format="json", include_comments=False)
                    if result:
                        extracted = json.loads(result)["raw_text"]
                        print(f"Extracted: {extracted}")
                        df.at[index, PP_TEXT_COLUMN] = extracted
                        success += 1
                        
            except Exception as e:
                print(f"An error occurred at index {index}")
                continue
                
        if attempts % 50 == 0:
            print(f"Scraeped [{success}/{attempts}] policies")
    
    #Save the updated DataFrame back to the Excel file
    try:
        df.to_excel(EXCEL_PATH, sheet_name=SHEET_NAME, index=False)
    except Exception as e:
        print(f"An error occurred while saving the Excel file: {e}")         
                    
    
retrieve_all_texts()