import os
import re
import xml.etree.ElementTree as ET
import time
import html as html_lib
import requests
from flask import Flask, jsonify, render_template, request

app = Flask(__name__)

# Cache configuration
FEED_URL = "https://docs.cloud.google.com/feeds/bigquery-release-notes.xml"
cache = {
    "data": None,
    "last_updated": 0
}
CACHE_DURATION = 600  # 10 minutes cache in seconds

def clean_html_to_text(html_content):
    """Converts HTML content to clean, readable text suitable for social sharing."""
    if not html_content:
        return ""
    
    # Pre-process headers and paragraphs to preserve spacing
    text = html_content
    text = re.sub(r'</p>', '\n\n', text)
    text = re.sub(r'</li>', '\n', text)
    text = re.sub(r'</h\d>', '\n\n', text)
    text = re.sub(r'<br\s*/?>', '\n', text)
    
    # Remove all HTML tags
    text = re.sub(r'<[^>]+>', '', text)
    
    # Unescape HTML entities (e.g., &amp; -> &, &quot; -> ")
    text = html_lib.unescape(text)
    
    # Clean up whitespace
    lines = [line.strip() for line in text.split('\n')]
    text = '\n'.join([l for l in lines if l])
    
    return text.strip()

def parse_updates(html_content, date_text, link_href):
    """Splits an entry's HTML content by <h3> tags to extract individual updates."""
    # We split using <h3>...</h3> headers to extract types like 'Feature', 'Issue', 'Change', etc.
    parts = re.split(r'(?i)<h3>(.*?)</h3>', html_content)
    updates = []
    
    # If there are split parts, index 1, 3, 5... will be the headers, and 2, 4, 6... will be the bodies.
    if len(parts) > 1:
        for i in range(1, len(parts), 2):
            update_type = parts[i].strip()
            body_html = parts[i+1].strip() if i+1 < len(parts) else ""
            
            clean_text = clean_html_to_text(body_html)
            
            # Create a unique ID for this specific update
            update_id = f"{date_text.lower().replace(' ', '_').replace(',', '')}_{i}"
            
            updates.append({
                "id": update_id,
                "type": update_type,
                "html": body_html,
                "text": clean_text,
                "date": date_text,
                "link": link_href
            })
    else:
        # Fallback if no <h3> headers exist
        clean_text = clean_html_to_text(html_content)
        update_id = f"{date_text.lower().replace(' ', '_').replace(',', '')}_0"
        updates.append({
            "id": update_id,
            "type": "Update",
            "html": html_content,
            "text": clean_text,
            "date": date_text,
            "link": link_href
        })
        
    return updates

def fetch_and_parse_feed():
    """Fetches the XML feed and parses it into structured JSON."""
    headers = {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"
    }
    response = requests.get(FEED_URL, headers=headers, timeout=15)
    response.raise_for_status()
    
    # Parse the Atom feed XML
    root = ET.fromstring(response.content)
    
    # Atom namespace
    ns = {"atom": "http://www.w3.org/2005/Atom"}
    
    parsed_entries = []
    
    for entry_elem in root.findall("atom:entry", ns):
        title_elem = entry_elem.find("atom:title", ns)
        date_text = title_elem.text if title_elem is not None else "Unknown Date"
        
        id_elem = entry_elem.find("atom:id", ns)
        entry_id = id_elem.text if id_elem is not None else ""
        
        updated_elem = entry_elem.find("atom:updated", ns)
        updated_text = updated_elem.text if updated_elem is not None else ""
        
        link_elem = entry_elem.find('atom:link[@rel="alternate"]', ns)
        if link_elem is None:
            link_elem = entry_elem.find('atom:link', ns)
        link_href = link_elem.attrib.get('href', '') if link_elem is not None else ""
        
        content_elem = entry_elem.find("atom:content", ns)
        content_html = content_elem.text if content_elem is not None else ""
        
        # Parse individual updates within this entry
        updates = parse_updates(content_html, date_text, link_href)
        
        parsed_entries.append({
            "date": date_text,
            "id": entry_id,
            "updated": updated_text,
            "link": link_href,
            "updates": updates
        })
        
    return parsed_entries

@app.route("/")
def index():
    return render_template("index.html")

@app.route("/api/release-notes")
def get_release_notes():
    force_refresh = request.args.get("refresh", "false").lower() == "true"
    current_time = time.time()
    
    # Use cached data if available and not expired/forced refresh
    if (not force_refresh and 
        cache["data"] is not None and 
        (current_time - cache["last_updated"] < CACHE_DURATION)):
        return jsonify({
            "status": "success",
            "source": "cache",
            "last_updated": cache["last_updated"],
            "data": cache["data"]
        })
        
    try:
        data = fetch_and_parse_feed()
        cache["data"] = data
        cache["last_updated"] = current_time
        return jsonify({
            "status": "success",
            "source": "live",
            "last_updated": current_time,
            "data": data
        })
    except Exception as e:
        # Fallback to cache if request fails
        if cache["data"] is not None:
            return jsonify({
                "status": "warning",
                "message": f"Failed to fetch live feed: {str(e)}. Returning cached data.",
                "source": "cache_fallback",
                "last_updated": cache["last_updated"],
                "data": cache["data"]
            })
        return jsonify({
            "status": "error",
            "message": f"Failed to fetch and parse release notes: {str(e)}"
        }), 500

if __name__ == "__main__":
    app.run(debug=True, port=5000)
