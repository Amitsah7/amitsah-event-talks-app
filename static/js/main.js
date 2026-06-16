// ==========================================================================
// BigQuery Release Hub - JavaScript Application Logic
// ==========================================================================

document.addEventListener('DOMContentLoaded', () => {
    // Application State
    const state = {
        entries: [],          // Raw feed entries (grouped by date)
        flatUpdates: [],      // Flat list of individual updates
        filteredUpdates: [],  // Currently matching search & filters
        selectedUpdate: null, // Selected update for composer
        currentFilter: 'all', // active filter (all, feature, issue, change)
        searchQuery: '',      // active search text
        tweetDraft: '',       // active edited tweet draft
        options: {
            includeTags: true,
            includeLink: true
        }
    };

    // DOM Elements
    const refreshBtn = document.getElementById('refresh-btn');
    const refreshIcon = refreshBtn.querySelector('.spinner-icon');
    const lastUpdatedTime = document.getElementById('last-updated-time');
    const statusText = document.getElementById('status-text');
    
    // Stats
    const statTotal = document.getElementById('stat-total');
    const statFeatures = document.getElementById('stat-features');
    const statIssues = document.getElementById('stat-issues');
    const statChanges = document.getElementById('stat-changes');
    const statCards = document.querySelectorAll('.stat-card');
    
    // Filters & Search
    const searchInput = document.getElementById('search-input');
    const clearSearchBtn = document.getElementById('clear-search-btn');
    const filterPills = document.querySelectorAll('.pill');
    
    // Feed viewport states
    const feedLoading = document.getElementById('feed-loading');
    const feedError = document.getElementById('feed-error');
    const feedEmpty = document.getElementById('feed-empty');
    const releaseNotesList = document.getElementById('release-notes-list');
    const errorMessage = document.getElementById('error-message');
    const retryBtn = document.getElementById('retry-btn');
    
    // Composer
    const composerEmpty = document.getElementById('composer-empty-state');
    const composerActive = document.getElementById('composer-active-state');
    const composerType = document.getElementById('composer-update-type');
    const composerDate = document.getElementById('composer-update-date');
    const composerPreview = document.getElementById('composer-update-preview');
    const tweetTextarea = document.getElementById('tweet-textarea');
    const charCounter = document.getElementById('char-counter');
    const charWarning = document.getElementById('char-warning');
    
    // Composer actions
    const formatTagsBtn = document.getElementById('format-tags-btn');
    const formatShortenBtn = document.getElementById('format-shorten-btn');
    const formatLinkBtn = document.getElementById('format-link-btn');
    const resetDraftBtn = document.getElementById('reset-draft-btn');
    const copyDraftBtn = document.getElementById('copy-draft-btn');
    const tweetSubmitBtn = document.getElementById('tweet-submit-btn');
    const toastContainer = document.getElementById('toast-container');

    // Initialize Application
    init();

    function init() {
        fetchReleaseNotes(false);
        setupEventListeners();
    }

    // Event Listeners Setup
    function setupEventListeners() {
        // Refresh feed
        refreshBtn.addEventListener('click', () => fetchReleaseNotes(true));
        retryBtn.addEventListener('click', () => fetchReleaseNotes(true));
        
        // Search inputs
        searchInput.addEventListener('input', (e) => {
            state.searchQuery = e.target.value.toLowerCase().strip();
            clearSearchBtn.style.display = state.searchQuery ? 'block' : 'none';
            applyFilterAndSearch();
        });
        
        clearSearchBtn.addEventListener('click', () => {
            searchInput.value = '';
            state.searchQuery = '';
            clearSearchBtn.style.display = 'none';
            applyFilterAndSearch();
            searchInput.focus();
        });
        
        // Filter pills click
        filterPills.forEach(pill => {
            pill.addEventListener('click', () => {
                setFilter(pill.getAttribute('data-filter'));
            });
        });
        
        // Stat cards click - functions as filters too
        statCards.forEach(card => {
            card.addEventListener('click', () => {
                const targetFilter = card.getAttribute('data-filter');
                setFilter(targetFilter);
                
                // Scroll to search/filter bar for better UX
                document.querySelector('.feed-toolbar').scrollIntoView({ behavior: 'smooth' });
            });
        });
        
        // Tweet composer text changes
        tweetTextarea.addEventListener('input', (e) => {
            state.tweetDraft = e.target.value;
            updateCharCounter();
            updateTweetSubmitUrl();
        });
        
        // Composer Quick Actions
        formatTagsBtn.addEventListener('click', () => {
            state.options.includeTags = !state.options.includeTags;
            toggleButtonActive(formatTagsBtn, state.options.includeTags);
            regenerateDraft();
        });
        
        formatLinkBtn.addEventListener('click', () => {
            state.options.includeLink = !state.options.includeLink;
            toggleButtonActive(formatLinkBtn, state.options.includeLink);
            regenerateDraft();
        });
        
        formatShortenBtn.addEventListener('click', () => {
            shortenTweetDraft();
        });
        
        resetDraftBtn.addEventListener('click', () => {
            state.options.includeTags = true;
            state.options.includeLink = true;
            toggleButtonActive(formatTagsBtn, true);
            toggleButtonActive(formatLinkBtn, true);
            if (state.selectedUpdate) {
                loadUpdateIntoComposer(state.selectedUpdate);
                showToast('Draft reset to original template', 'success');
            }
        });
        
        // Clipboard operations
        copyDraftBtn.addEventListener('click', () => {
            navigator.clipboard.writeText(tweetTextarea.value)
                .then(() => showToast('Tweet copied to clipboard!', 'success'))
                .catch(() => showToast('Failed to copy text', 'error'));
        });
    }

    // Helper to add String.prototype.strip if not available
    if (!String.prototype.strip) {
        String.prototype.strip = function () {
            return this.replace(/^\s+|\s+$/g, '');
        };
    }

    // API: Fetch Release Notes
    function fetchReleaseNotes(forceRefresh = false) {
        setLoadingState(true);
        
        const url = `/api/release-notes${forceRefresh ? '?refresh=true' : ''}`;
        
        fetch(url)
            .then(response => {
                if (!response.ok) {
                    throw new Error(`Server returned HTTP ${response.status}`);
                }
                return response.json();
            })
            .then(res => {
                if (res.status === 'success' || res.status === 'warning') {
                    // Update state
                    state.entries = res.data;
                    
                    // Flatten the list of updates for easier filtering
                    state.flatUpdates = [];
                    state.entries.forEach(entry => {
                        entry.updates.forEach(upd => {
                            state.flatUpdates.push(upd);
                        });
                    });
                    
                    // Update Last synced timestamp
                    const syncDate = new Date(res.last_updated * 1000);
                    lastUpdatedTime.textContent = formatTime(syncDate);
                    
                    statusText.textContent = res.status === 'warning' ? 'Offline Fallback' : 'Connected';
                    if (res.status === 'warning') {
                        showToast(res.message, 'error');
                    } else if (forceRefresh) {
                        showToast('Feed synced successfully!', 'success');
                    }
                    
                    // Render & calculation
                    calculateStats();
                    applyFilterAndSearch();
                } else {
                    throw new Error(res.message || 'Unknown error occurred');
                }
            })
            .catch(err => {
                console.error('Fetch error:', err);
                showErrorState(err.message);
            })
            .finally(() => {
                setLoadingState(false);
            });
    }

    // Update the Filter state
    function setFilter(filterCategory) {
        state.currentFilter = filterCategory;
        
        // Update Filter Pills UI
        filterPills.forEach(p => {
            if (p.getAttribute('data-filter') === filterCategory) {
                p.classList.add('active');
            } else {
                p.classList.remove('active');
            }
        });
        
        // Update Stats active styles
        statCards.forEach(c => {
            if (c.getAttribute('data-filter') === filterCategory) {
                c.classList.add('active-filter');
            } else {
                c.classList.remove('active-filter');
            }
        });
        
        applyFilterAndSearch();
    }

    // Apply Filter & Search and update the Viewport
    function applyFilterAndSearch() {
        const query = state.searchQuery;
        const category = state.currentFilter;
        
        // Filter elements
        state.filteredUpdates = state.flatUpdates.filter(upd => {
            // Category check
            const matchesCategory = 
                category === 'all' || 
                upd.type.toLowerCase() === category || 
                (category === 'change' && !['feature', 'issue'].includes(upd.type.toLowerCase()));
            
            // Search query check
            const matchesSearch = 
                !query || 
                upd.type.toLowerCase().includes(query) || 
                upd.date.toLowerCase().includes(query) || 
                upd.text.toLowerCase().includes(query);
                
            return matchesCategory && matchesSearch;
        });
        
        // Re-group matching updates by date for rendering
        const grouped = groupUpdatesByDate(state.filteredUpdates);
        renderFeed(grouped);
    }

    // Helper: Group Flat updates by Date
    function groupUpdatesByDate(updatesList) {
        const groups = {};
        updatesList.forEach(upd => {
            if (!groups[upd.date]) {
                groups[upd.date] = {
                    date: upd.date,
                    link: upd.link,
                    updates: []
                };
            }
            groups[upd.date].updates.push(upd);
        });
        return Object.values(groups);
    }

    // UI: Render Feed Notes
    function renderFeed(groupedEntries) {
        // Clear old list
        releaseNotesList.innerHTML = '';
        
        if (groupedEntries.length === 0) {
            feedEmpty.style.display = 'flex';
            releaseNotesList.style.display = 'none';
            return;
        }
        
        feedEmpty.style.display = 'none';
        releaseNotesList.style.display = 'flex';
        
        groupedEntries.forEach(group => {
            const dateGroup = document.createElement('div');
            dateGroup.className = 'date-group';
            
            // Header for Date Group
            const dateHeader = document.createElement('div');
            dateHeader.className = 'date-header';
            
            const dateTitle = document.createElement('div');
            dateTitle.className = 'date-title';
            dateTitle.textContent = group.date;
            
            const dateLine = document.createElement('div');
            dateLine.className = 'date-line';
            
            dateHeader.appendChild(dateTitle);
            dateHeader.appendChild(dateLine);
            dateGroup.appendChild(dateHeader);
            
            // Render each individual update under this date
            group.updates.forEach(upd => {
                const updateCard = document.createElement('article');
                updateCard.className = `update-card ${state.selectedUpdate && state.selectedUpdate.id === upd.id ? 'selected' : ''}`;
                updateCard.setAttribute('data-id', upd.id);
                
                const typeClass = upd.type.toLowerCase();
                let semanticClass = 'other';
                if (typeClass.includes('feature')) semanticClass = 'feature';
                else if (typeClass.includes('issue')) semanticClass = 'issue';
                else if (typeClass.includes('change') || typeClass.includes('deprecation')) semanticClass = 'change';
                
                updateCard.innerHTML = `
                    <div class="update-card-header">
                        <span class="type-badge ${semanticClass}">${upd.type}</span>
                        <div class="card-actions">
                            <button class="action-trigger share-trigger" title="Select to Tweet">
                                <svg viewBox="0 0 24 24" width="16" height="16" fill="currentColor">
                                    <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z"/>
                                </svg>
                            </button>
                        </div>
                    </div>
                    <div class="update-description">
                        ${upd.html}
                    </div>
                `;
                
                // Add Click Event to Select Update
                updateCard.addEventListener('click', (e) => {
                    // Avoid selecting multiple or double clicking same
                    document.querySelectorAll('.update-card').forEach(c => c.classList.remove('selected'));
                    updateCard.classList.add('selected');
                    
                    state.selectedUpdate = upd;
                    loadUpdateIntoComposer(upd);
                });
                
                dateGroup.appendChild(updateCard);
            });
            
            releaseNotesList.appendChild(dateGroup);
        });
    }

    // UI: Load selected update details into Composer
    function loadUpdateIntoComposer(update) {
        // Switch composer state UI
        composerEmpty.style.display = 'none';
        composerActive.style.display = 'flex';
        
        // Set context preview
        const typeClass = update.type.toLowerCase();
        let semanticClass = 'other';
        if (typeClass.includes('feature')) semanticClass = 'feature';
        else if (typeClass.includes('issue')) semanticClass = 'issue';
        else if (typeClass.includes('change') || typeClass.includes('deprecation')) semanticClass = 'change';
        
        composerType.textContent = update.type;
        composerType.className = `type-badge ${semanticClass}`;
        composerDate.textContent = update.date;
        composerPreview.textContent = update.text;
        
        // Toggle Quick format buttons active states
        toggleButtonActive(formatTagsBtn, state.options.includeTags);
        toggleButtonActive(formatLinkBtn, state.options.includeLink);
        
        // Generate draft
        state.tweetDraft = generateTweetText(update, state.options.includeTags, state.options.includeLink);
        tweetTextarea.value = state.tweetDraft;
        
        // Update character count and post link
        updateCharCounter();
        updateTweetSubmitUrl();
        
        // Trigger microanimation on composer loaded panel
        composerActive.style.animation = 'none';
        composerActive.offsetHeight; // trigger reflow
        composerActive.style.animation = 'fadeIn 0.3s ease';
    }

    // Logic: Programmatic Tweet draft generator with automatic smart truncation
    function generateTweetText(update, includeTags, includeLink) {
        const titleText = `BigQuery ${update.type} (${update.date}): `;
        const tagsText = includeTags ? "\n\n#BigQuery #GoogleCloud #DataOps" : "";
        const linkText = includeLink ? `\n\nDocs: ${update.link}` : "";
        
        // Twitter limit is 280 characters.
        // We need to calculate remaining length for the description snippet.
        const fixedLength = titleText.length + tagsText.length + linkText.length;
        const availableLength = 280 - fixedLength;
        
        let description = update.text;
        
        if (description.length > availableLength) {
            // Smart truncation to fit 280 chars
            description = description.substring(0, availableLength - 4) + '...';
        }
        
        return `${titleText}${description}${tagsText}${linkText}`;
    }

    // Action: Regenerate draft on option toggle
    function regenerateDraft() {
        if (!state.selectedUpdate) return;
        state.tweetDraft = generateTweetText(state.selectedUpdate, state.options.includeTags, state.options.includeLink);
        tweetTextarea.value = state.tweetDraft;
        updateCharCounter();
        updateTweetSubmitUrl();
    }

    // Action: Shorten Tweet Draft aggressively
    function shortenTweetDraft() {
        let text = tweetTextarea.value;
        
        // Mapping of common Cloud words to shorter versions
        const abbreviations = [
            [/Google Cloud Platform/g, 'GCP'],
            [/Google Cloud/g, 'GCP'],
            [/generally available/g, 'GA'],
            [/Generally Available/g, 'GA'],
            [/Preview/g, 'preview'],
            [/database/g, 'DB'],
            [/databases/g, 'DBs'],
            [/information/g, 'info'],
            [/recommendations/g, 'recs'],
            [/performance/g, 'perf'],
            [/parameters/g, 'params'],
            [/connection/g, 'conn'],
            [/connections/g, 'conns'],
            [/functions/g, 'funcs'],
            [/function/g, 'func'],
            [/analytics/g, 'BI']
        ];
        
        abbreviations.forEach(([regex, abbr]) => {
            text = text.replace(regex, abbr);
        });
        
        // If it's still too long, let's truncate the middle description part
        if (text.length > 280 && state.selectedUpdate) {
            // Try to rebuild the draft with aggressive limits
            const titleText = `BigQuery ${state.selectedUpdate.type} (${state.selectedUpdate.date}): `;
            const tagsText = state.options.includeTags ? "\n#BigQuery #GCP" : "";
            const linkText = state.options.includeLink ? `\n${state.selectedUpdate.link}` : "";
            
            const fixedLength = titleText.length + tagsText.length + linkText.length;
            const availableLength = 280 - fixedLength;
            
            // Abbreviate description text before slicing
            let desc = state.selectedUpdate.text;
            abbreviations.forEach(([regex, abbr]) => {
                desc = desc.replace(regex, abbr);
            });
            
            if (desc.length > availableLength) {
                desc = desc.substring(0, availableLength - 4) + '...';
            }
            
            text = `${titleText}${desc}${tagsText}${linkText}`;
        }
        
        tweetTextarea.value = text;
        state.tweetDraft = text;
        updateCharCounter();
        updateTweetSubmitUrl();
        showToast('Draft text abbreviated!', 'success');
    }

    // UI Helper: Update Character Counter
    function updateCharCounter() {
        const length = tweetTextarea.value.length;
        charCounter.textContent = `${length} / 280`;
        
        // Clear old classes
        charCounter.className = 'char-counter';
        charWarning.style.display = 'none';
        tweetSubmitBtn.classList.remove('disabled');
        
        if (length > 280) {
            charCounter.classList.add('danger');
            charWarning.style.display = 'block';
            charWarning.textContent = `Exceeds limit by ${length - 280} chars!`;
        } else if (length > 250) {
            charCounter.classList.add('warning');
        }
    }

    // UI Helper: Update Web Intent href
    function updateTweetSubmitUrl() {
        const tweetText = tweetTextarea.value;
        const encodedText = encodeURIComponent(tweetText);
        tweetSubmitBtn.href = `https://twitter.com/intent/tweet?text=${encodedText}`;
    }

    // UI Helper: Active/Inactive buttons
    function toggleButtonActive(button, isActive) {
        if (isActive) {
            button.classList.add('active');
            button.style.backgroundColor = 'rgba(99, 102, 241, 0.15)';
            button.style.borderColor = 'var(--color-primary)';
            button.style.color = 'var(--text-main)';
        } else {
            button.classList.remove('active');
            button.style.backgroundColor = 'transparent';
            button.style.borderColor = 'var(--border-color)';
            button.style.color = 'var(--text-muted)';
        }
    }

    // Calculation: Set metrics counts from flat updates list
    function calculateStats() {
        const total = state.flatUpdates.length;
        let features = 0;
        let issues = 0;
        let changes = 0;
        
        state.flatUpdates.forEach(upd => {
            const type = upd.type.toLowerCase();
            if (type.includes('feature')) features++;
            else if (type.includes('issue')) issues++;
            else changes++; // change, deprecation, etc.
        });
        
        statTotal.textContent = total;
        statFeatures.textContent = features;
        statIssues.textContent = issues;
        statChanges.textContent = changes;
    }

    // UI State: Loading Feed state controller
    function setLoadingState(isLoading) {
        if (isLoading) {
            refreshBtn.disabled = true;
            refreshIcon.classList.add('spinning');
            feedLoading.style.display = 'flex';
            feedError.style.display = 'none';
            feedEmpty.style.display = 'none';
            releaseNotesList.style.display = 'none';
        } else {
            refreshBtn.disabled = false;
            refreshIcon.classList.remove('spinning');
            feedLoading.style.display = 'none';
        }
    }

    // UI State: Error display controller
    function showErrorState(msg) {
        feedLoading.style.display = 'none';
        feedEmpty.style.display = 'none';
        releaseNotesList.style.display = 'none';
        
        feedError.style.display = 'flex';
        errorMessage.textContent = msg || 'An error occurred while fetching the release notes feed.';
        statusText.textContent = 'Disconnected';
        showToast('Failed to fetch release notes feed.', 'error');
    }

    // Notification toast popup generator
    function showToast(message, type = 'success') {
        const toast = document.createElement('div');
        toast.className = `toast ${type}`;
        
        let iconMarkup = '';
        if (type === 'success') {
            iconMarkup = `
                <svg class="toast-icon" viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
                    <polyline points="20 6 9 17 4 12"></polyline>
                </svg>
            `;
        } else {
            iconMarkup = `
                <svg class="toast-icon" viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
                    <circle cx="12" cy="12" r="10"></circle>
                    <line x1="12" y1="8" x2="12" y2="12"></line>
                    <line x1="12" y1="16" x2="12.01" y2="16"></line>
                </svg>
            `;
        }
        
        toast.innerHTML = `
            ${iconMarkup}
            <span>${message}</span>
        `;
        
        toastContainer.appendChild(toast);
        
        // Animate in
        setTimeout(() => toast.classList.add('show'), 10);
        
        // Remove after 3.5 seconds
        setTimeout(() => {
            toast.classList.remove('show');
            setTimeout(() => toast.remove(), 300);
        }, 3500);
    }

    // Utility: Format date time to string
    function formatTime(date) {
        return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
    }
});
