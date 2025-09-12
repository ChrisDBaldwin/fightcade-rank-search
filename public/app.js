// Global state
let currentGame = null;
let currentPage = 1;
let currentPageSize = 50;
let currentFilters = {};
let currentView = 'home'; // 'home', 'stats', 'main' or 'localScene'
let currentScene = null;
let availableScenes = [];
let sceneStats = null;
let currentStatistics = null;
let rankChart = null;
let countryChart = null;

// DOM elements
const gameCardsContainer = document.getElementById('gameCardsContainer');
const gameInfo = document.getElementById('gameInfo');
const searchSection = document.getElementById('searchSection');
const resultsSection = document.getElementById('resultsSection');
const topPlayersSection = document.getElementById('topPlayersSection');
const gameStatsSection = document.getElementById('gameStatsSection');
const loadingSpinner = document.getElementById('loadingSpinner');

// Navigation elements
const homePageBtn = document.getElementById('homePageBtn');
const statsPageBtn = document.getElementById('statsPageBtn');
const mainPageBtn = document.getElementById('mainPageBtn');
const localSceneBtn = document.getElementById('localSceneBtn');
const homePage = document.getElementById('homePage');
const statsPage = document.getElementById('statsPage');
const mainPage = document.getElementById('mainPage');
const localScenePage = document.getElementById('localScenePage');

// Mobile navigation elements
const navLogo = document.getElementById('navLogo');
const navMenu = document.getElementById('navMenu');

// Scene elements
const sceneSelect = document.getElementById('sceneSelect');
const refreshScenesBtn = document.getElementById('refreshScenesBtn');
const sceneInfo = document.getElementById('sceneInfo');
const sceneStatsSection = document.getElementById('sceneStatsSection');
const sceneStatsGrid = document.getElementById('sceneStatsGrid');
const sceneResultsSection = document.getElementById('sceneResultsSection');
const sceneResultsTitle = document.getElementById('sceneResultsTitle');
const sceneSummary = document.getElementById('sceneSummary');
const sceneTable = document.getElementById('sceneTable');
const sceneLoadingSpinner = document.getElementById('sceneLoadingSpinner');
const showSubmissionInfoBtn = document.getElementById('showSubmissionInfoBtn');
const hideSubmissionInfoBtn = document.getElementById('hideSubmissionInfoBtn');
const submissionInfoSection = document.getElementById('submissionInfoSection');
const submissionInfoContent = document.getElementById('submissionInfoContent');

// Search elements
const playerNameSearch = document.getElementById('playerNameSearch');
const quickSearchBtn = document.getElementById('quickSearchBtn');
const toggleFiltersBtn = document.getElementById('toggleFiltersBtn');
const filtersPanel = document.getElementById('filtersPanel');
const applyFiltersBtn = document.getElementById('applyFiltersBtn');
const clearFiltersBtn = document.getElementById('clearFiltersBtn');
const pageSizeSelect = document.getElementById('pageSizeSelect');
const countryFilter = document.getElementById('countryFilter');

// Initialize the app
document.addEventListener('DOMContentLoaded', function() {
    initializeEventListeners();
    loadAvailableGames();
    initializeStatisticsPage();
    initializeHomePage();
    // Start on homepage
    showHomePage();
});

function initializeEventListeners() {
    // Navigation
    homePageBtn.addEventListener('click', () => {
        showHomePage();
        closeMobileMenu();
    });
    statsPageBtn.addEventListener('click', () => {
        showStatsPage();
        closeMobileMenu();
    });
    mainPageBtn.addEventListener('click', () => {
        showMainPage();
        closeMobileMenu();
    });
    localSceneBtn.addEventListener('click', () => {
        showLocalScenePage();
        closeMobileMenu();
    });
    
    // Mobile navigation
    navLogo.addEventListener('click', toggleMobileMenu);
    
    // Close mobile menu when clicking outside
    document.addEventListener('click', (e) => {
        if (!navMenu.contains(e.target) && 
            !navLogo.contains(e.target)) {
            closeMobileMenu();
        }
    });
    
    // Statistics
    statsGameSelect.addEventListener('change', onStatsGameSelect);
    loadStatsBtn.addEventListener('click', loadStatistics);
    countrySelector.addEventListener('change', onCountrySelect);
    
    // Country tabs
    document.querySelectorAll('.country-tab').forEach(tab => {
        tab.addEventListener('click', () => {
            switchCountryTab(tab.dataset.tab);
        });
    });
    
    // Game selection - no longer needed since we'll use click events on cards
    
    // Scenes
    sceneSelect.addEventListener('change', onSceneSelect);
    refreshScenesBtn.addEventListener('click', loadAvailableScenes);
    showSubmissionInfoBtn.addEventListener('click', showSubmissionInfo);
    hideSubmissionInfoBtn.addEventListener('click', hideSubmissionInfo);

    // Search
    quickSearchBtn.addEventListener('click', performQuickSearch);
    playerNameSearch.addEventListener('keypress', function(e) {
        if (e.key === 'Enter') {
            performQuickSearch();
        }
    });

    // Filters
    toggleFiltersBtn.addEventListener('click', toggleFilters);
    applyFiltersBtn.addEventListener('click', applyFilters);
    clearFiltersBtn.addEventListener('click', clearFilters);
    pageSizeSelect.addEventListener('change', onPageSizeChange);

    // Enter key support for filter inputs
    const filterInputs = ['minElo', 'maxElo'];
    filterInputs.forEach(id => {
        const input = document.getElementById(id);
        if (input) {
            input.addEventListener('keypress', function(e) {
                if (e.key === 'Enter') {
                    applyFilters();
                }
            });
        }
    });

    // Rank tier filter changes
    const minRankTier = document.getElementById('minRankTier');
    const maxRankTier = document.getElementById('maxRankTier');
    if (minRankTier) minRankTier.addEventListener('change', applyFilters);
    if (maxRankTier) maxRankTier.addEventListener('change', applyFilters);

    // Country filter change
    countryFilter.addEventListener('change', applyFilters);
}

async function loadAvailableGames() {
    showLoading(true);
    try {
        const response = await fetch('/api/games');
        const data = await response.json();
        
        // Clear and populate game cards
        gameCardsContainer.innerHTML = '';
        
        // Popular games with display names and icons
        const gameNames = {
            'sfiii3nr1': 'Street Fighter III: 3rd Strike',
            'sfa3': 'Street Fighter Alpha 3',
            'sf2ce': 'Street Fighter II Champion Edition',
            'kof98': 'King of Fighters 98',
            'kof2002': 'King of Fighters 2002',
            'ggxxacpr': 'Guilty Gear XX Accent Core Plus R',
            'vsav': 'Vampire Savior',
            'jojoba': "JoJo's Bizarre Adventure"
        };

        const gameIcons = {
            'sfiii3nr1': 'fas fa-fist-raised',
            'sfa3': 'fas fa-fire',
            'sf2ce': 'fas fa-bolt',
            'kof98': 'fas fa-crown',
            'kof2002': 'fas fa-star',
            'ggxxacpr': 'fas fa-sword',
            'vsav': 'fas fa-moon',
            'jojoba': 'fas fa-gem'
        };
        
        if (data.games.length === 0) {
            gameCardsContainer.innerHTML = `
                <div class="empty-state">
                    <i class="fas fa-gamepad" style="font-size: 3rem; color: #4299e1; margin-bottom: 20px;"></i>
                    <h3>No Games Available</h3>
                    <p>Game data needs to be loaded by an administrator.</p>
                </div>
            `;
            return;
        }

        data.games.forEach(gameId => {
            const gameCard = document.createElement('div');
            gameCard.className = 'game-card-main';
            gameCard.innerHTML = `
                <div class="game-card-icon">
                    <i class="${gameIcons[gameId] || 'fas fa-gamepad'}"></i>
                </div>
                <div class="game-card-name">${gameNames[gameId] || gameId}</div>
                <div class="game-card-action">
                    <button class="game-card-btn" data-game="${gameId}">
                        <i class="fas fa-play"></i> Select Game
                    </button>
                </div>
            `;
            
            // Add click listener to game card
            gameCard.addEventListener('click', () => {
                selectGame(gameId);
            });
            
            gameCardsContainer.appendChild(gameCard);
        });

        // Auto-select Street Fighter III: 3rd Strike if available
        if (data.games.includes('sfiii3nr1')) {
            selectGame('sfiii3nr1');
        }
    } catch (error) {
        console.error('Error loading games:', error);
        showMessage('Error loading available games', 'error');
    }
    showLoading(false);
}

