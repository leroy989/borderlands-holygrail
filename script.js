// --- Global Variables ---
let allItems = []; // Holds the master list of items from JSON files
let bossToLocationsMap = {};
let locationToBossesMap = {};
let currentFilters = {
    game: 'all', content: 'all', type: 'all', itemSubType: 'all',
    rarity: 'all', manufacturer: 'all', boss: 'all', enemy: 'all',
    dropSource: 'all', location: 'all', quest: 'all',
    search: ''
};
let hideCompletedActive = false;
let saveTimeoutId = null; // For debouncing save operations

// Profile System Variables
const APP_DATA_KEY = 'borderlandsAppUserData_v1'; // New key for all profile data
let appData = {
    profileNames: ['Default'],
    activeProfileName: 'Default',
    profileData: {
        'Default': {
            progress: [], // Array of { id: "uniqueStaticId", Checked: boolean, checkedTimestamp: "ISOString" | null }
            scoreSystemEnabled: false
        }
    }
};
let scoreSystemEnabled = false; // This will be set based on the active profile

const gameOrder = ['BorderlandsOne', 'BorderlandsTwo', 'BorderlandsTPS', 'BorderlandsThree', 'TinyTinasWonderlands'];
const rarityOrder = [
    'Common', 'Uncommon', 'Rare', 'Cursed', 'Epic', 'E-Tech',
    'Gemstone', 'Legendary', 'Effervescent', 'Seraph', 'Pearlescent'
];
const RARITY_POINTS = {
    'Common': 1, 'Uncommon': 3, 'Rare': 5, 'Cursed': 8, 'Epic': 10,
    'E-Tech': 12, 'Gemstone': 15, 'Legendary': 20, 'Effervescent': 25,
    'Seraph': 30, 'Pearlescent': 50
};

// --- Helper Functions ---
function capitalizeFirstLetter(string) { /* ... same as before ... */ 
    if (!string) return '';
    return string.charAt(0).toUpperCase() + string.slice(1).toLowerCase();
}
async function loadJSONData(filePath) { /* ... same as before ... */ 
    try {
        const response = await fetch(filePath);
        if (!response.ok) throw new Error(`Failed to fetch ${filePath}: ${response.status} ${response.statusText}`);
        return await response.json();
    } catch (error) {
        console.error(`Error loading JSON data from ${filePath}:`, error);
        const container = document.getElementById('item-list');
        if (container) { 
            const errorLi = document.createElement('li');
            errorLi.className = 'item-list-placeholder error-message';
            errorLi.textContent = `Failed to load game data from ${filePath}. Check console.`;
            if (container.firstChild && container.firstChild.className && container.firstChild.className.includes('item-list-placeholder')) {
                if (!container.innerHTML.includes('Failed to load game data')) { 
                    container.innerHTML += errorLi.outerHTML;
                }
            } else {
                container.innerHTML = errorLi.outerHTML;
            }
        }
        throw error; 
    }
}
function appendDropRatesToHTML(sourceObject, listHTMLString) { /* ... same as before ... */ 
    let html = listHTMLString;
    if (sourceObject.DropRates && sourceObject.DropRates.length > 0) {
        sourceObject.DropRates.forEach(dr => {
            if (dr.rate !== null && dr.rate !== undefined) {
                let currentLabel = "Drop Rate";
                if (dr.condition && dr.condition.toLowerCase() !== "base" && dr.condition.trim() !== "") {
                    currentLabel += ` (${dr.condition})`;
                }
                const rateValue = String(dr.rate);
                const rateDisplay = (rateValue.includes('%') || isNaN(parseFloat(rateValue)))
                    ? rateValue
                    : `${rateValue}%`;
                html += `<div class="source-drop-rate">${currentLabel}: ${rateDisplay}</div>`;
            }
        });
    }
    if (sourceObject.NVHMDropRate !== null && sourceObject.NVHMDropRate !== undefined) {
        html += `<div class="source-drop-rate">NVHM Drop Rate: ${sourceObject.NVHMDropRate}%</div>`;
    }
    if (sourceObject.TVHMDropRate !== null && sourceObject.TVHMDropRate !== undefined) {
        html += `<div class="source-drop-rate">TVHM Drop Rate: ${sourceObject.TVHMDropRate}%</div>`;
    }
    if (sourceObject.UVHMDropRate !== null && sourceObject.UVHMDropRate !== undefined) {
        html += `<div class="source-drop-rate">UVHM Drop Rate: ${sourceObject.UVHMDropRate}%</div>`;
    }
    return html;
}
function formatItemTimestamp(isoString) { /* ... same as before ... */ 
    if (!isoString) return '';
    try {
        const date = new Date(isoString);
        return date.toLocaleString(undefined, { 
            year: 'numeric', month: 'short', day: 'numeric', 
            hour: '2-digit', minute: '2-digit' 
        });
    } catch (e) {
        console.warn("Error formatting timestamp:", isoString, e);
        return "Invalid Date";
    }
}
function formatTimeDuration(totalMilliseconds) { /* ... same as before ... */
    if (isNaN(totalMilliseconds) || totalMilliseconds <= 0) {
        return "0m";
    }
    let seconds = Math.floor(totalMilliseconds / 1000);
    let minutes = Math.floor(seconds / 60);
    let hours = Math.floor(minutes / 60);
    let days = Math.floor(hours / 24);
    minutes %= 60;
    hours %= 24;
    let parts = [];
    if (days > 0) parts.push(days + "d");
    if (hours > 0) parts.push(hours + "h");
    if (minutes > 0 || parts.length === 0) parts.push(minutes + "m"); 
    return parts.length > 0 ? parts.join(" ") : "0m";
}

function debouncedSaveCurrentProfileProgress() {
    clearTimeout(saveTimeoutId);
    saveTimeoutId = setTimeout(() => {
        saveCurrentProfileProgress(); // This is your existing save function
    }, 750); // Adjust delay as needed (e.g., 500-1000ms)
}

