# BigQuery Release Hub & Share Assistant

A premium, modern web dashboard built with **Python Flask** and **Vanilla HTML/CSS/JavaScript** that fetches, parses, and formats the live BigQuery XML release notes feed, offering a built-in workspace to edit, format, and share updates on X (Twitter).

---

## ✨ Features

* **Smart XML Parser**: Connects to the live Google Cloud feed, parsing namespaced Atom XML documents.
* **Sub-Entry Splitting**: Splits daily release logs into individual actionable items (e.g., separating a *Feature* from an *Issue* on the same day).
* **Caching & Fallback**: Caches feed entries in-memory for 10 minutes to minimize network requests. If Google's feed is down, it falls back to the cache and warns the user without crashing.
* **Modern Glassmorphic UI**: Premium dark mode theme with interactive hover effects, live status indicators, and micro-animations.
* **Search & Dynamic Filters**: Instantly filter updates by keywords or category badges (Features, Issues, Changes). Metric cards on the dashboard act as filter buttons.
* **Smart Tweet Assistant**: 
  * Automatically generates a draft update tweet.
  * Calculates character counts and warns you if the draft exceeds 280 characters.
  * **Shortening engine**: Instantly abbreviates common terms (e.g., `Google Cloud` ➔ `GCP`, `generally available` ➔ `GA`, `performance` ➔ `perf`, etc.) to fit the character limit.
  * Share directly to X (Twitter Web Intent) or copy to clipboard with toast notifications.

---

## 📂 Project Structure

```text
bigquery-release-notes-app/
├── app.py                  # Flask Application Backend (Parses feed, manages cache)
├── requirements.txt        # Python Packages (Flask, requests)
├── .gitignore              # Ignored files (venv, pycache, OS files)
├── README.md               # Project Documentation
├── templates/
│   └── index.html          # Web Interface layout & components
└── static/
    ├── css/
    │   └── style.css       # Custom styles, gradients & animations
    └── js/
        └── main.js         # Client state, filtering, & Twitter composer logic
```

---

## 🚀 Getting Started

### Prerequisites
* Python 3.8 or higher
* Git

### Installation

1. Clone or navigate to the repository directory:
   ```bash
   cd C:\Users\amits\agy2-projects\bigquery-release-notes-app
   ```

2. Create a virtual environment:
   ```bash
   python -m venv venv
   ```

3. Activate the virtual environment:
   * **Windows (PowerShell)**:
     ```powershell
     .\venv\Scripts\Activate.ps1
     ```
   * **Windows (Cmd)**:
     ```cmd
     .\venv\Scripts\activate.bat
     ```
   * **macOS/Linux**:
     ```bash
     source venv/bin/activate
     ```

4. Install the required dependencies:
   ```bash
   pip install -r requirements.txt
   ```

---

## 🏃 Running the Application

1. Start the Flask local development server:
   ```bash
   python app.py
   ```

2. Open your web browser and navigate to:
   ```url
   http://127.0.0.1:5000
   ```

---

## 🛠️ Built With

* **Backend**: Python, Flask, requests, xml.etree.ElementTree
* **Frontend**: HTML5, Vanilla CSS3 (Custom Grid/Flex layouts & Glassmorphism), Vanilla JavaScript ES6
* **Social Integration**: Twitter Web Intent URL API