function selectGame(gameId) {
    currentGame = gameId;
    
    // Update visual selection
    const allCards = gameCardsContainer.querySelectorAll('.game-card-main');
    allCards.forEach(card => card.classList.remove('selected'));
    
    const selectedCard = gameCardsContainer.querySelector(`[data-game="${gameId}"]`)?.closest('.game-card-main');
    if (selectedCard) {
        selectedCard.classList.add('selected');
    }
    
    // Load game data
    onGameSelect();
}

// Homepage Functions
async function initializeHomePage() {
    // Initialize hero search elements
    const heroPlayerSearch = document.getElementById('heroPlayerSearch');
    const heroGameSelect = document.getElementById('heroGameSelect');
    const heroSearchBtn = document.getElementById('heroSearchBtn');
    
    // Quick action buttons
    const browseTopPlayersBtn = document.getElementById('browseTopPlayersBtn');
    const viewStatisticsBtn = document.getElementById('viewStatisticsBtn');
    const exploreCommunityBtn = document.getElementById('exploreCommunityBtn');

    if (!heroPlayerSearch || !heroGameSelect || !heroSearchBtn) return;

    // Load games for hero game selector
    await loadHeroGameSelector();
    
    // Event listeners for hero search
    heroGameSelect.addEventListener('change', () => {
        heroSearchBtn.disabled = !heroGameSelect.value;
    });
    
    heroSearchBtn.addEventListener('click', performHeroSearch);
    heroPlayerSearch.addEventListener('keypress', function(e) {
        if (e.key === 'Enter') {
            performHeroSearch();
        }
    });

    // Quick action button listeners
    if (browseTopPlayersBtn) {
        browseTopPlayersBtn.addEventListener('click', () => {
            showMainPage();
            // Focus on game selection if no game is selected
            if (!currentGame) {
                gameSelect.focus();
            }
        });
    }

    if (viewStatisticsBtn) {
        viewStatisticsBtn.addEventListener('click', () => {
            showStatsPage();
        });
    }

    if (exploreCommunityBtn) {
        exploreCommunityBtn.addEventListener('click', () => {
            showLocalScenePage();
        });
    }

    // Load and display featured games
    await loadFeaturedGames();
}

async function loadHeroGameSelector() {
    try {
        const response = await fetch('/api/games');
        const data = await response.json();
        
        const heroGameSelect = document.getElementById('heroGameSelect');
        if (!heroGameSelect) return;
        
        heroGameSelect.innerHTML = '<option value="">Select a game...</option>';
        
        const gameNames = {
            'sfiii3nr1': 'Street Fighter III: 3rd Strike',
            'sfa3': 'Street Fighter Alpha 3',
            'sf2ce': 'Street Fighter II Champion Edition',
            'kof98': 'King of Fighters 98',
            'kof2002': 'King of Fighters 2002',
            'ggxxacpr': 'Guilty Gear XX Accent Core Plus R',
            'vsav': 'Vampire Savior',
            'jojoba': "JoJo's Bizarre Adventure"
        };
        
        data.games.forEach(gameId => {
            const option = document.createElement('option');
            option.value = gameId;
            option.textContent = gameNames[gameId] || gameId;
            heroGameSelect.appendChild(option);
        });
    } catch (error) {
        console.error('Error loading hero game selector:', error);
    }
}

async function loadFeaturedGames() {
    try {
        const response = await fetch('/api/games');
        const data = await response.json();
        
        const homeGameGrid = document.getElementById('homeGameGrid');
        if (!homeGameGrid) return;
        
        const gameNames = {
            'sfiii3nr1': 'Street Fighter III: 3rd Strike',
            'sfa3': 'Street Fighter Alpha 3', 
            'sf2ce': 'Street Fighter II Champion Edition',
            'kof98': 'King of Fighters 98',
            'kof2002': 'King of Fighters 2002',
            'ggxxacpr': 'Guilty Gear XX Accent Core Plus R',
            'vsav': 'Vampire Savior',
            'jojoba': "JoJo's Bizarre Adventure"
        };

        const gameIcons = {
            'sfiii3nr1': 'fas fa-fist-raised',
            'sfa3': 'fas fa-fire',
            'sf2ce': 'fas fa-bolt',
            'kof98': 'fas fa-crown',
            'kof2002': 'fas fa-star',
            'ggxxacpr': 'fas fa-sword',
            'vsav': 'fas fa-moon',
            'jojoba': 'fas fa-gem'
        };
        
        homeGameGrid.innerHTML = '';
        
        // Show up to 6 games
        const gamesToShow = data.games.slice(0, 6);
        
        for (const gameId of gamesToShow) {
            const gameCard = document.createElement('div');
            gameCard.className = 'game-card';
            gameCard.innerHTML = `
                <div class="game-icon">
                    <i class="${gameIcons[gameId] || 'fas fa-gamepad'}"></i>
                </div>
                <div class="game-name">${gameNames[gameId] || gameId}</div>
                <div class="game-action">
                    <button class="game-select-btn" data-game="${gameId}">
                        <i class="fas fa-search"></i> Search Players
                    </button>
                </div>
            `;
            
            // Add click listener to game card
            gameCard.addEventListener('click', () => {
                selectGameAndNavigate(gameId);
            });
            
            homeGameGrid.appendChild(gameCard);
        }
    } catch (error) {
        console.error('Error loading featured games:', error);
    }
}

function selectGameAndNavigate(gameId) {
    // Set the current game
    currentGame = gameId;
    
    // Navigate to main page
    showMainPage();
    
    // Load the games first, then trigger game selection to load data
    loadAvailableGames().then(() => {
        selectGame(gameId);
    });
}

async function performHeroSearch() {
    const heroPlayerSearch = document.getElementById('heroPlayerSearch');
    const heroGameSelect = document.getElementById('heroGameSelect');
    
    if (!heroPlayerSearch || !heroGameSelect) return;
    
    const searchTerm = heroPlayerSearch.value.trim();
    const selectedGame = heroGameSelect.value;
    
    if (!searchTerm || !selectedGame) {
        showMessage('Please enter a player name and select a game', 'error');
        return;
    }
    
    // Set the current game
    currentGame = selectedGame;
    
    // Navigate to main page
    showMainPage();
    
    // Set search term and perform search
    const playerNameSearch = document.getElementById('playerNameSearch');
    if (playerNameSearch) {
        playerNameSearch.value = searchTerm;
        // Trigger the search
        setTimeout(() => performQuickSearch(), 100);
    }
}

async function onGameSelect() {
    const gameId = currentGame;
    
    if (!gameId) {
        hideAllSections();
        return;
    }
    
    // Try to load existing data
    try {
        const response = await fetch(`/api/games/${gameId}`);
        if (response.ok) {
            const data = await response.json();
            displayGameInfo(data);
            showSearchSection();
            loadTopPlayers();
            loadGameStats();
        } else {
            // No data available
            gameInfo.innerHTML = `
                <h3>⚠️ No data available for this game</h3>
                <p>Game data needs to be loaded by an administrator.</p>
            `;
            gameInfo.className = 'game-info';
            gameInfo.classList.remove('hidden');
            hideSearchSection();
        }
    } catch (error) {
        console.error('Error loading game data:', error);
        hideSearchSection();
    }
}


function displayGameInfo(data) {
    const lastUpdate = new Date(data.lastUpdated).toLocaleString();
    const isStale = data.isStale;
    
    gameInfo.innerHTML = `
        <h3>${data.gameName}</h3>
        <div class="game-info-grid">
            <div class="info-item">
                <span class="info-label">Total Fighters:</span>
                <span class="info-value">${data.totalPlayers.toLocaleString()}</span>
            </div>
            <div class="info-item">
                <span class="info-label">Last Updated:</span>
                <span class="info-value">${lastUpdate}</span>
            </div>
            <div class="info-item">
                <span class="info-label">Status:</span>
                <span class="info-value ${isStale ? 'text-warning' : 'text-success'}">
                    ${isStale ? '⚠️ Battle data may be stale' : '✅ Fresh battle intel'}
                </span>
            </div>
        </div>
        ${isStale ? '<p style="margin-top: 10px; color: #d69e2e;"><i class="fas fa-info-circle"></i> Consider loading fresh fighter data for the latest battle rankings.</p>' : ''}
    `;
    
    gameInfo.className = `game-info ${isStale ? 'stale' : ''}`;
    gameInfo.classList.remove('hidden');
}