// --- Profile System Functions ---
function loadAppData() {
    const storedData = localStorage.getItem(APP_DATA_KEY);
    if (storedData) {
        try {
            appData = JSON.parse(storedData);
            // Ensure essential structure exists
            if (!appData.profileNames || !appData.activeProfileName || !appData.profileData) {
                throw new Error("Stored appData is missing core properties.");
            }
            if (!appData.profileData[appData.activeProfileName]) {
                // Active profile missing, try to default or fix
                appData.activeProfileName = appData.profileNames[0] || 'Default';
                if (!appData.profileData[appData.activeProfileName]) {
                    appData.profileData[appData.activeProfileName] = { progress: [], scoreSystemEnabled: false };
                }
            }
        } catch (e) {
            console.error("Error parsing stored app data, resetting to default:", e);
            // Reset to default if parsing fails or structure is bad
            appData = {
                profileNames: ['Default'],
                activeProfileName: 'Default',
                profileData: {
                    'Default': { progress: [], scoreSystemEnabled: false }
                }
            };
            saveAppData(); // Save the fresh default
        }
    } else {
        // First time run or cleared storage, initialize with a default profile
        appData = {
            profileNames: ['Default'],
            activeProfileName: 'Default',
            profileData: {
                'Default': { progress: [], scoreSystemEnabled: false }
            }
        };
        saveAppData();
    }
    // Set the global scoreSystemEnabled based on the active profile
    const activeProfile = appData.profileData[appData.activeProfileName];
    scoreSystemEnabled = activeProfile ? activeProfile.scoreSystemEnabled : false;
}

function saveAppData() {
    try {
        localStorage.setItem(APP_DATA_KEY, JSON.stringify(appData));
    } catch (e) {
        console.error("Error saving app data to localStorage:", e);
    }
}

function getActiveProfileData() {
    if (appData.activeProfileName && appData.profileData[appData.activeProfileName]) {
        return appData.profileData[appData.activeProfileName];
    }
    // Fallback to a new default if something is wrong, though loadAppData should prevent this
    console.warn("Active profile data not found, returning empty default. Active:", appData.activeProfileName);
    return { progress: [], scoreSystemEnabled: false }; 
}

function applyActiveProfileToAllItems() {
    const activeProfile = getActiveProfileData();
    allItems.forEach(item => {
        const savedItemState = activeProfile.progress.find(pItem => pItem.id === item.id);
        if (savedItemState) {
            item.Checked = savedItemState.Checked;
            item.checkedTimestamp = savedItemState.checkedTimestamp || null;
        } else {
            item.Checked = false;
            item.checkedTimestamp = null;
        }
    });
    // Update global scoreSystemEnabled from the active profile
    scoreSystemEnabled = activeProfile.scoreSystemEnabled;
    const scoreToggle = document.getElementById('toggle-score-system');
    if (scoreToggle) {
        scoreToggle.checked = scoreSystemEnabled;
    }
}

function isProfileNameValidAndUnique(name) {
    const trimmedName = name.trim();
    if (!trimmedName) {
        alert("Profile name cannot be empty.");
        return false;
    }
    if (appData.profileNames.includes(trimmedName)) {
        alert(`Profile name "${trimmedName}" already exists.`);
        return false;
    }
    if (trimmedName.length > 30) { // Arbitrary length limit
        alert("Profile name is too long (max 30 characters).");
        return false;
    }
    return trimmedName;
}

function populateProfileDropdown() {
    const profileSelect = document.getElementById('profile-select');
    if (!profileSelect) return;
    profileSelect.innerHTML = '';
    appData.profileNames.forEach(name => {
        const option = document.createElement('option');
        option.value = name;
        option.textContent = name;
        profileSelect.appendChild(option);
    });
    profileSelect.value = appData.activeProfileName;
    
    const progressPanelTitle = document.getElementById('progress-panel-title');
    if (progressPanelTitle) {
        progressPanelTitle.textContent = `${appData.activeProfileName}'s Progress`;
    }
}

function handleCreateProfile() {
    const newProfileName = prompt("Enter name for new profile:");
    if (newProfileName) {
        const validatedName = isProfileNameValidAndUnique(newProfileName);
        if (validatedName) {
            appData.profileNames.push(validatedName);
            appData.profileData[validatedName] = {
                progress: [],
                scoreSystemEnabled: false // Default setting for new profile
            };
            handleSwitchProfile(validatedName); // Switch to and save the new profile
        }
    }
}

function handleDeleteProfile() {
    if (appData.profileNames.length <= 1) {
        alert("Cannot delete the last profile.");
        return;
    }
    const profileNameToDelete = appData.activeProfileName;
    if (confirm(`Are you sure you want to delete profile "${profileNameToDelete}"? This action cannot be undone.`)) {
        // Remove from names list
        appData.profileNames = appData.profileNames.filter(name => name !== profileNameToDelete);
        // Delete data
        delete appData.profileData[profileNameToDelete];
        // Switch to the first available profile (or 'Default' if it exists, otherwise first in list)
        const newActiveProfile = appData.profileNames.includes('Default') ? 'Default' : appData.profileNames[0];
        handleSwitchProfile(newActiveProfile); // This will save and refresh
    }
}

function handleSwitchProfile(profileName) {
    if (appData.profileNames.includes(profileName)) {
        appData.activeProfileName = profileName;
        saveAppData(); // Save the new active profile name first
        
        // Reset filters to avoid state bleed from previous profile's context
        currentFilters = { game: 'all', content: 'all', type: 'all', itemSubType: 'all', rarity: 'all', manufacturer: 'all', boss: 'all', enemy: 'all', dropSource: 'all', location: 'all', quest: 'all', search: '' };
        const filterSelectElements = document.querySelectorAll('#filter-collapsible-content select');
        filterSelectElements.forEach(sel => sel.value = 'all');
        const searchInputEl = document.getElementById('search-input');
        if (searchInputEl) searchInputEl.value = '';

        // Re-apply profile data to allItems and refresh UI
        applyActiveProfileToAllItems(); 
        populateProfileDropdown(); // Update dropdown selection
        initializeFilters(); // Re-init filters based on potentially different allItems stats (though allItems content is fixed)
        renderItems(); // This will re-render cards and update summary
    } else {
        console.error("Attempted to switch to non-existent profile:", profileName);
    }
}

function setupProfileControls() {
    const profileSelect = document.getElementById('profile-select');
    const createBtn = document.getElementById('create-profile-btn');
    const deleteBtn = document.getElementById('delete-profile-btn');

    if (profileSelect) {
        populateProfileDropdown();
        profileSelect.addEventListener('change', (e) => handleSwitchProfile(e.target.value));
    }
    if (createBtn) {
        createBtn.addEventListener('click', handleCreateProfile);
    }
    if (deleteBtn) {
        deleteBtn.addEventListener('click', handleDeleteProfile);
    }
}


