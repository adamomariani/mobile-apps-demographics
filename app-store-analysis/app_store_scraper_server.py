from flask import Flask, request, jsonify
from selenium import webdriver
from selenium.webdriver.common.by import By
from selenium.webdriver.support.ui import WebDriverWait
from selenium.webdriver.support import expected_conditions as EC
from selenium.common.exceptions import NoSuchElementException
import json
import requests
import os

app = Flask(__name__)

def scrape_app_store(app_id, app_name, app_url):
    options = webdriver.ChromeOptions()
    options.add_argument('--headless')
    options.add_argument("window-size=1200x600")
    options.add_argument('--user-agent="Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/58.0.3029.110 Safari/537.36"')
    options.add_experimental_option('excludeSwitches', ['enable-logging'])

    driver = webdriver.Chrome(options=options)
#    driver.execute_script("window.scrollTo(0, document.body.scrollHeight);")  #Scroll down
    
    log("", "--------------------------------------------")
    log("info", "Processing app: " + app_name)
    
    try:
        #Step 1: Load the page
        driver.get(app_url)
        
        #Step 2: Find the privacy section
        privacy_section = WebDriverWait(driver, 10).until(
            EC.presence_of_element_located((By.CSS_SELECTOR, "section.l-content-width.section.section--bordered.app-privacy"))
        )
        
        #Step 3: Click the 'See Details' button
        privacy_modal_button = WebDriverWait(driver, 10).until(EC.element_to_be_clickable((By.CSS_SELECTOR, ".app-privacy--modal.privacy-type--modal button.we-modal__show.link")))
        privacy_modal_button.click()        
        
        #Step 4: Wait for modal to appear
        modal_content = WebDriverWait(driver, 10).until(
            EC.presence_of_element_located((By.CSS_SELECTOR, ".we-modal__content__wrapper"))
        )
        
        #Step 5: Retrieve privacy data
        WebDriverWait(driver, 10).until(
            EC.presence_of_element_located((By.CLASS_NAME, "app-privacy__modal-section"))
        )
        
        privacy_data_sections = modal_content.find_elements(By.CLASS_NAME, "app-privacy__modal-section")
        privacy_data = {}
        privacy_policy_link = ""
        
        if len(privacy_data_sections) > 0:
            #5.1: Privacy policy link
            privacy_policy_paragraph = privacy_data_sections[0].find_element(By.CSS_SELECTOR, "p a")
            privacy_policy_link = privacy_policy_paragraph.get_attribute('href')
            
            #5.2: Skip initial information sections and gather data safety practices
            privacy_data = {}
            for section in privacy_data_sections[2:]:
                header = section.find_element(By.TAG_NAME, "h2").text
                log("info", "Processing section [" + str(header) + "]", 1)
                content = {}
                
                if header == "Data Not Collected":
                    log("info", "Skipping sections since no data collected by app", 1)
                    break;
                
                try:
                    purpose_headings = WebDriverWait(driver, 10).until(
                        EC.presence_of_all_elements_located((By.CLASS_NAME, "privacy-type__purpose-heading"))
                    )
#                    purpose_headings = section.find_elements(By.CLASS_NAME, "privacy-type__purpose-heading")
                    if purpose_headings:
                        for purpose in purpose_headings:
                            log("data", "Current Purpose [" + str(purpose.text) + "]", 2)
                            purpose_text = purpose.text
                            category_content = {}
                            
                            grids = purpose.find_elements(By.XPATH, "./following-sibling::div[contains(@class, 'privacy-type__grid')]")

                            #Filter the grids to only include those before the next purpose heading
                            relevant_grids = []
                            for grid in grids:
                                #Check if the next sibling of type heading is another purpose heading
                                next_heading = grid.find_elements(By.XPATH, "./following-sibling::*[1][contains(@class, 'privacy-type__purpose-heading')]")
                                if not next_heading:
                                    relevant_grids.append(grid)
                                else:
                                    relevant_grids.append(grid)
                                    break  #Stop adding grids once a new purpose heading is encountered

                            for grid in relevant_grids:
                                data_category = grid.find_element(By.CLASS_NAME, "privacy-type__data-category-heading").text
                                log("data", "Data Category [" + str(data_category) + "]", 3)
                                items = [item.text for item in grid.find_elements(By.TAG_NAME, "li")]
                                for item in items:
                                    log("data", "Item [" + str(item) + "]", 4)
                                category_content[data_category] = items

                            content[purpose_text] = category_content
                    else:
                        raise NoSuchElementException("Purpose Not Found")
                except NoSuchElementException:
                    log("info", "Processing section without purpose...", 2)
                    for privacy_grid in section.find_elements(By.CLASS_NAME, "privacy-type__grid"):
                        grid_content = privacy_grid.find_element(By.CLASS_NAME, "privacy-type__grid-content")

                        grid_heading = grid_content.find_element(By.CLASS_NAME, "privacy-type__data-category-heading").text

                        grid_items = [item.text for item in grid_content.find_elements(By.TAG_NAME, "li")]
                        
                        content[grid_heading] = grid_items
                    log("info", "...processed.", 2)
                privacy_data[header] = content
        else:
            filename = app_id + '.png'
            driver.save_screenshot('screenshots/' + filename)
            log("error", "No privacy sections were found in the modal. Screenshot saved at [screenshots/" + filename + "]", 1)
        
        
        #Step 5: Return JSON data
        result = {
            "privacyPolicyUrl": privacy_policy_link,
            "privacyData": privacy_data
        }
        
        return result
    except NoSuchElementException as e:
        filename = app_name + '.png'
        driver.save_screenshot('screenshots/' + filename)
        log("error", "Not able to locate an HTML element.\n\tScreenshot saved at [screenshots/" + filename + "]\n\tEncountered exception: " + str(e), 1)
        
        if privacy_policy_link:
            result = {
                "privacyPolicyUrl": privacy_policy_link,
                "privacyData": "UNDISCLOSED"
            }
            return result
    finally:
        driver.quit()

def log(tag, message, depth = 0):
    with open("output.log", "a") as log_file:
        for i in range(depth):
            log_file.write("\t")
        if len(tag) > 0:
            log_file.write(tag.upper() + ": " + message + "\n")
        else:
            log_file.write(message + "\n")
        
@app.route('/scrape', methods=['GET'])
def get_app_data():
    app_url = request.args.get('app_url')
    if not app_url:
        return jsonify({'error': 'Missing app_url parameter'}), 400
    
    retries = 2
    app_id = app_url.split('/')[-1]
    app_name = app_url.split('/')[-2]
    result = {}
    
    for i in range(0, retries):
        try:
            result = scrape_app_store(app_id, app_name, app_url)
            log("Success", app_url, 1)
            break;
        except Exception as e:
            if (i + 1) == retries:
                log("error", "App URL Not Followed: " + app_url, 1)
                log("error", str(e), 1)
            else:
                log("error", "Failed fetch, trying again for: " + app_name, 1)
        
    return jsonify(result), 200

if __name__ == '__main__':
    app.run(debug=True, port=4242)
    