function showSearchSection() {
    searchSection.classList.remove('hidden');
    // Load countries from a large sample of players
    loadAllCountries();
    // Perform initial search to show all players
    performSearch();
}

function hideSearchSection() {
    searchSection.classList.add('hidden');
    hideAllSections();
}

function hideAllSections() {
    resultsSection.classList.add('hidden');
    topPlayersSection.classList.add('hidden');
    gameStatsSection.classList.add('hidden');
}

async function performQuickSearch() {
    const searchTerm = playerNameSearch.value.trim();
    currentFilters = { name: searchTerm };
    currentPage = 1;
    await performSearch();
}

function toggleFilters() {
    filtersPanel.classList.toggle('hidden');
    const isVisible = !filtersPanel.classList.contains('hidden');
    toggleFiltersBtn.innerHTML = isVisible 
        ? '<i class="fas fa-filter"></i> Hide Filters'
        : '<i class="fas fa-filter"></i> Advanced Filters';
}

// Rank tier to ELO mapping
const rankTierToElo = {
    'E': { min: 1000, max: 1199 },
    'D': { min: 1200, max: 1399 },
    'C': { min: 1400, max: 1599 },
    'B': { min: 1600, max: 1799 },
    'A': { min: 1800, max: 1999 },
    'S': { min: 2000, max: 9999 }
};

// Convert ELO to rank tier
function eloToRankTier(elo) {
    if (elo >= 2000) return 'S';
    if (elo >= 1800) return 'A';
    if (elo >= 1600) return 'B';
    if (elo >= 1400) return 'C';
    if (elo >= 1200) return 'D';
    return 'E';
}

// Get rank tier color
function getRankTierColor(tier) {
    const colors = {
        'S': '#ffff00', // Gold
        'A': '#ff6b47', // Orange
        'B': '#ff1493', // Pink
        'C': '#00ff00', // Green
        'D': '#00ffff', // Cyan
        'E': '#ffffff'  // White
    };
    return colors[tier] || '#ffffff';
}

function applyFilters() {
    const minRankTier = document.getElementById('minRankTier').value;
    const maxRankTier = document.getElementById('maxRankTier').value;
    
    // Convert rank tiers to ELO ranges
    let minEloFromTier, maxEloFromTier;
    if (minRankTier) {
        minEloFromTier = rankTierToElo[minRankTier].min;
    }
    if (maxRankTier) {
        maxEloFromTier = rankTierToElo[maxRankTier].max;
    }
    
    // Combine manual ELO inputs with tier-based ELO
    const manualMinElo = parseFloat(document.getElementById('minElo').value);
    const manualMaxElo = parseFloat(document.getElementById('maxElo').value);
    
    const finalMinElo = Math.max(
        manualMinElo || 0,
        minEloFromTier || 0
    ) || undefined;
    
    const finalMaxElo = Math.min(
        manualMaxElo || 9999,
        maxEloFromTier || 9999
    );
    const finalMaxEloValue = finalMaxElo === 9999 ? undefined : finalMaxElo;
    
    currentFilters = {
        name: playerNameSearch.value.trim() || undefined,
        minElo: finalMinElo,
        maxElo: finalMaxEloValue,
        country: countryFilter.value.trim() || undefined,
    };
    
    currentPage = 1;
    performSearch();
}

function clearFilters() {
    // Clear all filter inputs
    playerNameSearch.value = '';
    document.getElementById('minElo').value = '';
    document.getElementById('maxElo').value = '';
    document.getElementById('minRankTier').value = '';
    document.getElementById('maxRankTier').value = '';
    countryFilter.value = '';
    
    currentFilters = {};
    currentPage = 1;
    performSearch();
}

function onPageSizeChange() {
    currentPageSize = parseInt(pageSizeSelect.value);
    currentPage = 1;
    performSearch();
}

async function performSearch() {
    if (!currentGame) return;

    showLoading(true);
    
    try {
        const params = new URLSearchParams({
            page: currentPage.toString(),
            pageSize: currentPageSize.toString(),
            ...Object.fromEntries(
                Object.entries(currentFilters).filter(([_, value]) => value !== undefined && value !== '')
            )
        });

        const response = await fetch(`/api/games/${currentGame}/search?${params}`);
        const data = await response.json();
        
        if (response.ok) {
            displayResults(data);
            // Populate countries from the search results
            if (data.players && countryFilter.children.length <= 1) {
                populateCountriesFromPlayers(data.players);
            }
        } else {
            showMessage(`Error: ${data.error}`, 'error');
        }
    } catch (error) {
        console.error('Error performing search:', error);
        showMessage('Error searching players', 'error');
    }
    
    showLoading(false);
}

function displayResults(data) {
    const { players, totalCount, page, pageSize, totalPages } = data;
    
    // Update results count
    document.getElementById('resultsCount').textContent = `${totalCount.toLocaleString()} fighters found`;
    
    // Create table
    const tableHTML = `
        <table>
            <thead>
                <tr>
                    <th>Rank</th>
                    <th>Fighter Name</th>
                    <th>Country</th>
                    <th>Tier</th>
                    <th>Total Matches</th>
                </tr>
            </thead>
            <tbody>
                ${players.map(player => {
                    const tier = eloToRankTier(player.elo);
                    const tierColor = getRankTierColor(tier);
                    return `
                    <tr>
                        <td class="rank-cell">#${player.rank}</td>
                        <td class="name-cell"><a href="https://www.fightcade.com/id/${encodeURIComponent(player.name)}" target="_blank" rel="noopener noreferrer">${escapeHtml(player.name)}</a></td>
                        <td class="country-cell">${escapeHtml(player.country || 'Unknown')}</td>
                        <td class="tier-cell" style="color: ${tierColor}; text-shadow: 0 0 5px ${tierColor}; font-weight: bold;">${tier}</td>
                        <td class="matches-cell">${player.totalMatches || 0}</td>
                    </tr>
                    `;
                }).join('')}
            </tbody>
        </table>
    `;
    
    document.getElementById('playersTable').innerHTML = tableHTML;
    
    // Show pagination if needed
    if (totalPages > 1) {
        displayPagination(page, totalPages, totalCount);
    } else {
        document.getElementById('pagination').classList.add('hidden');
    }
    
    resultsSection.classList.remove('hidden');
}

function displayPagination(currentPage, totalPages, totalCount) {
    const pagination = document.getElementById('pagination');
    
    let paginationHTML = '';
    
    // Previous button
    paginationHTML += `
        <button onclick="goToPage(${currentPage - 1})" ${currentPage === 1 ? 'disabled' : ''}>
            <i class="fas fa-chevron-left"></i> Previous
        </button>
    `;
    
    // Page numbers
    const startPage = Math.max(1, currentPage - 2);
    const endPage = Math.min(totalPages, currentPage + 2);
    
    if (startPage > 1) {
        paginationHTML += `<button onclick="goToPage(1)">1</button>`;
        if (startPage > 2) {
            paginationHTML += `<span>...</span>`;
        }
    }
    
    for (let i = startPage; i <= endPage; i++) {
        paginationHTML += `
            <button onclick="goToPage(${i})" ${i === currentPage ? 'class="active"' : ''}>
                ${i}
            </button>
        `;
    }
    
    if (endPage < totalPages) {
        if (endPage < totalPages - 1) {
            paginationHTML += `<span>...</span>`;
        }
        paginationHTML += `<button onclick="goToPage(${totalPages})">${totalPages}</button>`;
    }
    
    // Next button
    paginationHTML += `
        <button onclick="goToPage(${currentPage + 1})" ${currentPage === totalPages ? 'disabled' : ''}>
            Next <i class="fas fa-chevron-right"></i>
        </button>
    `;
    
    // Page info
    const startItem = (currentPage - 1) * currentPageSize + 1;
    const endItem = Math.min(currentPage * currentPageSize, totalCount);
    paginationHTML += `
        <span class="pagination-info">
            Showing ${startItem.toLocaleString()}-${endItem.toLocaleString()} of ${totalCount.toLocaleString()}
        </span>
    `;
    
    pagination.innerHTML = paginationHTML;
    pagination.classList.remove('hidden');
}