// --- Core Application Logic ---
function createItemListItem(item) { /* ... Modified for timestamp, ensure no other profile-specific display needed here without state ... */ 
    const listItem = document.createElement('li');
    let rarityCardClass = item.ItemRarity.toLowerCase().replace(/\s+/g, '-');
    if (item.ItemRarity === 'E-Tech') { // Ensure CSS class for E-Tech is 'e-tech'
        rarityCardClass = 'e-tech';
    }
    
    listItem.className = `item-card ${rarityCardClass}`;
    listItem.setAttribute('data-item-id', item.id); 

    if (item.Checked) { listItem.classList.add('card-is-checked'); }
    if (item.isTimeLimited) { listItem.classList.add('time-limited-item'); if (!item.Checked) { listItem.classList.add('unavailable-and-not-checked');}}

    let infoAreaHTML = '';
    let gameIconHTML = '';
    if (item.Game) {
        let iconFileName = '';
        switch (item.Game) {
            case 'BorderlandsOne': iconFileName = 'BL1Icon.png'; break;
            case 'BorderlandsTwo': iconFileName = 'BL2Icon.png'; break;
            case 'BorderlandsTPS': iconFileName = 'BLTPSIcon.png'; break;
            case 'BorderlandsThree': iconFileName = 'BL3Icon.png'; break;
            case 'TinyTinasWonderlands': iconFileName = 'Tinalcon.png'; break;
        }
        if (iconFileName) { gameIconHTML = `<div class="game-icon-container"><img src="icons/games/${iconFileName}" alt="${item.Game} Icon" class="game-icon"></div>`;}
    }
    infoAreaHTML += gameIconHTML;

    function addInlineInfo(label, value) { if (value && (typeof value === 'string' ? value.trim() !== '' : true) ) { infoAreaHTML += `<div class="info-line"><span class="info-label">${label}:</span> <span class="info-value">${value}</span></div>`;}}
    function addBlockInfo(label, contentHTML) { if (contentHTML && contentHTML.trim() !== '') { infoAreaHTML += `<h3>${label}:</h3>${contentHTML}`;}}
    addInlineInfo("Type", (item.ItemType && item.ItemType !== 'Unknown Type' ? item.ItemType : null));
    if (item.ItemSubType && item.ItemSubType.trim() !== '') { addInlineInfo("Sub Type", item.ItemSubType); }
    addInlineInfo("Rarity", item.ItemRarity); 
    addInlineInfo("Content", item.Content);
    if (item.isTimeLimited && !item.Checked) { addInlineInfo("Availability", "<span style='color: #FF9800;'>Time-Limited (Currently Unobtainable)</span>");}
    const elementsArray = (item.Elements && Array.isArray(item.Elements) && item.Elements.length > 0) ? item.Elements.filter(el => el && String(el).trim() !== '') : [];
    if (elementsArray.length > 0) { const iconsHTML = elementsArray.map(el => `<span class="element-icon icon-${String(el).toLowerCase().replace(/\s+/g, '-').replace(/[^\w-]+/g, '')}" title="${String(el)}"></span>`).join(''); if (iconsHTML.trim() !== '') { addInlineInfo("Elements", `<span class="element-icons-container-inline">${iconsHTML}</span>`);}}
    if (item.QuestSources && item.QuestSources.length > 0) { let questListItems = ''; item.QuestSources.forEach(qs => { const questName = qs.QuestName; const questLocation = qs.QuestLocation; const questGiver = qs.QuestGiver; const questType = qs.QuestType; if (questName) { questListItems += `<li><strong>${questName}</strong>`; if (questLocation) { questListItems += `<div class="source-location-detail">Location: ${questLocation}</div>`; } if (questType) { questListItems += `<div class="source-location-detail">Type: ${questType}</div>`; } if (questGiver) { questListItems += `<div class="source-location-detail">Giver: ${questGiver}</div>`; } questListItems = appendDropRatesToHTML(qs, questListItems); questListItems += `</li>`; }}); if (questListItems) {addBlockInfo("Quest", `<ul>${questListItems}</ul>`);}}
    if (item.EnemyLocations && item.EnemyLocations.length > 0) { let enemyListItems = ''; item.EnemyLocations.forEach(el => { const enemyName = el.EnemyName; const locationName = el.LocationName; const respawns = el.respawns; if (enemyName) { const prefix = el.isUniqueEnemy ? "<strong>Unique:</strong> " : ""; enemyListItems += `<li>${prefix}<strong>${enemyName}</strong>`; if (!respawns) { enemyListItems += `<span class="no-respawn-text"> (Doesn't Respawn)</span>`; } if (locationName) { enemyListItems += `<div class="source-location-detail">Location: ${locationName}</div>`; } enemyListItems = appendDropRatesToHTML(el, enemyListItems); enemyListItems += `</li>`; } }); if (enemyListItems) { addBlockInfo("Enemy", `<ul>${enemyListItems}</ul>`);}}
    if (item.BossLocations && item.BossLocations.length > 0) { let bossListItems = ''; item.BossLocations.forEach(bl => { const bossName = bl.BossName; const locationName = bl.LocationName; const respawns = bl.respawns; if (bossName) { bossListItems += `<li><strong>${bossName}</strong>`; if (!respawns) { bossListItems += `<span class="no-respawn-text"> (Doesn't Respawn)</span>`; } if (locationName) { bossListItems += `<div class="source-location-detail">Location: ${locationName}</div>`; } bossListItems = appendDropRatesToHTML(bl, bossListItems); bossListItems += `</li>`; } }); if (bossListItems) { addBlockInfo("Boss", `<ul>${bossListItems}</ul>`);}}
    if (item.GeneralLocations && Array.isArray(item.GeneralLocations) && item.GeneralLocations.length > 0) { let generalListItems = ''; item.GeneralLocations.forEach(gl => { if (gl && typeof gl === 'object') { const sourceName = gl.Source; const locationName = gl.Location; if (sourceName || locationName) { generalListItems += `<li>`; if(sourceName) generalListItems += `<strong>${sourceName}</strong>`; else if(locationName) generalListItems += `<strong>${locationName}</strong>`; if (sourceName && locationName) { generalListItems += `<div class="source-location-detail">Location: ${locationName}</div>`;} generalListItems = appendDropRatesToHTML(gl, generalListItems); generalListItems += `</li>`;}}}); if (generalListItems.trim() !== '') {addBlockInfo("Also Found In", `<ul>${generalListItems}</ul>`);}}
    if (item.Notes && item.Notes.trim() !== '') { addBlockInfo("Notes", `<p class="note-text">${item.Notes}</p>`);}

    if (item.Checked && item.checkedTimestamp) {
        infoAreaHTML += `<div class="item-checked-timestamp">Found: ${formatItemTimestamp(item.checkedTimestamp)}</div>`;
    }

    const manufacturerText = (item.Manufacturer && item.Manufacturer.length > 0) ? `Manufacturer: ${item.Manufacturer.join(' / ')}` : '';
    const pointsDisplayHTML = (scoreSystemEnabled && typeof item.points === 'number' && item.points > 0) ? `<span class="item-points">${item.points} PTS</span>` : '';
    const nameplateClasses = `name-plate ${rarityCardClass}${pointsDisplayHTML ? ' has-points' : ''}`;

    listItem.innerHTML = `
        <div class="item-card-inner">
            <div class="${nameplateClasses}">
                ${pointsDisplayHTML}
                <span class="item-name-text">${item.ItemName}</span>
            </div>
            <div class="info-area">
                ${infoAreaHTML}
            </div>
            ${manufacturerText ? `<div class="manufacturer-bar">${manufacturerText}</div>` : '<div class="manufacturer-bar" style="padding:0; border:none; height:0;"></div>'}
        </div>
    `;

    listItem.addEventListener('click', () => {
        item.Checked = !item.Checked;
        if (item.Checked) { item.checkedTimestamp = new Date().toISOString(); } else { item.checkedTimestamp = null; }
        listItem.classList.toggle('card-is-checked', item.Checked);
        if(item.isTimeLimited) { listItem.classList.toggle('unavailable-and-not-checked', !item.Checked); }
        debouncedSaveCurrentProfileProgress(); // Modified to save to active profile
        renderItems(); 
    });
    return listItem;
}

