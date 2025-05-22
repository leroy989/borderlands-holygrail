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
let scoreSystemEnabled = false; 
const SCORE_SYSTEM_ENABLED_KEY = 'checklistScoreSystemEnabled';
const APP_DATA_KEY = 'borderlandsAppUserData_v1'; 
let appData = {
    profileNames: ['Default'],
    activeProfileName: 'Default',
    profileData: {
        'Default': {
            progress: [], 
            scoreSystemEnabled: false
        }
    }
};
let wasRenderTriggeredBySearch = false;
let saveTimeoutId = null; 

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
function capitalizeFirstLetter(string) { 
    if (!string) return '';
    return string.charAt(0).toUpperCase() + string.slice(1).toLowerCase();
}
async function loadJSONData(filePath) { 
    try {
        const response = await fetch(filePath);
        if (response.status === 404) {
            console.info(`Optional data file not found (will be ignored): ${filePath}`);
            return []; 
        }
        if (!response.ok) {
            throw new Error(`Failed to fetch ${filePath}: ${response.status} ${response.statusText}`);
        }
        return await response.json();
    } catch (error) {
        throw error; 
    }
}
function appendDropRatesToHTML(sourceObject, listHTMLString) { 
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
function formatItemTimestamp(isoString) { 
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
function formatTimeDuration(totalMilliseconds) {
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

// --- Profile System Functions ---
function loadAppData() { 
    const storedData = localStorage.getItem(APP_DATA_KEY);
    if (storedData) {
        try {
            appData = JSON.parse(storedData);
            if (!appData.profileNames || !Array.isArray(appData.profileNames) || !appData.activeProfileName || !appData.profileData) {
                throw new Error("Stored appData is missing core properties or has incorrect types.");
            }
            if (appData.profileNames.length === 0) { // Ensure there's at least one profile name
                 appData.profileNames = ['Default'];
            }
            if (!appData.profileNames.includes(appData.activeProfileName)) { // Ensure active profile exists
                appData.activeProfileName = appData.profileNames[0];
            }
            if (!appData.profileData[appData.activeProfileName]) { // Ensure active profile data object exists
                appData.profileData[appData.activeProfileName] = { progress: [], scoreSystemEnabled: false };
            }
             // Ensure progress is an array for the active profile
            if (!Array.isArray(appData.profileData[appData.activeProfileName].progress)) {
                appData.profileData[appData.activeProfileName].progress = [];
            }

        } catch (e) {
            console.error("Error parsing stored app data, resetting to default:", e);
            appData = { profileNames: ['Default'], activeProfileName: 'Default', profileData: { 'Default': { progress: [], scoreSystemEnabled: false }}};
            saveAppData(); 
        }
    } else {
        appData = { profileNames: ['Default'], activeProfileName: 'Default', profileData: { 'Default': { progress: [], scoreSystemEnabled: false }}};
        saveAppData();
    }
    const activeProfile = appData.profileData[appData.activeProfileName] || { progress: [], scoreSystemEnabled: false }; // Fallback
    scoreSystemEnabled = activeProfile.scoreSystemEnabled || false; // Ensure boolean
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
        const profile = appData.profileData[appData.activeProfileName];
        // Ensure progress is an array, default if not
        if (!Array.isArray(profile.progress)) {
            profile.progress = [];
        }
        return profile;
    }
    console.warn("Active profile data not found, returning empty default. Active:", appData.activeProfileName);
    return { progress: [], scoreSystemEnabled: false }; 
}
function applyActiveProfileToAllItems() { 
    const activeProfile = getActiveProfileData();
    // Ensure activeProfile.progress is an array before calling .find on it
    const progressData = Array.isArray(activeProfile.progress) ? activeProfile.progress : [];

    allItems.forEach(item => {
        const savedItemState = progressData.find(pItem => pItem.id === item.id);
        if (savedItemState) {
            item.Checked = savedItemState.Checked;
            item.checkedTimestamp = savedItemState.checkedTimestamp || null;
        } else {
            item.Checked = false;
            item.checkedTimestamp = null;
        }
    });
    scoreSystemEnabled = activeProfile.scoreSystemEnabled || false;
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
    // Ensure appData.profileNames is an array before calling .includes
    if (Array.isArray(appData.profileNames) && appData.profileNames.includes(trimmedName)) {
        alert(`Profile name "${trimmedName}" already exists.`);
        return false;
    }
    if (trimmedName.length > 30) { 
        alert("Profile name is too long (max 30 characters).");
        return false;
    }
    return trimmedName;
}
function populateProfileDropdown() { 
    const profileSelect = document.getElementById('profile-select');
    if (!profileSelect) return;
    profileSelect.innerHTML = '';
    if (Array.isArray(appData.profileNames)) { // Check if profileNames is an array
        appData.profileNames.forEach(name => {
            const option = document.createElement('option');
            option.value = name;
            option.textContent = name;
            profileSelect.appendChild(option);
        });
    }
    profileSelect.value = appData.activeProfileName;
    
    const progressPanelTitle = document.getElementById('progress-panel-title');
    if (progressPanelTitle) {
        progressPanelTitle.textContent = `${appData.activeProfileName || 'Default'}'s Progress`;
    }
}
function handleCreateProfile() { 
    const newProfileName = prompt("Enter name for new profile:");
    if (newProfileName) {
        const validatedName = isProfileNameValidAndUnique(newProfileName);
        if (validatedName) {
            if (!Array.isArray(appData.profileNames)) appData.profileNames = []; // Ensure it's an array
            appData.profileNames.push(validatedName);
            appData.profileData[validatedName] = {
                progress: [],
                scoreSystemEnabled: false 
            };
            handleSwitchProfile(validatedName); 
        }
    }
}
function handleDeleteProfile() { 
    if (!Array.isArray(appData.profileNames) || appData.profileNames.length <= 1) {
        alert("Cannot delete the last profile.");
        return;
    }
    const profileNameToDelete = appData.activeProfileName;
    if (confirm(`Are you sure you want to delete profile "${profileNameToDelete}"? This action cannot be undone.`)) {
        appData.profileNames = appData.profileNames.filter(name => name !== profileNameToDelete);
        delete appData.profileData[profileNameToDelete];
        const newActiveProfile = (Array.isArray(appData.profileNames) && appData.profileNames.includes('Default')) ? 'Default' : (appData.profileNames[0] || null);
        if (newActiveProfile) {
            handleSwitchProfile(newActiveProfile); 
        } else {
            // This case should ideally not happen if we ensure 'Default' is always creatable
            console.error("No profiles left to switch to after deletion.");
            // Potentially re-create a default profile
            appData.profileNames = ['Default'];
            appData.activeProfileName = 'Default';
            appData.profileData['Default'] = { progress: [], scoreSystemEnabled: false };
            handleSwitchProfile('Default');
        }
    }
}
function handleSwitchProfile(profileName) { 
    if (Array.isArray(appData.profileNames) && appData.profileNames.includes(profileName)) {
        appData.activeProfileName = profileName;
        saveAppData(); 
        currentFilters = { game: 'all', content: 'all', type: 'all', itemSubType: 'all', rarity: 'all', manufacturer: 'all', boss: 'all', enemy: 'all', dropSource: 'all', location: 'all', quest: 'all', search: '' };
        const filterSelectElements = document.querySelectorAll('#filter-collapsible-content select');
        filterSelectElements.forEach(sel => sel.value = 'all');
        const searchInputEl = document.getElementById('search-input');
        if (searchInputEl) searchInputEl.value = '';
        applyActiveProfileToAllItems(); 
        populateProfileDropdown(); 
        initializeFilters(); // This will re-populate dropdowns based on allItems and current (reset) filters
        wasRenderTriggeredBySearch = false; // Ensure search scroll flag is reset
        renderItems(); 
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

function debouncedSaveCurrentProfileProgress() {
    clearTimeout(saveTimeoutId);
    saveTimeoutId = setTimeout(() => {
        saveCurrentProfileProgress();
    }, 750); 
}
function saveCurrentProfileProgress() {
    const activeProfile = getActiveProfileData();
    if (activeProfile) { // activeProfile is guaranteed to have .progress as an array
        activeProfile.progress = allItems
            .filter(i => i.id && (i.Checked || i.checkedTimestamp)) 
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

// --- Core Application Logic ---
function createItemListItem(item) { 
    const listItem = document.createElement('li');
    let rarityCardClass = item.ItemRarity.toLowerCase().replace(/\s+/g, '-');
    if (item.ItemRarity === 'E-Tech') { 
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
    if (item.Checked && item.checkedTimestamp) { infoAreaHTML += `<div class="item-checked-timestamp">Found: ${formatItemTimestamp(item.checkedTimestamp)}</div>`;}
    const manufacturerText = (item.Manufacturer && Array.isArray(item.Manufacturer) && item.Manufacturer.length > 0) ? `Manufacturer: ${item.Manufacturer.join(' / ')}` : '';
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
        debouncedSaveCurrentProfileProgress(); 
        wasRenderTriggeredBySearch = false; // Click is not a search
        renderItems(); 
    });
    return listItem;
}

function populateFilterDropdown(selectElement, uniqueValues, category, activeValue, sortFunction = null) { 
    if (!selectElement) return;
    selectElement.innerHTML = ''; 
    const allOption = document.createElement('option');
    allOption.value = 'all';
    allOption.textContent = 'All';
    selectElement.appendChild(allOption);
    if (sortFunction) { uniqueValues.sort(sortFunction);} else if (Array.isArray(uniqueValues) && uniqueValues.every(val => typeof val === 'string')) { uniqueValues.sort((a, b) => a.localeCompare(b));} 
    if (Array.isArray(uniqueValues)) { // Ensure uniqueValues is an array before forEach
        uniqueValues.forEach(value => {
            const option = document.createElement('option');
            option.value = String(value); 
            if (category === 'game') { if (value === "BorderlandsOne") option.textContent = "BL1"; else if (value === "BorderlandsTwo") option.textContent = "BL2"; else if (value === "BorderlandsTPS") option.textContent = "BL:TPS"; else if (value === "BorderlandsThree") option.textContent = "BL3"; else if (value === "TinyTinasWonderlands") option.textContent = "Wonderlands"; else option.textContent = capitalizeFirstLetter(String(value));} else if (category === 'rarity') { option.textContent = String(value); } else { option.textContent = String(value);}
            selectElement.appendChild(option);
        });
    }
    selectElement.value = activeValue;
}
const getUniqueValues = (items, field, isMultiValueProperty = true) => { 
    let values = new Set();
    if (!Array.isArray(items)) return []; // Guard against items not being an array
    items.forEach(item => {
        const itemFieldValue = item[field];
        if (itemFieldValue === null || itemFieldValue === undefined) return;
        if (isMultiValueProperty && Array.isArray(itemFieldValue)) {
            itemFieldValue.forEach(val => { if (val !== null && val !== undefined && String(val).trim() !== '') values.add(String(val).trim());});
        } else if (String(itemFieldValue).trim() !== '') {
            values.add(String(itemFieldValue).trim());
        }
    });
    return Array.from(values); 
};
const getFilteredItemsForOptions = (excludeCategory) => { 
    if (!Array.isArray(allItems)) return []; // Guard against allItems not being an array
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
function populateDynamicFilters() { 
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

function renderItems() {
    const container = document.getElementById('item-list');
    if (!container) return;
    container.innerHTML = ''; 
    
    populateDynamicFilters(); 
    
    let finalFilteredItems = getFilteredItemsForOptions(null); 
    finalFilteredItems.sort((a, b) => a.ItemName.localeCompare(b.ItemName));
    
    const itemsToDisplay = hideCompletedActive ? finalFilteredItems.filter(item => !item.Checked) : finalFilteredItems;
    
    let hasActualItems = false;
    if (itemsToDisplay.length === 0) {
        container.innerHTML = `<li class="item-list-placeholder">No items found.</li>`;
    } else {
        itemsToDisplay.forEach(item => container.appendChild(createItemListItem(item)));
        hasActualItems = true; 
    }
    updateSummary(finalFilteredItems);

    // MODIFIED SCROLL LOGIC with headerOffset
    if (wasRenderTriggeredBySearch) {
            if (currentFilters.search !== '' && hasActualItems) {
                const itemListElement = document.getElementById('item-list');
                if (itemListElement) {
                    // Define how many pixels from the top of the viewport you want the item list to start.
                    // A smaller number means closer to the top.
                    // Adjust this value to your preference.
                    const desiredPaddingAboveList = 20; // e.g., 20px padding from the viewport top.

                    // Calculate the target scroll position
                    const elementRect = itemListElement.getBoundingClientRect();
                    const scrollTop = window.pageYOffset || document.documentElement.scrollTop;
                    
                    let targetScrollY = elementRect.top + scrollTop - desiredPaddingAboveList;
                    
                    // Ensure we don't try to scroll to a negative position
                    targetScrollY = Math.max(0, targetScrollY);

                    // For very short lists (e.g., 1-2 rows):
                    // The logic above will bring the top of the list near the top of the screen.
                    // If the list is very short, it will naturally sit there, and if the
                    // page isn't long enough to scroll further, the browser won't.
                    // The phrase "go to bottom of page if its like 1 row" is a bit ambiguous.
                    // Usually, users expect search results to appear near the top.
                    // If the list is very short, scrolling its top to near the viewport top is standard.
                    // If the entire content of the page (including the short list) is less than
                    // the viewport height, it won't scroll much, which might be what you mean by "go to bottom."

                    window.scrollTo({
                        top: targetScrollY,
                        behavior: 'smooth'
                    });
                }
            }
            wasRenderTriggeredBySearch = false; // Reset the flag
        }
}
function updateSummary(filteredItems) { 
    const checkedCountEl = document.getElementById('checked-count');
    const totalCountEl = document.getElementById('total-count');
    const progressBarEl = document.getElementById('progress-bar');
    const progressPercentEl = document.getElementById('progress-percentage');
    const scoreDisplayContainer = document.getElementById('score-display-container');
    const totalScoreEl = document.getElementById('total-score');
    const totalTimePlayedContainer = document.getElementById('total-time-played-container');
    const totalTimePlayedEl = document.getElementById('total-time-played');
    if (!checkedCountEl || !totalCountEl || !progressBarEl || !progressPercentEl || !scoreDisplayContainer || !totalScoreEl || !totalTimePlayedContainer || !totalTimePlayedEl) return;
    const displayTotalCount = Array.isArray(filteredItems) ? filteredItems.length : 0;
    const progressRelevantItems = Array.isArray(filteredItems) ? filteredItems.filter(item => !item.isTimeLimited || item.Checked) : [];
    const effectiveTotalForProgress = progressRelevantItems.length;
    const checkedProgressRelevantItems = progressRelevantItems.filter(item => item.Checked);
    const percentage = effectiveTotalForProgress > 0 ? (checkedProgressRelevantItems.length / effectiveTotalForProgress) * 100 : 0;
    checkedCountEl.textContent = checkedProgressRelevantItems.length;
    totalCountEl.textContent = displayTotalCount;
    progressBarEl.style.width = `${percentage}%`;
    progressPercentEl.textContent = `${Math.round(percentage)}%`;
    if (scoreSystemEnabled) { let currentScore = 0; checkedProgressRelevantItems.forEach(item => { currentScore += (item.points || 0); }); totalScoreEl.textContent = currentScore; scoreDisplayContainer.style.display = 'block';} else { scoreDisplayContainer.style.display = 'none';}
    const allCheckedItemsInCurrentProfile = Array.isArray(allItems) ? allItems.filter(item => item.Checked && item.checkedTimestamp) : [];
    if (allCheckedItemsInCurrentProfile.length >= 1) { const timestamps = allCheckedItemsInCurrentProfile.map(item => new Date(item.checkedTimestamp).getTime()); const minTimestamp = Math.min(...timestamps); const maxTimestamp = Math.max(...timestamps); const durationMs = (allCheckedItemsInCurrentProfile.length > 1) ? (maxTimestamp - minTimestamp) : 0; totalTimePlayedEl.textContent = formatTimeDuration(durationMs); totalTimePlayedContainer.style.display = 'block';} else { totalTimePlayedEl.textContent = "0m"; totalTimePlayedContainer.style.display = 'none'; }
}

function initializeFilters() {
    const filterSelects = document.querySelectorAll('select[data-filter-category]');
    filterSelects.forEach(select => {
        select.value = currentFilters[select.dataset.filterCategory] || 'all';
        select.addEventListener('change', event => {
            wasRenderTriggeredBySearch = false; // A filter change is not a search-initiated render

            const category = event.target.dataset.filterCategory;
            const value = event.target.value;
            currentFilters[category] = value;

            // Reset dependent filters when a primary filter changes
            if (category === 'game') {
                ['content', 'type', 'itemSubType', 'rarity', 'manufacturer', 'boss', 'enemy', 'dropSource', 'location', 'quest'].forEach(c => {
                    currentFilters[c] = 'all';
                    // Visually reset the dropdowns too
                    const dependentSelect = document.getElementById(`${c}-filter-select`);
                    if (dependentSelect) dependentSelect.value = 'all';
                });
            } else if (category === 'content') {
                 ['type', 'itemSubType', 'rarity', 'manufacturer', 'boss', 'enemy', 'dropSource', 'location', 'quest'].forEach(c => {
                    currentFilters[c] = 'all';
                    const dependentSelect = document.getElementById(`${c}-filter-select`);
                    if (dependentSelect) dependentSelect.value = 'all';
                });
            } else if (category === 'type') {
                currentFilters.itemSubType = 'all';
                const subTypeSelect = document.getElementById('subtype-filter-select');
                if (subTypeSelect) subTypeSelect.value = 'all';
            }
            renderItems();
        });
    });

    // Initial population for the Game filter (as it doesn't depend on other filters)
    const gameSelect = document.getElementById('game-filter-select');
    if (gameSelect && allItems.length > 0) { // Ensure allItems is populated before getting unique values
        populateFilterDropdown(gameSelect, getUniqueValues(allItems, 'Game', false), 'game', currentFilters.game, (a,b) => gameOrder.indexOf(a) - gameOrder.indexOf(b));
    }
    
    const searchInput = document.getElementById('search-input');
    if (searchInput) { 
        searchInput.value = currentFilters.search || ''; // Set initial value from any persisted filter state

        searchInput.addEventListener('keydown', (e) => {
            if (e.key === 'Enter') {
                e.preventDefault(); // Prevent default form submission
                const newSearchTerm = searchInput.value.trim();
                // Update and render even if the term is the same, user explicitly hit Enter
                currentFilters.search = newSearchTerm;
                wasRenderTriggeredBySearch = true; 
                renderItems();
            }
        });

        searchInput.addEventListener('blur', () => {
            const newSearchTerm = searchInput.value.trim();
            // Only render on blur if the search term has actually changed 
            // from what's currently set in filters.
            if (currentFilters.search !== newSearchTerm) {
                currentFilters.search = newSearchTerm;
                wasRenderTriggeredBySearch = true;
                renderItems();
            }
        });
    }
}
function setupHideCompletedButton() { 
    const btn = document.getElementById('hide-completed-button');
    if(btn) { btn.classList.toggle('active', hideCompletedActive); btn.textContent = hideCompletedActive ? 'Show All' : 'Hide Completed'; btn.addEventListener('click', () => { hideCompletedActive = !hideCompletedActive; btn.classList.toggle('active', hideCompletedActive); btn.textContent = hideCompletedActive ? 'Show All' : 'Hide Completed'; wasRenderTriggeredBySearch = false; renderItems(); });}
}
function setupClearAllButton() { 
    const btn = document.getElementById('clear-all-button');
    if(btn) btn.addEventListener('click', () => {
        const filtered = getFilteredItemsForOptions(null);
        if (!Array.isArray(filtered) || filtered.length === 0) return alert("No items visible to clear.");
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
            debouncedSaveCurrentProfileProgress(); 
            wasRenderTriggeredBySearch = false; renderItems(); 
            alert(`Cleared ${toClear.length} item(s) for profile "${appData.activeProfileName}".`);
        }
    });
}
function setupGoToTopButton() { 
    const goToTopBtn = document.getElementById('goToTopBtn');
    if (!goToTopBtn) return;
    window.onscroll = function() { scrollFunction(); };
    function scrollFunction() { if (document.body.scrollTop > 200 || document.documentElement.scrollTop > 200) { if (goToTopBtn) goToTopBtn.classList.add('show');} else { if (goToTopBtn) goToTopBtn.classList.remove('show');}}
    if (goToTopBtn) { goToTopBtn.addEventListener('click', function() { document.body.scrollTop = 0; document.documentElement.scrollTop = 0; });}
}

function setupScoreSystemToggle() { 
    const toggleCheckbox = document.getElementById('toggle-score-system');
    if (toggleCheckbox) {
        toggleCheckbox.checked = scoreSystemEnabled; 
        toggleCheckbox.addEventListener('change', () => {
            scoreSystemEnabled = toggleCheckbox.checked; 
            const currentActiveProfile = getActiveProfileData();
            currentActiveProfile.scoreSystemEnabled = scoreSystemEnabled; 
            saveAppData(); 
            wasRenderTriggeredBySearch = false; renderItems(); 
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
    loadAppData(); 

    try {
        let bl1Data = [], bl2Data = [], bltpsData = [], bl3Data = [], tinyTinaData = [];
        try { bl1Data = await loadJSONData('BorderlandsOne.json'); } catch (e) { console.warn(`BL1 JSON load error: ${e.message}. Using empty data.`); bl1Data = []; }
        try { bl2Data = await loadJSONData('BorderlandsTwo.json'); } catch (e) { console.warn(`BL2 JSON load error: ${e.message}. Using empty data.`); bl2Data = []; }
        try { bltpsData = await loadJSONData('BorderlandsTPS.json'); } catch (e) { console.warn(`BLTPS JSON load error: ${e.message}. Using empty data.`); bltpsData = []; }
        try { bl3Data = await loadJSONData('BorderlandsThree.json'); } catch (e) { console.warn(`BL3 JSON load error: ${e.message}. Using empty data.`); bl3Data = []; }
        try { tinyTinaData = await loadJSONData('TinyTinasWonderlands.json'); } catch (e) { console.warn(`TTWL JSON load error: ${e.message}. Using empty data.`); tinyTinaData = []; }
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
            item.Checked = false; 
            processed.push(item);
        });
        allItems = processed;
        
        for (const b in bossToLocationsMap) bossToLocationsMap[b] = Array.from(bossToLocationsMap[b]).sort();
        for (const l in locationToBossesMap) locationToBossesMap[l] = Array.from(locationToBossesMap[l]).sort();
        
        if (missingIdErrorMessages.length > 0) { let alertMsg = `!! DATA WARNING !!\n${missingIdErrorMessages.length} item(s) are missing 'uniqueStaticId' or have issues.\nProgress for these items WILL NOT be saved correctly.\n\nExamples of problematic items:\n`; const maxExamples = 5; for(let i = 0; i < Math.min(missingIdErrorMessages.length, maxExamples); i++) { alertMsg += `- ${missingIdErrorMessages[i]}\n`;} if (missingIdErrorMessages.length > maxExamples) { alertMsg += `\n...and ${missingIdErrorMessages.length - maxExamples} more.`;} alertMsg += "\nPlease check the developer console (F12) for full details and fix your JSON data."; alert(alertMsg);}
        console.log('Processed allItems:', allItems.length, 'items.');

        applyActiveProfileToAllItems(); 
        initializeFilters(); 
        setupProfileControls(); 
        setupScoreSystemToggle(); 
        setupHideCompletedButton();
        setupClearAllButton();
        setupGoToTopButton();
        wasRenderTriggeredBySearch = false; 
        renderItems(); 
    } catch (e) {
        console.error("Initialization failed (main catch):", e);
        const list = document.getElementById('item-list');
        if(list) list.innerHTML = `<li class="item-list-placeholder error-message">App initialization failed. Check console.</li>`;
    }
}

document.addEventListener('DOMContentLoaded', initializeApp);