function goToPage(page) {
    currentPage = page;
    performSearch();
}

async function loadTopPlayers() {
    if (!currentGame) return;

    try {
        const response = await fetch(`/api/games/${currentGame}/top?count=10`);
        const data = await response.json();
        
        if (response.ok) {
            displayTopPlayers(data.topPlayers);
        }
    } catch (error) {
        console.error('Error loading top players:', error);
    }
}

function displayTopPlayers(players) {
    const topPlayersHTML = players.map((player, index) => `
        <div class="top-player-card">
            <div class="player-rank">#${player.rank}</div>
            <div class="player-info">
                <h4><a href="https://www.fightcade.com/id/${encodeURIComponent(player.name)}" target="_blank" rel="noopener noreferrer">${escapeHtml(player.name)}</a></h4>
                <div class="player-stats">
                    ${player.elo} Power • ${player.totalMatches || 0} Matches • ${player.country || 'Unknown'}
                </div>
            </div>
        </div>
    `).join('');
    
    document.getElementById('topPlayersList').innerHTML = topPlayersHTML;
    topPlayersSection.classList.remove('hidden');
}

function populateCountriesFromPlayers(players) {
    if (!players || players.length === 0) return;

    // Extract unique countries from player data
    const countries = new Set();
    players.forEach(player => {
        if (player.country && player.country !== 'Unknown' && player.country.trim() !== '') {
            countries.add(player.country.trim());
        }
    });

    // Convert to sorted array
    const sortedCountries = Array.from(countries).sort();
    
    if (sortedCountries.length > 0) {
        // Clear existing options (except "All Countries")
        countryFilter.innerHTML = '<option value="">All Countries</option>';
        
        // Add country options
        sortedCountries.forEach(country => {
            const option = document.createElement('option');
            option.value = country;
            option.textContent = country;
            countryFilter.appendChild(option);
        });
    }
}

async function loadAllCountries() {
    if (!currentGame) return;

    try {
        // Get a large sample of players to extract countries from
        const response = await fetch(`/api/games/${currentGame}/search?pageSize=1000&page=1`);
        const data = await response.json();
        
        if (response.ok && data.players) {
            populateCountriesFromPlayers(data.players);
        }
    } catch (error) {
        console.error('Error loading countries from players:', error);
    }
}

async function loadGameStats() {
    if (!currentGame) return;

    try {
        const response = await fetch(`/api/games/${currentGame}`);
        const data = await response.json();
        
        if (response.ok && data.stats) {
            displayGameStats(data.stats);
        }
    } catch (error) {
        console.error('Error loading game stats:', error);
    }
}

function displayGameStats(stats) {
    const statsHTML = `
        <div class="stat-card">
            <div class="stat-value">${stats.totalPlayers.toLocaleString()}</div>
            <div class="stat-label">Total Players</div>
        </div>
        <div class="stat-card">
            <div class="stat-value">${stats.averageElo}</div>
            <div class="stat-label">Average Power</div>
        </div>
        <div class="stat-card">
            <div class="stat-value">${stats.medianElo}</div>
            <div class="stat-label">Median Power</div>
        </div>
        <div class="stat-card">
            <div class="stat-value">${stats.topElo}</div>
            <div class="stat-label">Highest Power</div>
        </div>
        <div class="stat-card">
            <div class="stat-value">${stats.bottomElo}</div>
            <div class="stat-label">Lowest Power</div>
        </div>
    `;
    
    document.getElementById('gameStats').innerHTML = statsHTML;
    gameStatsSection.classList.remove('hidden');
}

function showLoading(show) {
    if (show) {
        loadingSpinner.classList.remove('hidden');
    } else {
        loadingSpinner.classList.add('hidden');
    }
}

function showMessage(message, type = 'info') {
    // Create a simple toast notification
    const toast = document.createElement('div');
    toast.className = `toast toast-${type}`;
    toast.innerHTML = message;
    
    // Add some basic toast styles
    toast.style.cssText = `
        position: fixed;
        top: 20px;
        right: 20px;
        padding: 15px 20px;
        border-radius: 8px;
        color: white;
        font-weight: 500;
        z-index: 1000;
        max-width: 400px;
        box-shadow: 0 10px 30px rgba(0, 0, 0, 0.2);
        transform: translateX(100%);
        transition: transform 0.3s ease;
        ${type === 'success' ? 'background: linear-gradient(135deg, #38a169, #48bb78);' : ''}
        ${type === 'error' ? 'background: linear-gradient(135deg, #e53e3e, #f56565);' : ''}
        ${type === 'info' ? 'background: linear-gradient(135deg, #667eea, #764ba2);' : ''}
    `;
    
    document.body.appendChild(toast);
    
    // Animate in
    setTimeout(() => {
        toast.style.transform = 'translateX(0)';
    }, 100);
    
    // Auto remove after 5 seconds
    setTimeout(() => {
        toast.style.transform = 'translateX(100%)';
        setTimeout(() => {
            if (toast.parentNode) {
                toast.parentNode.removeChild(toast);
            }
        }, 300);
    }, 5000);
}

function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

// Mobile Menu Functions
function toggleMobileMenu() {
    navMenu.classList.toggle('active');
}

function closeMobileMenu() {
    navMenu.classList.remove('active');
}

// Navigation Functions
function showHomePage() {
    currentView = 'home';
    homePage.classList.remove('hidden');
    statsPage.classList.add('hidden');
    mainPage.classList.add('hidden');
    localScenePage.classList.add('hidden');
    
    // Update nav buttons
    homePageBtn.classList.add('active');
    statsPageBtn.classList.remove('active');
    mainPageBtn.classList.remove('active');
    localSceneBtn.classList.remove('active');
}

function showStatsPage() {
    currentView = 'stats';
    homePage.classList.add('hidden');
    statsPage.classList.remove('hidden');
    mainPage.classList.add('hidden');
    localScenePage.classList.add('hidden');
    
    // Update nav buttons
    homePageBtn.classList.remove('active');
    statsPageBtn.classList.add('active');
    mainPageBtn.classList.remove('active');
    localSceneBtn.classList.remove('active');
}

function showMainPage() {
    currentView = 'main';
    homePage.classList.add('hidden');
    statsPage.classList.add('hidden');
    mainPage.classList.remove('hidden');
    localScenePage.classList.add('hidden');
    
    // Update nav buttons
    homePageBtn.classList.remove('active');
    statsPageBtn.classList.remove('active');
    mainPageBtn.classList.add('active');
    localSceneBtn.classList.remove('active');
}

function showLocalScenePage() {
    currentView = 'localScene';
    homePage.classList.add('hidden');
    statsPage.classList.add('hidden');
    mainPage.classList.add('hidden');
    localScenePage.classList.remove('hidden');
    
    // Update nav buttons
    homePageBtn.classList.remove('active');
    statsPageBtn.classList.remove('active');
    mainPageBtn.classList.remove('active');
    localSceneBtn.classList.add('active');
    
    // Load available scenes on first visit
    if (availableScenes.length === 0) {
        loadAvailableScenes();
    }
}