function populateFilterDropdown(selectElement, uniqueValues, category, activeValue, sortFunction = null) { /* ... same as before ... */ 
    if (!selectElement) return;
    selectElement.innerHTML = ''; 
    const allOption = document.createElement('option');
    allOption.value = 'all';
    allOption.textContent = 'All';
    selectElement.appendChild(allOption);

    if (sortFunction) { 
        uniqueValues.sort(sortFunction);
    } else if (uniqueValues.every(val => typeof val === 'string')) { 
        uniqueValues.sort((a, b) => a.localeCompare(b));
    } 
    uniqueValues.forEach(value => {
        const option = document.createElement('option');
        option.value = String(value); 
        if (category === 'game') { 
            if (value === "BorderlandsOne") option.textContent = "BL1";
            else if (value === "BorderlandsTwo") option.textContent = "BL2";
            else if (value === "BorderlandsTPS") option.textContent = "BL:TPS";
            else if (value === "BorderlandsThree") option.textContent = "BL3";
            else if (value === "TinyTinasWonderlands") option.textContent = "Wonderlands";
            else option.textContent = capitalizeFirstLetter(String(value));
        } else if (category === 'rarity') { 
            option.textContent = String(value); 
        } else { 
            option.textContent = String(value);
        }
        selectElement.appendChild(option);
    });
    selectElement.value = activeValue;
}
const getUniqueValues = (items, field, isMultiValueProperty = true) => { /* ... same as before ... */ 
    let values = new Set();
    items.forEach(item => {
        const itemFieldValue = item[field];
        if (itemFieldValue === null || itemFieldValue === undefined) return;
        if (isMultiValueProperty && Array.isArray(itemFieldValue)) {
            itemFieldValue.forEach(val => {
                if (val !== null && val !== undefined && String(val).trim() !== '') values.add(String(val).trim());
            });
        } else if (String(itemFieldValue).trim() !== '') {
            values.add(String(itemFieldValue).trim());
        }
    });
    return Array.from(values); 
};
const getFilteredItemsForOptions = (excludeCategory) => { /* ... same as before ... */ 
    return allItems.filter(item => {
        if (!item || !item.Game) return false; 
        const gameMatch = (excludeCategory === 'game' || currentFilters.game === 'all') || item.Game === currentFilters.game;
        const contentMatch = (excludeCategory === 'content' || currentFilters.content === 'all') || item.Content === currentFilters.content;
        const typeMatch = (excludeCategory === 'type' || currentFilters.type === 'all') || item.ItemType === currentFilters.type;
        const subTypeMatch = (excludeCategory === 'itemSubType' || currentFilters.itemSubType === 'all') || item.ItemSubType === currentFilters.itemSubType;
        const rarityMatch = (excludeCategory === 'rarity' || currentFilters.rarity === 'all') || item.ItemRarity === currentFilters.rarity;
        const manufacturerMatch = (excludeCategory === 'manufacturer' || currentFilters.manufacturer === 'all') || (Array.isArray(item.Manufacturer) && item.Manufacturer.includes(currentFilters.manufacturer));
        let bossFilterMatch = (excludeCategory === 'boss' || currentFilters.boss === 'all') || (Array.isArray(item.Boss) && item.Boss.includes(currentFilters.boss));
        let enemyFilterMatch = (excludeCategory === 'enemy' || currentFilters.enemy === 'all') || (Array.isArray(item.EnemyNames) && item.EnemyNames.includes(currentFilters.enemy));
        let locationFilterMatch = (excludeCategory === 'location' || currentFilters.location === 'all') || (Array.isArray(item.Location) && item.Location.includes(currentFilters.location));
        let finalDropSourceMatch;
        if (excludeCategory === 'dropSource' || currentFilters.dropSource === 'all') { finalDropSourceMatch = true; } else if (currentFilters.dropSource === 'Missable') { finalDropSourceMatch = item.isMissableItem === true; } else { finalDropSourceMatch = (Array.isArray(item.DropSource) && item.DropSource.includes(currentFilters.dropSource));}
        const questMatch = (excludeCategory === 'quest' || currentFilters.quest === 'all') || (Array.isArray(item.QuestNames) && item.QuestNames.includes(currentFilters.quest));
        if (currentFilters.location !== 'all' && !['location', 'boss', 'enemy', 'quest', 'itemSubType'].includes(excludeCategory) ) { let isValid = (item.BossLocations && item.BossLocations.some(bl => bl.LocationName === currentFilters.location)) || (item.EnemyLocations && Array.isArray(item.EnemyLocations) && item.EnemyLocations.some(el => el.LocationName === currentFilters.location)) || (item.QuestSources && Array.isArray(item.QuestSources) && item.QuestSources.some(qs => qs.QuestLocation === currentFilters.location)) || (item.GeneralLocations && Array.isArray(item.GeneralLocations) && item.GeneralLocations.some(gl => gl.Location === currentFilters.location)); if (!isValid) return false;}
        if (currentFilters.boss !== 'all' && !['boss', 'location', 'enemy', 'quest', 'itemSubType'].includes(excludeCategory)) { if (!(item.BossLocations && item.BossLocations.some(bl => bl.BossName === currentFilters.boss))) return false;}
        let searchMatch = true;
        if (currentFilters.search !== '') { const s = currentFilters.search.toLowerCase(); searchMatch = ['ItemName', 'ItemType', 'ItemSubType', 'Content', 'Challenge', 'Notes'].some(p => item[p] && String(item[p]).toLowerCase().includes(s)) || (item.QuestNames && item.QuestNames.some(qn => qn.toLowerCase().includes(s))) || (item.EnemyNames && item.EnemyNames.some(en => en.toLowerCase().includes(s))) || ['Manufacturer', 'DropSource', 'Boss', 'Location', 'Elements'].some(p => item[p] && Array.isArray(item[p]) && item[p].some(val => String(val).toLowerCase().includes(s)));}
        return gameMatch && contentMatch && typeMatch && subTypeMatch && rarityMatch && manufacturerMatch && bossFilterMatch && enemyFilterMatch && finalDropSourceMatch && locationFilterMatch && questMatch && searchMatch;
    });
};
function populateDynamicFilters() { /* ... same as before, uses localeCompare for most sorts ... */ 
    const { game, content, type, itemSubType, rarity, manufacturer, boss, enemy, dropSource, location, quest } = currentFilters;
    populateFilterDropdown(document.getElementById('content-filter-select'), getUniqueValues(getFilteredItemsForOptions('content'), 'Content', false), 'content', content); 
    populateFilterDropdown(document.getElementById('type-filter-select'), getUniqueValues(getFilteredItemsForOptions('type'), 'ItemType', false), 'type', type);
    populateFilterDropdown(document.getElementById('subtype-filter-select'), getUniqueValues(getFilteredItemsForOptions('itemSubType'), 'ItemSubType', false).filter(st => st !== null && st !== ''), 'itemSubType', itemSubType);
    populateFilterDropdown(document.getElementById('rarity-filter-select'), getUniqueValues(getFilteredItemsForOptions('rarity'), 'ItemRarity', false), 'rarity', rarity, (a, b) => rarityOrder.indexOf(a) - rarityOrder.indexOf(b)); 
    populateFilterDropdown(document.getElementById('manufacturer-filter-select'), getUniqueValues(getFilteredItemsForOptions('manufacturer'), 'Manufacturer'), 'manufacturer', manufacturer);
    const itemsForBoss = getFilteredItemsForOptions('boss');
    let uniqueBosses = (currentFilters.location !== 'all' && locationToBossesMap[currentFilters.location]) ? Array.from(new Set(itemsForBoss.flatMap(item => Array.isArray(item.Boss) ? item.Boss : []).filter(bName => locationToBossesMap[currentFilters.location].includes(bName)))).sort((a,b) => a.localeCompare(b)) : getUniqueValues(itemsForBoss, 'Boss').sort((a,b) => a.localeCompare(b));
    populateFilterDropdown(document.getElementById('boss-filter-select'), uniqueBosses, 'boss', boss); 
    const itemsForEnemy = getFilteredItemsForOptions('enemy');
    const uniqueEnemies = getUniqueValues(itemsForEnemy, 'EnemyNames', true).sort((a,b) => a.localeCompare(b));
    populateFilterDropdown(document.getElementById('enemy-filter-select'), uniqueEnemies, 'enemy', enemy); 
    const itemsRelevantForDropSourceFilter = getFilteredItemsForOptions('dropSource');
    let uniqueDropSources = getUniqueValues(itemsRelevantForDropSourceFilter, 'DropSource').sort((a,b) => a.localeCompare(b));
    if (itemsRelevantForDropSourceFilter.some(item => item.isMissableItem === true) && !uniqueDropSources.includes('Missable')) { uniqueDropSources.push('Missable'); uniqueDropSources.sort((a,b) => a.localeCompare(b));}
    populateFilterDropdown(document.getElementById('drop-source-filter-select'), uniqueDropSources, 'dropSource', currentFilters.dropSource); 
    const itemsForLocation = getFilteredItemsForOptions('location').filter(item => item.LocationFilter === true || (item.GeneralLocations && item.GeneralLocations.some(gl => gl.Location)));
    let uniqueLocations;
    if (currentFilters.boss !== 'all' && bossToLocationsMap[currentFilters.boss]) { uniqueLocations = Array.from(new Set(itemsForLocation.flatMap(item => Array.isArray(item.Location) ? item.Location : []).filter(lName => bossToLocationsMap[currentFilters.boss].includes(lName)))).sort((a,b) => a.localeCompare(b));} else if (currentFilters.enemy !== 'all') { const enemyLocationsSet = new Set(); allItems.forEach(item => { if (item.EnemyNames && item.EnemyNames.includes(currentFilters.enemy)) { if (item.EnemyLocations) { item.EnemyLocations.forEach(el => { if (el.EnemyName === currentFilters.enemy && el.LocationName) { enemyLocationsSet.add(el.LocationName);}});}}}); uniqueLocations = getUniqueValues(itemsForLocation, 'Location').filter(loc => enemyLocationsSet.has(loc)).sort((a,b) => a.localeCompare(b));} else { uniqueLocations = getUniqueValues(itemsForLocation, 'Location').sort((a,b) => a.localeCompare(b));}
    populateFilterDropdown(document.getElementById('location-filter-select'), uniqueLocations, 'location', location); 
    const itemsForQuest = getFilteredItemsForOptions('quest');
    const uniqueQuests = getUniqueValues(itemsForQuest, 'QuestNames', true).sort((a,b) => a.localeCompare(b));
    populateFilterDropdown(document.getElementById('quest-filter-select'), uniqueQuests, 'quest', quest); 
}
function renderItems() { /* ... same as before ... */ 
    const container = document.getElementById('item-list');
    if (!container) return;
    container.innerHTML = ''; 
    populateDynamicFilters(); 
    let finalFilteredItems = getFilteredItemsForOptions(null); 
    finalFilteredItems.sort((a, b) => a.ItemName.localeCompare(b.ItemName));
    const itemsToDisplay = hideCompletedActive ? finalFilteredItems.filter(item => !item.Checked) : finalFilteredItems;
    if (itemsToDisplay.length === 0) { container.innerHTML = `<li class="item-list-placeholder">No items found.</li>`; } else { itemsToDisplay.forEach(item => container.appendChild(createItemListItem(item))); }
    updateSummary(finalFilteredItems); 
}
function updateSummary(filteredItems) { /* ... Modified for profile-aware score and new total time ... */ 
    const checkedCountEl = document.getElementById('checked-count');
    const totalCountEl = document.getElementById('total-count');
    const progressBarEl = document.getElementById('progress-bar');
    const progressPercentEl = document.getElementById('progress-percentage');
    const scoreDisplayContainer = document.getElementById('score-display-container');
    const totalScoreEl = document.getElementById('total-score');
    const totalTimePlayedContainer = document.getElementById('total-time-played-container');
    const totalTimePlayedEl = document.getElementById('total-time-played');

    if (!checkedCountEl || !totalCountEl || !progressBarEl || !progressPercentEl || 
        !scoreDisplayContainer || !totalScoreEl || !totalTimePlayedContainer || !totalTimePlayedEl) return;

    const displayTotalCount = filteredItems.length;
    const progressRelevantItems = filteredItems.filter(item => !item.isTimeLimited || item.Checked);
    const effectiveTotalForProgress = progressRelevantItems.length;
    const checkedProgressRelevantItems = progressRelevantItems.filter(item => item.Checked);

    const percentage = effectiveTotalForProgress > 0 ? (checkedProgressRelevantItems.length / effectiveTotalForProgress) * 100 : 0;

    checkedCountEl.textContent = checkedProgressRelevantItems.length;
    totalCountEl.textContent = displayTotalCount;
    progressBarEl.style.width = `${percentage}%`;
    progressPercentEl.textContent = `${Math.round(percentage)}%`;
    
    // Score system is now based on global scoreSystemEnabled (set by active profile)
    if (scoreSystemEnabled) {
        let currentScore = 0;
        checkedProgressRelevantItems.forEach(item => { currentScore += (item.points || 0); });
        totalScoreEl.textContent = currentScore;
        scoreDisplayContainer.style.display = 'block';
    } else {
        scoreDisplayContainer.style.display = 'none';
    }

    const allCheckedItemsInCurrentProfile = allItems
        .filter(item => item.Checked && item.checkedTimestamp);
        
    if (allCheckedItemsInCurrentProfile.length >= 1) { 
        const timestamps = allCheckedItemsInCurrentProfile.map(item => new Date(item.checkedTimestamp).getTime());
        const minTimestamp = Math.min(...timestamps);
        const maxTimestamp = Math.max(...timestamps);
        const durationMs = (allCheckedItemsInCurrentProfile.length > 1) ? (maxTimestamp - minTimestamp) : 0;
        
        totalTimePlayedEl.textContent = formatTimeDuration(durationMs);
        totalTimePlayedContainer.style.display = 'block';
    } else {
        totalTimePlayedEl.textContent = "0m"; 
        totalTimePlayedContainer.style.display = 'none'; 
    }
}