// Scene Functions
async function loadAvailableScenes() {
    showSceneLoading(true);
    try {
        const response = await fetch('/api/scenes');
        const data = await response.json();
        
        availableScenes = data.scenes;
        sceneStats = data.stats;
        
        // Clear and populate scene select
        sceneSelect.innerHTML = '<option value="">Select a community scene...</option>';
        
        if (availableScenes.length === 0) {
            sceneSelect.innerHTML = '<option value="">No scenes available yet!</option>';
            sceneInfo.innerHTML = `
                <div class="empty-state">
                    <i class="fas fa-users" style="font-size: 3rem; color: #4299e1; margin-bottom: 20px;"></i>
                    <h3>No Community Scenes Yet</h3>
                    <p>🔥 Be the first to submit your local fighting game scene! 🔥</p>
                </div>
            `;
        } else {
            availableScenes.forEach(scene => {
                const option = document.createElement('option');
                option.value = scene.id;
                option.textContent = `${scene.name} - ${scene.gameName} (${scene.players.length} players)`;
                sceneSelect.appendChild(option);
            });
            
            // Update scene info with stats
            sceneInfo.innerHTML = `
                <div class="scene-overview-stats">
                    <div class="overview-card">
                        <div class="stat-icon"><i class="fas fa-users"></i></div>
                        <div class="stat-info">
                            <div class="stat-number">${sceneStats.totalScenes}</div>
                            <div class="stat-name">Scenes</div>
                        </div>
                    </div>
                    <div class="overview-card">
                        <div class="stat-icon"><i class="fas fa-fist-raised"></i></div>
                        <div class="stat-info">
                            <div class="stat-number">${sceneStats.totalPlayers}</div>
                            <div class="stat-name">Warriors</div>
                        </div>
                    </div>
                    <div class="overview-card">
                        <div class="stat-icon"><i class="fas fa-gamepad"></i></div>
                        <div class="stat-info">
                            <div class="stat-number">${sceneStats.gamesWithScenes}</div>
                            <div class="stat-name">Games</div>
                        </div>
                    </div>
                </div>
            `;
        }
        
        // Auto-select first scene if available [[memory:8552533]]
        const sf3Scene = availableScenes.find(scene => scene.gameId === 'sfiii3nr1');
        if (sf3Scene) {
            sceneSelect.value = sf3Scene.id;
            sceneSelect.dispatchEvent(new Event('change'));
        } else if (availableScenes.length > 0) {
            sceneSelect.value = availableScenes[0].id;
            sceneSelect.dispatchEvent(new Event('change'));
        }
        
    } catch (error) {
        console.error('Error loading scenes:', error);
        showMessage('Error loading community scenes', 'error');
        sceneInfo.innerHTML = `
            <div class="error-state">
                <i class="fas fa-exclamation-triangle" style="font-size: 2rem; color: #f56565; margin-bottom: 15px;"></i>
                <p>❌ Failed to load scenes. Please try again.</p>
            </div>
        `;
    }
    showSceneLoading(false);
}

async function onSceneSelect() {
    const sceneId = sceneSelect.value;
    
    if (!sceneId) {
        sceneStatsSection.classList.add('hidden');
        sceneResultsSection.classList.add('hidden');
        return;
    }

    currentScene = availableScenes.find(scene => scene.id === sceneId);
    if (!currentScene) return;
    
    // Load scene data with player stats
    await loadSceneData();
}

async function loadSceneData(useHybridData = true) {
    if (!currentScene) return;

    showSceneLoading(true);
    
    try {
        let response, data;
        
        if (useHybridData) {
            // Try hybrid approach first (best of both worlds! 🧠⚡)
            console.log('🧠 Loading HYBRID scene data - cached rankings + selective live updates...');
            response = await fetch(`/api/scenes/${currentScene.id}/hybrid`);
            data = await response.json();
            
            if (response.ok) {
                displayHybridSceneResults(data);
                const { stats } = data;
            } else {
                console.warn('❌ Hybrid data failed, trying live data:', data.error);
                // Fallback to pure live data
                response = await fetch(`/api/scenes/${currentScene.id}/live`);
                data = await response.json();
                
                if (response.ok) {
                    displayLiveSceneResults(data);
                    showMessage('⚡ Live data loaded (hybrid unavailable)', 'info');
                } else {
                    console.warn('❌ Live data also failed, falling back to cached data:', data.error);
                    // Final fallback to cached data
                    response = await fetch(`/api/scenes/${currentScene.id}`);
                    data = await response.json();
                    
                    if (response.ok) {
                        displaySceneResults(data);
                        showMessage('📊 Using cached ranking data (live data unavailable)', 'info');
                    } else {
                        showMessage(`Error loading scene: ${data.error}`, 'error');
                    }
                }
            }
        } else {
            // Use cached data only
            console.log('📊 Loading cached scene data...');
            response = await fetch(`/api/scenes/${currentScene.id}`);
            data = await response.json();
            
            if (response.ok) {
                displaySceneResults(data);
            } else {
                showMessage(`Error loading scene: ${data.error}`, 'error');
            }
        }
        
    } catch (error) {
        console.error('Error loading scene data:', error);
        showMessage('Error loading scene data', 'error');
    }
    
    showSceneLoading(false);
}

function displayHybridSceneResults(data) {
    const { scene, playerData, stats } = data;
    
    console.log(`🧠 Displaying hybrid scene data for ${scene.name}:`, stats);
    
    // Update scene results title
    sceneResultsTitle.textContent = `${scene.name} Rankings`;
    
    // Separate players by data source
    const cachedPlayers = playerData.filter(p => p.dataSource === 'cached');
    const livePlayers = playerData.filter(p => p.dataSource === 'live');
    const notFoundPlayers = playerData.filter(p => p.dataSource === 'not-found');
    
    // Update summary with clean scene description
    sceneSummary.innerHTML = `
        <div class="scene-description">
            <h3>${scene.name}</h3>
            <p class="scene-desc-text">${scene.description}</p>
            <div class="scene-meta">
                <span class="game-tag"><i class="fas fa-gamepad"></i> ${scene.gameName}</span>
                <span class="player-count"><i class="fas fa-users"></i> ${stats.playersFound}/${stats.totalPlayers} warriors found</span>
            </div>
        </div>
    `;
    
    // Sort players by tier (S to E), then by global rank (lower is better)
    const hybridFoundPlayers = playerData.filter(p => p.dataSource !== 'not-found');
    const hybridNotFoundPlayers = playerData.filter(p => p.dataSource === 'not-found');
    
    // Sort found players by tier first, then by rank
    hybridFoundPlayers.sort((a, b) => {
        const tierA = eloToRankTier(a.elo);
        const tierB = eloToRankTier(b.elo);
        const tierOrder = { 'S': 0, 'A': 1, 'B': 2, 'C': 3, 'D': 4, 'E': 5 };
        
        // First sort by tier (S is best)
        if (tierOrder[tierA] !== tierOrder[tierB]) {
            return tierOrder[tierA] - tierOrder[tierB];
        }
        
        // Then sort by rank (lower rank number is better, 0 means unranked so goes last)
        if (a.rank === 0 && b.rank === 0) return 0;
        if (a.rank === 0) return 1;
        if (b.rank === 0) return -1;
        return a.rank - b.rank;
    });

    // Create results table
    let tableHTML = `
        <table>
            <thead>
                <tr>
                    <th>Scene Rank</th>
                    <th>Global Rank</th>
                    <th>Fighter Name</th>
                    <th>Country</th>
                    <th>Tier</th>
                    <th>Total Matches</th>
                </tr>
            </thead>
            <tbody>
    `;
    
    // Add found players with proper scene ranking
    hybridFoundPlayers.forEach((player, index) => {
        const tier = eloToRankTier(player.elo);
        const tierColor = getRankTierColor(tier);
        const rankDisplay = player.rank > 0 ? `#${player.rank}` : 'Unranked';
        
        tableHTML += `
            <tr>
                <td class="rank-cell">#${index + 1}</td>
                <td class="rank-cell">${rankDisplay}</td>
                <td class="name-cell"><a href="https://www.fightcade.com/id/${encodeURIComponent(player.username)}" target="_blank" rel="noopener noreferrer">${escapeHtml(player.username)}</a></td>
                <td class="country-cell">${escapeHtml(player.country)}</td>
                <td class="tier-cell" style="color: ${tierColor}; text-shadow: 0 0 5px ${tierColor}; font-weight: bold;">${tier}</td>
                <td class="matches-cell">${player.totalMatches || 0}</td>
            </tr>
        `;
    });
    
    // Add not found players at the end
    hybridNotFoundPlayers.forEach((player) => {
        tableHTML += `
            <tr class="scene-not-found">
                <td>-</td>
                <td>-</td>
                <td class="name-cell">${escapeHtml(player.username)}</td>
                <td class="country-cell" colspan="3">Not found in rankings</td>
            </tr>
        `;
    });
    
    tableHTML += '</tbody></table>';
    
    sceneTable.innerHTML = `<div class="players-table">${tableHTML}</div>`;
    sceneResultsSection.classList.remove('hidden');
}

function displayLiveSceneResults(data) {
    const { scene, playerData, stats } = data;
    
    console.log(`🎮 Displaying live scene data for ${scene.name}:`, stats);
    
    // Update scene results title
    sceneResultsTitle.textContent = `${scene.name} Rankings (Live Data ⚡)`;
    
    // Separate found and not found players
    const foundPlayers = [];
    const notFoundPlayers = [];
    
    playerData.forEach((player) => {
        if (!player.found || !player.data) {
            notFoundPlayers.push({
                username: player.username,
                error: player.error || 'User not found on Fightcade'
            });
        } else {
            // Transform live API data to display format
            const userData = player.data;
            const gameData = userData.gameinfo && userData.gameinfo[scene.gameId];
            
            if (gameData) {
                foundPlayers.push({
                    name: player.username,
                    rank: gameData.rank || 0,
                    elo: gameData.elo || 0,
                    wins: gameData.wins || 0,
                    losses: gameData.losses || 0,
                    winRate: gameData.wins && gameData.losses ? 
                        Math.round((gameData.wins / (gameData.wins + gameData.losses)) * 100) : 0,
                    country: userData.country || 'Unknown',
                    isLiveData: true
                });
            } else {
                notFoundPlayers.push({
                    username: player.username,
                    error: 'No game data available for this game'
                });
            }
        }
    });
    
    // Sort found players by tier first, then by rank
    foundPlayers.sort((a, b) => {
        const tierA = eloToRankTier(a.elo);
        const tierB = eloToRankTier(b.elo);
        const tierOrder = { 'S': 0, 'A': 1, 'B': 2, 'C': 3, 'D': 4, 'E': 5 };
        
        // First sort by tier (S is best)
        if (tierOrder[tierA] !== tierOrder[tierB]) {
            return tierOrder[tierA] - tierOrder[tierB];
        }
        
        // Then sort by rank (lower rank number is better, 0 means unranked so goes last)
        if (a.rank === 0 && b.rank === 0) return 0;
        if (a.rank === 0) return 1;
        if (b.rank === 0) return -1;
        return a.rank - b.rank;
    });
    
    // Update summary with clean scene description
    sceneSummary.innerHTML = `
        <div class="scene-description">
            <h3>${scene.name}</h3>
            <p class="scene-desc-text">${scene.description}</p>
            <div class="scene-meta">
                <span class="game-tag"><i class="fas fa-gamepad"></i> ${scene.gameName}</span>
                <span class="player-count"><i class="fas fa-users"></i> ${foundPlayers.length}/${scene.players.length} warriors found</span>
                <span class="live-badge"><i class="fas fa-bolt"></i> Live Data</span>
            </div>
        </div>
    `;
    
    // Create results table
    let tableHTML = `
        <table>
            <thead>
                <tr>
                    <th>Scene Rank</th>
                    <th>Global Rank</th>
                    <th>Fighter Name</th>
                    <th>Country</th>
                    <th>Tier</th>
                    <th>Total Matches</th>
                </tr>
            </thead>
            <tbody>
    `;
    
    // Add found players
    foundPlayers.forEach((player, index) => {
        const tier = eloToRankTier(player.elo);
        const tierColor = getRankTierColor(tier);
        const rankDisplay = player.rank > 0 ? `#${player.rank}` : 'Unranked';
        
        tableHTML += `
            <tr>
                <td class="rank-cell">#${index + 1}</td>
                <td class="rank-cell">${rankDisplay}</td>
                <td class="name-cell"><a href="https://www.fightcade.com/id/${encodeURIComponent(player.name)}" target="_blank" rel="noopener noreferrer">${escapeHtml(player.name)}</a></td>
                <td class="country-cell">${escapeHtml(player.country)}</td>
                <td class="tier-cell" style="color: ${tierColor}; text-shadow: 0 0 5px ${tierColor}; font-weight: bold;">${tier}</td>
                <td class="matches-cell">${player.totalMatches || (player.wins + player.losses) || 0}</td>
            </tr>
        `;
    });
    
    // Add not found players
    notFoundPlayers.forEach((player) => {
        tableHTML += `
            <tr class="scene-not-found">
                <td>-</td>
                <td>-</td>
                <td class="name-cell">${escapeHtml(player.username)}</td>
                <td class="country-cell" colspan="3">${escapeHtml(player.error)}</td>
            </tr>
        `;
    });
    
    tableHTML += '</tbody></table>';
    
    sceneTable.innerHTML = `<div class="players-table">${tableHTML}</div>`;
    sceneResultsSection.classList.remove('hidden');
}

function displaySceneResults(data) {
    const { scene, playerStats } = data;
    
    // Update scene results title
    sceneResultsTitle.textContent = `${scene.name} Rankings`;
    
    // Separate found and not found players
    const foundPlayers = [];
    const notFoundPlayers = [];
    
    playerStats.forEach((playerData) => {
        if (playerData.notFound || playerData.noGameData) {
            notFoundPlayers.push(playerData.originalName);
        } else {
            foundPlayers.push(playerData);
        }
    });
    
    // Sort found players by tier first, then by rank
    foundPlayers.sort((a, b) => {
        const tierA = eloToRankTier(a.elo);
        const tierB = eloToRankTier(b.elo);
        const tierOrder = { 'S': 0, 'A': 1, 'B': 2, 'C': 3, 'D': 4, 'E': 5 };
        
        // First sort by tier (S is best)
        if (tierOrder[tierA] !== tierOrder[tierB]) {
            return tierOrder[tierA] - tierOrder[tierB];
        }
        
        // Then sort by rank (lower rank number is better, 0 means unranked so goes last)
        if (a.rank === 0 && b.rank === 0) return 0;
        if (a.rank === 0) return 1;
        if (b.rank === 0) return -1;
        return a.rank - b.rank;
    });
    
    // Update summary with clean scene description
    sceneSummary.innerHTML = `
        <div class="scene-description">
            <h3>${scene.name}</h3>
            <p class="scene-desc-text">${scene.description}</p>
            <div class="scene-meta">
                <span class="game-tag"><i class="fas fa-gamepad"></i> ${scene.gameName}</span>
                <span class="player-count"><i class="fas fa-users"></i> ${foundPlayers.length}/${scene.players.length} warriors found</span>
            </div>
        </div>
    `;
    
    // Create results table
    let tableHTML = `
        <table>
            <thead>
                <tr>
                    <th>Scene Rank</th>
                    <th>Global Rank</th>
                    <th>Fighter Name</th>
                    <th>Country</th>
                    <th>Tier</th>
                    <th>Total Matches</th>
                </tr>
            </thead>
            <tbody>
    `;
    
    // Add found players
    foundPlayers.forEach((player, index) => {
        const tier = eloToRankTier(player.elo);
        const tierColor = getRankTierColor(tier);
        const rankDisplay = player.rank > 0 ? `#${player.rank}` : 'Unranked';
        tableHTML += `
            <tr>
                <td class="rank-cell">#${index + 1}</td>
                <td class="rank-cell">${rankDisplay}</td>
                <td class="name-cell"><a href="https://www.fightcade.com/id/${encodeURIComponent(player.name)}" target="_blank" rel="noopener noreferrer">${escapeHtml(player.name)}</a></td>
                <td class="country-cell">${escapeHtml(player.country || 'Unknown')}</td>
                <td class="tier-cell" style="color: ${tierColor}; text-shadow: 0 0 5px ${tierColor}; font-weight: bold;">${tier}</td>
                <td class="matches-cell">${player.totalMatches || 0}</td>
            </tr>
        `;
    });
    
    // Add not found players
    notFoundPlayers.forEach((playerName) => {
        tableHTML += `
            <tr class="scene-not-found">
                <td>-</td>
                <td>-</td>
                <td class="name-cell">${escapeHtml(playerName)}</td>
                <td class="country-cell" colspan="3">Not found in rankings</td>
            </tr>
        `;
    });
    
    tableHTML += '</tbody></table>';
    
    sceneTable.innerHTML = `<div class="players-table">${tableHTML}</div>`;
    sceneResultsSection.classList.remove('hidden');
}