// Modified saveProgress to saveCurrentProfileProgress
function saveCurrentProfileProgress() {
    const activeProfile = getActiveProfileData();
    if (activeProfile) {
        activeProfile.progress = allItems
            .filter(i => i.id && (i.Checked || i.checkedTimestamp)) // Save if checked or has a timestamp (in case it was just unchecked)
            .map(i => ({
                id: i.id,
                Checked: i.Checked,
                checkedTimestamp: i.checkedTimestamp
            }));
        saveAppData();
    } else {
        console.error("No active profile found to save progress.");
    }
}

// loadProgress is now handled by applyActiveProfileToAllItems

function initializeFilters() { /* ... same as before ... */ 
    const filterSelects = document.querySelectorAll('select[data-filter-category]');
    filterSelects.forEach(select => {
        select.value = currentFilters[select.dataset.filterCategory] || 'all'; 
        select.addEventListener('change', event => {
            const category = event.target.dataset.filterCategory;
            const value = event.target.value;
            currentFilters[category] = value;
            if (category === 'game') { ['content', 'type', 'itemSubType', 'rarity', 'manufacturer', 'boss', 'enemy', 'dropSource', 'location', 'quest'].forEach(c => currentFilters[c] = 'all'); } else if (category === 'content') { ['type', 'itemSubType', 'rarity', 'manufacturer', 'boss', 'enemy', 'dropSource', 'location', 'quest'].forEach(c => currentFilters[c] = 'all'); } else if (category === 'type') { currentFilters.itemSubType = 'all';}
            renderItems(); 
        });
    });
    const gameSelect = document.getElementById('game-filter-select');
    if (gameSelect) { populateFilterDropdown(gameSelect, getUniqueValues(allItems, 'Game', false), 'game', currentFilters.game, (a,b) => gameOrder.indexOf(a) - gameOrder.indexOf(b));}
    const searchInput = document.getElementById('search-input');
    if(searchInput) { searchInput.value = currentFilters.search || ''; searchInput.addEventListener('input', e => { currentFilters.search = e.target.value.trim(); renderItems(); });}
}
function setupHideCompletedButton() { /* ... same as before ... */ 
    const btn = document.getElementById('hide-completed-button');
    if(btn) { btn.classList.toggle('active', hideCompletedActive); btn.textContent = hideCompletedActive ? 'Show All' : 'Hide Completed'; btn.addEventListener('click', () => { hideCompletedActive = !hideCompletedActive; btn.classList.toggle('active', hideCompletedActive); btn.textContent = hideCompletedActive ? 'Show All' : 'Hide Completed'; renderItems(); });}
}
function setupClearAllButton() { /* Modified for profiles */
    const btn = document.getElementById('clear-all-button');
    if(btn) btn.addEventListener('click', () => {
        const filtered = getFilteredItemsForOptions(null);
        if (filtered.length === 0) return alert("No items visible to clear.");
        const toClear = filtered.filter(i => i.Checked);
        if (toClear.length === 0) return alert("No completed items in current selection.");
        if (confirm(`Uncheck ${toClear.length} completed item(s) based on current filters for profile "${appData.activeProfileName}"? This will also clear their timestamps.`)) {
            toClear.forEach(item => {
                const originalItemInAllItems = allItems.find(i => i.id === item.id); 
                if (originalItemInAllItems) {
                    originalItemInAllItems.Checked = false;
                    originalItemInAllItems.checkedTimestamp = null; 
                }
            });
            saveCurrentProfileProgress(); 
            renderItems(); 
            alert(`Cleared ${toClear.length} item(s) for profile "${appData.activeProfileName}".`);
        }
    });
}
function setupGoToTopButton() { /* ... same as before ... */ 
    const goToTopBtn = document.getElementById('goToTopBtn');
    if (!goToTopBtn) return;
    window.onscroll = function() { scrollFunction(); };
    function scrollFunction() { if (document.body.scrollTop > 200 || document.documentElement.scrollTop > 200) { if (goToTopBtn) goToTopBtn.classList.add('show');} else { if (goToTopBtn) goToTopBtn.classList.remove('show');}}
    if (goToTopBtn) { goToTopBtn.addEventListener('click', function() { document.body.scrollTop = 0; document.documentElement.scrollTop = 0; });}
}

// Score system state is now per-profile, managed by appData
function setupScoreSystemToggle() {
    const toggleCheckbox = document.getElementById('toggle-score-system');
    if (toggleCheckbox) {
        const activeProfile = getActiveProfileData();
        scoreSystemEnabled = activeProfile.scoreSystemEnabled; // Set global from profile
        toggleCheckbox.checked = scoreSystemEnabled; 

        toggleCheckbox.addEventListener('change', () => {
            scoreSystemEnabled = toggleCheckbox.checked; // Update global
            const currentActiveProfile = getActiveProfileData();
            currentActiveProfile.scoreSystemEnabled = scoreSystemEnabled; // Update profile data
            saveAppData(); // Save all app data (which includes this profile's setting)
            renderItems(); 
        });
    }
}

async function initializeApp() {
    allItems = []; 
    bossToLocationsMap = {};
    locationToBossesMap = {};
    currentFilters = { game: 'all', content: 'all', type: 'all', itemSubType: 'all', rarity: 'all', manufacturer: 'all', boss: 'all', enemy: 'all', dropSource: 'all', location: 'all', quest: 'all', search: '' };
    const filterSelectElements = document.querySelectorAll('#filter-collapsible-content select');
    filterSelectElements.forEach(sel => sel.value = 'all');
    const searchInputEl = document.getElementById('search-input');
    if (searchInputEl) searchInputEl.value = '';

    let missingIdErrorMessages = []; 
    loadAppData(); // Load all profile data and set active profile

    try {
        let bl1Data = [], bl2Data = [], bltpsData = [], bl3Data = [], tinyTinaData = [];
        try { bl1Data = await loadJSONData('BorderlandsOne.json'); } catch (e) { console.warn("BL1 JSON load error:", e.message); }
        try { bl2Data = await loadJSONData('BorderlandsTwo.json'); } catch (e) { console.warn("BL2 JSON load error:", e.message); }
        try { bltpsData = await loadJSONData('BorderlandsTPS.json'); } catch (e) { console.warn("BLTPS JSON load error:", e.message); }
        try { bl3Data = await loadJSONData('BorderlandsThree.json'); } catch (e) { console.warn("BL3 JSON load error:", e.message); }
        try { tinyTinaData = await loadJSONData('TinyTinasWonderlands.json'); } catch (e) { console.warn("TTWL JSON load error:", e.message); }
        const gameDataMap = { BorderlandsOne: bl1Data, BorderlandsTwo: bl2Data, BorderlandsTPS: bltpsData, BorderlandsThree: bl3Data, TinyTinasWonderlands: tinyTinaData };
        let rawData = [];
        gameOrder.forEach(gameKey => { const itemsForGame = gameDataMap[gameKey]; if (itemsForGame && Array.isArray(itemsForGame)) { itemsForGame.forEach(rawItem => { if (rawItem && typeof rawItem === 'object') { rawData.push({ ...rawItem, Game: gameKey }); }});}});
        
        let processed = [];
        rawData.forEach((rawItem) => { 
            if (!rawItem || typeof rawItem !== 'object' || !rawItem.ItemName || typeof rawItem.ItemName !== 'string' || rawItem.ItemName.trim() === '') { console.warn('Skipping invalid raw item:', rawItem); missingIdErrorMessages.push(`Invalid item structure (Game: ${rawItem.Game || 'N/A'}, Item: ${rawItem.ItemName || 'N/A'}).`); return; }
            if (!rawItem.uniqueStaticId || String(rawItem.uniqueStaticId).trim() === '') { const errorMsg = `Item: "${rawItem.ItemName}", Game: "${rawItem.Game}" MISSING uniqueStaticId.`; console.error('CRITICAL: ' + errorMsg); missingIdErrorMessages.push(errorMsg); rawItem.uniqueStaticId = `TEMP_ID_ERROR_${rawItem.Game}_${rawItem.ItemName.replace(/\s+/g, '_')}_${Math.random().toString(36).substring(2, 9)}`;}
            const item = { ...rawItem }; 
            item.id = item.uniqueStaticId; 
            item.ItemName = String(item.ItemName).trim();
            item.isTimeLimited = !!item.isTimeLimited;
            let processedRarity;
            let rawOriginalRarity = rawItem.ItemRarity ? String(rawItem.ItemRarity).trim() : '';
            if (rawOriginalRarity.toLowerCase() === 'e-tech') { processedRarity = 'E-Tech';} else { processedRarity = rawOriginalRarity ? capitalizeFirstLetter(rawOriginalRarity) : 'Common';}
            item.ItemRarity = processedRarity;
            item.points = RARITY_POINTS[item.ItemRarity] || 0;
            item.checkedTimestamp = null; 

            const flatBosses = new Set(); const flatEnemyNames = new Set(); const flatQuestNames = new Set(); const flatLocations = new Set();
            ['BossLocations', 'EnemyLocations', 'GeneralLocations', 'QuestSources'].forEach(sourceKey => { if (item[sourceKey] && Array.isArray(item[sourceKey])) { item[sourceKey].forEach(s_obj => { if (typeof s_obj === 'object' && s_obj !== null) { if (sourceKey === 'BossLocations' || sourceKey === 'EnemyLocations') { s_obj.respawns = s_obj.respawns !== false; if (s_obj.isUniqueEnemy !== undefined) s_obj.isUniqueEnemy = !!s_obj.isUniqueEnemy;} if (Array.isArray(s_obj.DropRates)) { s_obj.DropRates = s_obj.DropRates.map(dr => ({condition: dr.condition ? String(dr.condition) : "Base", rate: (dr.rate !== null && dr.rate !== undefined) ? String(dr.rate) : null })).filter(dr => dr.rate !== null);} else if (s_obj.DropRate !== null && s_obj.DropRate !== undefined) { s_obj.DropRates = [{ condition: "Base", rate: String(s_obj.DropRate) }]; delete s_obj.DropRate;} else {s_obj.DropRates = [];} s_obj.NVHMDropRate = (typeof s_obj.NVHMDropRate === 'number') ? s_obj.NVHMDropRate : null; s_obj.TVHMDropRate = (typeof s_obj.TVHMDropRate === 'number') ? s_obj.TVHMDropRate : null; s_obj.UVHMDropRate = (typeof s_obj.UVHMDropRate === 'number') ? s_obj.UVHMDropRate : null; if (sourceKey === 'QuestSources') { s_obj.QuestGiver = (s_obj.QuestGiver && typeof s_obj.QuestGiver === 'string') ? s_obj.QuestGiver.trim() : null; s_obj.QuestType = (s_obj.QuestType && typeof s_obj.QuestType === 'string') ? s_obj.QuestType.trim() : null;} const name = s_obj.BossName || s_obj.EnemyName || (sourceKey === 'QuestSources' ? s_obj.QuestName : s_obj.Source); const locName = s_obj.LocationName || s_obj.Location || (sourceKey === 'QuestSources' ? s_obj.QuestLocation : null); if (name && String(name).trim()) { const trimmedName = String(name).trim(); if (sourceKey === 'BossLocations') flatBosses.add(trimmedName); if (sourceKey === 'EnemyLocations') flatEnemyNames.add(trimmedName); if (sourceKey === 'QuestSources') flatQuestNames.add(trimmedName);} if (locName && String(locName).trim()) { const locationToAdd = String(locName).trim(); flatLocations.add(locationToAdd); if (sourceKey === 'BossLocations' && name && String(name).trim()) { const bName = String(name).trim(); if (!bossToLocationsMap[bName]) bossToLocationsMap[bName] = new Set(); bossToLocationsMap[bName].add(locationToAdd); if (!locationToBossesMap[locationToAdd]) locationToBossesMap[locationToAdd] = new Set(); locationToBossesMap[locationToAdd].add(bName);}}}});} else {item[sourceKey] = [];}});
            item.Boss = Array.from(flatBosses).sort(); item.EnemyNames = Array.from(flatEnemyNames).sort(); item.Location = Array.from(flatLocations).sort(); item.QuestNames = Array.from(flatQuestNames).sort();
            const normArr = (v,d='/')=> Array.isArray(v)?v.map(s=>String(s).trim()).filter(Boolean) : (v&&typeof v==='string')?v.split(d).map(s=>String(s).trim()).filter(Boolean) : v&&typeof v ==='number'?[String(v).trim()].filter(Boolean): v?[String(v).trim()].filter(Boolean):[];
            item.Manufacturer = normArr(item.Manufacturer); item.DropSource = normArr(item.DropSource); item.Elements = normArr(item.Elements);
            item.ItemType = (item.ItemType !== null && item.ItemType !== undefined) ? String(item.ItemType).trim() : 'Unknown Type'; if (item.ItemType === '') item.ItemType = 'Unknown Type';
            item.ItemSubType = (item.ItemSubType !== null && item.ItemSubType !== undefined) ? String(item.ItemSubType).trim() : null; if (item.ItemSubType === '') item.ItemSubType = null;
            item.Content = item.Content ? String(item.Content).trim() : ''; item.Challenge = item.Challenge ? String(item.Challenge).trim() : ''; item.Notes = item.Notes ? String(item.Notes).trim() : '';
            item.LocationFilter = !!item.LocationFilter; item.isMissableItem = !!item.isMissableItem;
            item.Checked = false; // Default to false, will be updated by applyActiveProfileToAllItems
            processed.push(item);
        });
        allItems = processed;
        
        for (const b in bossToLocationsMap) bossToLocationsMap[b] = Array.from(bossToLocationsMap[b]).sort();
        for (const l in locationToBossesMap) locationToBossesMap[l] = Array.from(locationToBossesMap[l]).sort();
        
        if (missingIdErrorMessages.length > 0) { let alertMsg = `!! DATA WARNING !!\n${missingIdErrorMessages.length} item(s) are missing 'uniqueStaticId' or have issues.\nProgress for these items WILL NOT be saved correctly.\n\nExamples of problematic items:\n`; const maxExamples = 5; for(let i = 0; i < Math.min(missingIdErrorMessages.length, maxExamples); i++) { alertMsg += `- ${missingIdErrorMessages[i]}\n`;} if (missingIdErrorMessages.length > maxExamples) { alertMsg += `\n...and ${missingIdErrorMessages.length - maxExamples} more.`;} alertMsg += "\nPlease check the developer console (F12) for full details and fix your JSON data."; alert(alertMsg);}
        console.log('Processed allItems:', allItems.length, 'items.');

        applyActiveProfileToAllItems(); // Apply saved progress for the active profile
        initializeFilters(); 
        setupProfileControls(); // Initialize profile UI elements
        setupScoreSystemToggle(); 
        setupHideCompletedButton();
        setupClearAllButton();
        setupGoToTopButton();
        renderItems(); 
    } catch (e) {
        console.error("Initialization failed (main catch):", e);
        const list = document.getElementById('item-list');
        if(list) list.innerHTML = `<li class="item-list-placeholder error-message">App initialization failed. Check console.</li>`;
    }
}

document.addEventListener('DOMContentLoaded', initializeApp);