async function showSubmissionInfo() {
    try {
        // Try to fetch from API, but provide fallback content
        let submissionData = {
            email: 'cdb@voidtalker.com',
            format: `Scene Name: [Your Scene Name]
Game: [Game Name - e.g., Street Fighter III: 3rd Strike]
Game ID: [Game ID - e.g., sfiii3nr1]
Description: [Fun description of your community]
Players: [List of exact Fightcade usernames, one per line]`,
            example: `Scene Name: Tokyo Warriors
Game: Street Fighter III: 3rd Strike
Game ID: sfiii3nr1
Description: Elite Tokyo arcade scene featuring weekly tournaments
Fightcade Usernames:
MOV
Nuki
Hayao
`
        };
        
        try {
            const response = await fetch('/api/scenes/submission-info');
            if (response.ok) {
                const data = await response.json();
                if (data.email) submissionData.email = data.email;
                if (data.format) submissionData.format = data.format;
                if (data.example) submissionData.example = data.example;
            }
        } catch (apiError) {
            console.log('Using fallback submission info');
        }
        
        // Clear the content first
        submissionInfoContent.innerHTML = '';
        
        // Create the submission guide container
        const submissionGuide = document.createElement('div');
        submissionGuide.className = 'submission-guide';
        
        // Create email section
        const emailSection = document.createElement('div');
        emailSection.className = 'submission-contact';
        emailSection.innerHTML = `
            <h5>📧 Send your scene to:</h5>
            <div class="email-box">
                <code>${submissionData.email}</code>
            </div>
        `;
        const emailCopyBtn = document.createElement('button');
        emailCopyBtn.className = 'copy-btn';
        emailCopyBtn.title = 'Copy email';
        emailCopyBtn.innerHTML = '<i class="fas fa-copy"></i>';
        emailCopyBtn.addEventListener('click', () => copyToClipboard(submissionData.email));
        emailSection.querySelector('.email-box').appendChild(emailCopyBtn);
        
        // Create format section
        const formatSection = document.createElement('div');
        formatSection.className = 'format-guide';
        formatSection.innerHTML = `
            <h5>📝 Required Format:</h5>
            <div class="format-box">
                <pre>${submissionData.format}</pre>
            </div>
        `;
        const formatCopyBtn = document.createElement('button');
        formatCopyBtn.className = 'copy-btn';
        formatCopyBtn.title = 'Copy format';
        formatCopyBtn.innerHTML = '<i class="fas fa-copy"></i>';
        formatCopyBtn.addEventListener('click', () => copyToClipboard(submissionData.format));
        formatSection.querySelector('.format-box').appendChild(formatCopyBtn);
        
        // Create example section
        const exampleSection = document.createElement('div');
        exampleSection.className = 'example-submission';
        exampleSection.innerHTML = `
            <h5>📋 Example Submission:</h5>
            <div class="example-box">
                <pre>${submissionData.example}</pre>
            </div>
        `;
        const exampleCopyBtn = document.createElement('button');
        exampleCopyBtn.className = 'copy-btn';
        exampleCopyBtn.title = 'Copy example';
        exampleCopyBtn.innerHTML = '<i class="fas fa-copy"></i>';
        exampleCopyBtn.addEventListener('click', () => copyToClipboard(submissionData.example));
        exampleSection.querySelector('.example-box').appendChild(exampleCopyBtn);
        
        // Create tips section
        const tipsSection = document.createElement('div');
        tipsSection.className = 'submission-tips';
        tipsSection.innerHTML = `
            <h5>💡 Pro Tips:</h5>
            <ul>
                <li><strong>Exact usernames:</strong> Use case-sensitive Fightcade usernames</li>
                <li><strong>Community spirit:</strong> Add a fun description to represent your scene! Maybe a link to your community's website, stream, or social media</li>
                <li><strong>Review process:</strong> Scenes are manually reviewed and added within 24-48 hours</li>
                <li><strong>Updates:</strong> Send updates to add/remove players anytime</li>
                <li><strong>Future:</strong> I am working on adding more features. Hopefully this process can become more automated in the future.</li>
            </ul>
        `;
        
        // Append all sections
        submissionGuide.appendChild(emailSection);
        submissionGuide.appendChild(formatSection);
        submissionGuide.appendChild(exampleSection);
        submissionGuide.appendChild(tipsSection);
        
        submissionInfoContent.appendChild(submissionGuide);
        
        submissionInfoSection.classList.remove('hidden');
    } catch (error) {
        console.error('Error loading submission info:', error);
        showMessage('Error loading submission info', 'error');
    }
}

// Helper function to copy text to clipboard
function copyToClipboard(text) {
    if (navigator.clipboard && window.isSecureContext) {
        navigator.clipboard.writeText(text).then(() => {
            showMessage('✅ Copied to clipboard!', 'success');
        }).catch(err => {
            console.error('Failed to copy: ', err);
            showMessage('Failed to copy to clipboard', 'error');
        });
    } else {
        // Fallback for older browsers
        const textArea = document.createElement('textarea');
        textArea.value = text;
        textArea.style.position = 'absolute';
        textArea.style.left = '-999999px';
        document.body.appendChild(textArea);
        textArea.select();
        try {
            document.execCommand('copy');
            showMessage('✅ Copied to clipboard!', 'success');
        } catch (err) {
            console.error('Failed to copy: ', err);
            showMessage('Failed to copy to clipboard', 'error');
        }
        document.body.removeChild(textArea);
    }
}

function hideSubmissionInfo() {
    submissionInfoSection.classList.add('hidden');
}

function showSceneLoading(show) {
    if (show) {
        sceneLoadingSpinner.classList.remove('hidden');
    } else {
        sceneLoadingSpinner.classList.add('hidden');
    }
}

// Statistics Page Functionality 📊

// Statistics DOM elements
const statsGameSelect = document.getElementById('statsGameSelect');
const loadStatsBtn = document.getElementById('loadStatsBtn');
const statsLoadingSpinner = document.getElementById('statsLoadingSpinner');

// Overview elements
const globalOverviewSection = document.getElementById('globalOverviewSection');
const totalPlayersCount = document.getElementById('totalPlayersCount');
const totalCountriesCount = document.getElementById('totalCountriesCount');
const averageRank = document.getElementById('averageRank');
const totalMatches = document.getElementById('totalMatches');

// Chart elements
const rankDistributionSection = document.getElementById('rankDistributionSection');
const rankPieChart = document.getElementById('rankPieChart');
const countryStatsSection = document.getElementById('countryStatsSection');
const countryChartCanvas = document.getElementById('countryChart');
const countrySelector = document.getElementById('countrySelector');
const countryTopPlayers = document.getElementById('countryTopPlayers');

// Advanced stats elements
const advancedStatsSection = document.getElementById('advancedStatsSection');
const activePlayersCount = document.getElementById('activePlayersCount');
const avgMatchesPerPlayer = document.getElementById('avgMatchesPerPlayer');
const totalHoursPlayed = document.getElementById('totalHoursPlayed');
const elitePlayerCount = document.getElementById('elitePlayerCount');
const eliteCountriesCount = document.getElementById('eliteCountriesCount');
const topEliteCountry = document.getElementById('topEliteCountry');

// Rank count elements
const sRankCount = document.getElementById('sRankCount');
const aRankCount = document.getElementById('aRankCount');
const bRankCount = document.getElementById('bRankCount');
const cRankCount = document.getElementById('cRankCount');
const dRankCount = document.getElementById('dRankCount');
const eRankCount = document.getElementById('eRankCount');

async function initializeStatisticsPage() {
    console.log('🎮 Initializing Statistics Page...');
    
    // Load available games for statistics
    await loadStatsGames();
    
    // Set default game to Street Fighter III: 3rd Strike if available
    const sfiii3Option = Array.from(statsGameSelect.options).find(option => 
        option.value === 'sfiii3nr1' || option.textContent.includes('Street Fighter III')
    );
    
    if (sfiii3Option) {
        statsGameSelect.value = sfiii3Option.value;
        loadStatsBtn.disabled = false;
        console.log('🥊 Auto-selected Street Fighter III: 3rd Strike');
    }
}

async function loadStatsGames() {
    try {
        const response = await fetch('/api/statistics/games');
        const data = await response.json();
        
        // Clear existing options
        statsGameSelect.innerHTML = '<option value="">Select a game for statistics...</option>';
        
        // Add games to select
        data.games.forEach(game => {
            const option = document.createElement('option');
            option.value = game.gameId;
            option.textContent = game.gameName;
            statsGameSelect.appendChild(option);
        });
        
        console.log(`📊 Loaded ${data.games.length} games for statistics`);
    } catch (error) {
        console.error('Error loading stats games:', error);
        showMessage('Failed to load available games', 'error');
    }
}

async function loadStatistics() {
    const gameId = statsGameSelect.value;
    if (!gameId) {
        showMessage('Please select a game first', 'warning');
        return;
    }
    
    showStatsLoading(true);
    hideStatsSections();
    
    try {
        console.log(`📊 Loading statistics for ${gameId}...`);
        const response = await fetch(`/api/statistics/${gameId}`);
        const data = await response.json();
        
        if (!response.ok) {
            throw new Error(data.error || 'Failed to load statistics');
        }
        
        currentStatistics = data.statistics;
        console.log('✅ Statistics loaded successfully:', currentStatistics);
        
        // Display all statistics sections
        displayGlobalOverview(currentStatistics);
        displayRankDistribution(currentStatistics.rankDistribution);
        displayCountryStats(currentStatistics.countryStats, currentStatistics.topPlayersByCountry);
        displayAdvancedStats(currentStatistics.advancedStats);
        
        showStatsSections();
        
        
    } catch (error) {
        console.error('Error loading statistics:', error);
        showMessage(error.message || 'Failed to load statistics', 'error');
    } finally {
        showStatsLoading(false);
    }
}

function displayGlobalOverview(stats) {
    totalPlayersCount.textContent = stats.totalPlayers.toLocaleString();
    totalCountriesCount.textContent = stats.totalCountries.toLocaleString();
    averageRank.textContent = stats.averageRank;
    totalMatches.textContent = stats.totalMatches.toLocaleString();
}

function displayRankDistribution(rankDistribution) {
    // Update rank counts in legend
    rankDistribution.forEach(rank => {
        const countElement = document.getElementById(`${rank.tier.toLowerCase()}RankCount`);
        if (countElement) {
            countElement.textContent = `${rank.count} (${rank.percentage}%)`;
        }
    });
    
    // Create pie chart
    const ctx = rankPieChart.getContext('2d');
    
    // Destroy existing chart if it exists
    if (rankChart) {
        rankChart.destroy();
    }
    
    const chartData = {
        labels: rankDistribution.map(r => `${r.tier} Tier`),
        datasets: [{
            data: rankDistribution.map(r => r.count),
            backgroundColor: [
                '#a55eea', // E - Purple
                '#eb4d4b', // D - Red
                '#f9ca24', // C - Yellow
                '#45b7d1', // B - Blue
                '#4ecdc4', // A - Teal
                '#ff6b6b'  // S - Red-Orange
            ],
            borderColor: '#2d3748',
            borderWidth: 2,
            hoverBorderWidth: 3
        }]
    };
    
    rankChart = new Chart(ctx, {
        type: 'pie',
        data: chartData,
        options: {
            responsive: true,
            maintainAspectRatio: true,
            plugins: {
                legend: {
                    display: false // We have our custom legend
                },
                tooltip: {
                    callbacks: {
                        label: function(context) {
                            const rank = rankDistribution[context.dataIndex];
                            return `${rank.tier} Tier: ${rank.count} players (${rank.percentage}%)`;
                        }
                    }
                }
            }
        }
    });
}

function displayCountryStats(countryStats, topPlayersByCountry) {
    // Populate country selector
    countrySelector.innerHTML = '<option value="">Select a country...</option>';
    countryStats.slice(0, 20).forEach(country => { // Top 20 countries
        const option = document.createElement('option');
        option.value = country.country;
        option.textContent = `${country.country} (${country.playerCount} players)`;
        countrySelector.appendChild(option);
    });
    
    // Create country distribution chart (top 10)
    const ctx = countryChartCanvas.getContext('2d');
    
    if (countryChart) {
        countryChart.destroy();
    }
    
    const top10Countries = countryStats.slice(0, 10);
    
    countryChart = new Chart(ctx, {
        type: 'bar',
        data: {
            labels: top10Countries.map(c => c.country),
            datasets: [{
                label: 'Number of Players',
                data: top10Countries.map(c => c.playerCount),
                backgroundColor: 'rgba(66, 153, 225, 0.6)',
                borderColor: 'rgba(66, 153, 225, 1)',
                borderWidth: 2
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: true,
            scales: {
                y: {
                    beginAtZero: true,
                    ticks: {
                        color: '#cbd5e0'
                    },
                    grid: {
                        color: 'rgba(203, 213, 224, 0.1)'
                    }
                },
                x: {
                    ticks: {
                        color: '#cbd5e0',
                        maxRotation: 45
                    },
                    grid: {
                        color: 'rgba(203, 213, 224, 0.1)'
                    }
                }
            },
            plugins: {
                legend: {
                    labels: {
                        color: '#cbd5e0'
                    }
                }
            }
        }
    });
    
    // Store reference for country selection
    window.topPlayersByCountry = topPlayersByCountry;
}

function displayCountryTopPlayers(country) {
    const players = window.topPlayersByCountry[country];
    if (!players) {
        countryTopPlayers.innerHTML = '<p>No players found for this country.</p>';
        return;
    }
    
    const playersHTML = players.map((player, index) => `
        <div class="country-player-item">
            <div class="player-rank-badge">#${player.rank}</div>
            <div class="player-info">
                <div class="player-name">${escapeHtml(player.name)}</div>
                <div class="player-stats">
                    ${player.elo} Power • ${player.totalMatches.toLocaleString()} matches • ${getRankTierName(player.fightcadeRank || 1)} Tier
                </div>
            </div>
        </div>
    `).join('');
    
    countryTopPlayers.innerHTML = playersHTML;
}

function displayAdvancedStats(advancedStats) {
    activePlayersCount.textContent = advancedStats.activePlayersCount.toLocaleString();
    avgMatchesPerPlayer.textContent = advancedStats.avgMatchesPerPlayer.toLocaleString();
    totalHoursPlayed.textContent = currentStatistics.totalHoursPlayed.toLocaleString();
    elitePlayerCount.textContent = advancedStats.elitePlayerCount.toLocaleString();
    eliteCountriesCount.textContent = advancedStats.eliteCountriesCount.toLocaleString();
    topEliteCountry.textContent = advancedStats.topEliteCountry;
}

function showStatsSections() {
    globalOverviewSection.classList.remove('hidden');
    rankDistributionSection.classList.remove('hidden');
    countryStatsSection.classList.remove('hidden');
    advancedStatsSection.classList.remove('hidden');
}

function hideStatsSections() {
    globalOverviewSection.classList.add('hidden');
    rankDistributionSection.classList.add('hidden');
    countryStatsSection.classList.add('hidden');
    advancedStatsSection.classList.add('hidden');
}

function showStatsLoading(show) {
    if (show) {
        statsLoadingSpinner.classList.remove('hidden');
    } else {
        statsLoadingSpinner.classList.add('hidden');
    }
}

function getRankTierName(fightcadeRank) {
    const tiers = ['E', 'D', 'C', 'B', 'A', 'S'];
    return tiers[fightcadeRank - 1] || 'Unknown';
}

// Country tab switching
function switchCountryTab(tabName) {
    // Update tab buttons
    document.querySelectorAll('.country-tab').forEach(tab => {
        tab.classList.remove('active');
    });
    document.querySelector(`[data-tab="${tabName}"]`).classList.add('active');
    
    // Show/hide content
    document.getElementById('topPlayersByCountry').classList.toggle('hidden', tabName !== 'top-players');
    document.getElementById('countryDistribution').classList.toggle('hidden', tabName !== 'country-distribution');
}

// Event handlers for statistics page
function onStatsGameSelect() {
    loadStatsBtn.disabled = !statsGameSelect.value;
}

function onCountrySelect() {
    const selectedCountry = countrySelector.value;
    if (selectedCountry && window.topPlayersByCountry) {
        displayCountryTopPlayers(selectedCountry);
    } else {
        countryTopPlayers.innerHTML = '<p>Select a country to view top players.</p>';
    }
}
