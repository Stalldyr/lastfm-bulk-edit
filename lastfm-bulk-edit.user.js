// ==UserScript==
// @name         Last.fm Library Cleaner
// @namespace    http://tampermonkey.net/
// @version      0.1
// @description  Automatically finds and removes bad values from tags
// @author       Stalldyr
// @match        https://www.last.fm/*
// @connect      http://ws.audioscrobbler.com/2.0/*
// @include      http://ws.audioscrobbler.com/2.0/*
// @icon         https://www.last.fm/static/images/lastfm_avatar_twitter.png
// @grant        none
// @require      http://ajax.googleapis.com/ajax/libs/jquery/1.9.1/jquery.min.js
// @require      https://unpkg.com/metadata-filter@latest/dist/filter.min.js
// ==/UserScript==

'use strict';

const namespace = 'lastfm-library-cleaner';

// use the top-right link to determine the current user
const authLink = document.querySelector('a.auth-link');

if (!authLink) {
    return; // not logged in
}

const API_KEY = "b22a39da4c2100b1d8210bbd8e714e2c";
const USER = authLink.childNodes[0].alt;

const libraryURL = `${authLink.href}/library/`;
const settingsURL = 'https://www.last.fm/settings/subscription';

// https://regex101.com/r/KwEMRx/1
const albumRegExp = new RegExp(`^${libraryURL}/music(/\\+[^/]*)*(/[^+][^/]*){2}$`);
const artistRegExp = new RegExp(`^${libraryURL}/music(/\\+[^/]*)*(/[^+][^/]*){1}$`);

const domParser = new DOMParser();
const filter = MetadataFilter.createSpotifyFilter();

const cleanerSection = document.createElement('section');
cleanerSection.setAttribute("id", "library-cleaner");
cleanerSection.innerHTML = `<h2>Last.fm Library Cleaner</h2>
    <p> Cleans the library of dirty tags such as 'Remaster'. Select wether you want to clean album or tracks:</p>
    <iframe name="votar" style="display:none;"></iframe>
    <form method="GET" data-edit-scrobble="" target="votar">
        <input type="radio" id="album" name="method" value="album" checked>
        <label for="album">Albums</label><br>
        <input type="radio" id="track" name="method" value="track">
        <label for="track">Tracks</label><br>
        <label for="startDate">Start date (Optional):</label>
        <input type="date" id="startDate" name="startDate">
        <p>Filters:</p>
        <input type="checkbox" id="Remastered" name="filter" value="Remastered" checked>
        <label for="Remastered"> Remastered </label><br>
        <button class="btn-primary buffer-standard">
            Clean Library
        </button>
    </form>
    `;

const editScrobbleFormTemplate = document.createElement('template');
editScrobbleFormTemplate.innerHTML = `
    <form method="POST" action="${libraryURL}/edit?edited-variation=library-track-scrobble" data-edit-scrobble="">
        <input type="hidden" name="csrfmiddlewaretoken" value="">
        <input type="hidden" name="artist_name" value="">
        <input type="hidden" name="track_name" value="">
        <input type="hidden" name="album_name" value="">
        <input type="hidden" name="album_artist_name" value="">
        <input type="hidden" name="timestamp" value="">
        <button type="submit" class="mimic-link dropdown-menu-clickable-item more-item--edit">
            Edit scrobbles
        </button>
    </form>`;

const modalTemplate = document.createElement('template');
modalTemplate.innerHTML = `
    <div class="popup_background"
        style="opacity: 0.8; visibility: visible; background-color: rgb(0, 0, 0); position: fixed; top: 0px; right: 0px; bottom: 0px; left: 0px;">
    </div>
    <div class="popup_wrapper popup_wrapper_visible" style="opacity: 1; visibility: visible; position: fixed; overflow: auto; width: 100%; height: 100%; top: 0px; left: 0px; text-align: center;">
        <div class="modal-dialog popup_content" role="dialog" aria-labelledby="modal-label" data-popup-initialized="true" aria-hidden="false" style="opacity: 1; visibility: visible; pointer-events: auto; display: inline-block; outline: none; text-align: left; position: relative; vertical-align: middle;" tabindex="-1">
            <div class="modal-content">
                <div class="modal-body">
                    <h2 class="modal-title"></h2>
                </div>
            </div>
        </div>
        <div class="popup_align" style="display: inline-block; vertical-align: middle; height: 100%;"></div>
    </div>`;

initialize();

function initialize() {
    if (!document.URL.startsWith(settingsURL)) {
        return; // current page is not the user's library
    }
    appendStyle();
    appendCleanerButton(document);

    /*
    // use MutationObserver because Last.fm is a single-page application
    // MutationObserver provides the ability to watch for changes being made to the DOM tree
    const observer = new MutationObserver(mutations => {
        for (const mutation of mutations) {
            for (const node of mutation.addedNodes) {
                if (node instanceof Element) {
                    appendCleanerButton(node);
                }
            }
        }
    });

    observer.observe(document.body, {
        childList: true,
        subtree: true
    });
    */
}

function appendCleanerButton(element){
    const historySection = element.querySelector("#subscription-history");

    const cleanerForm = cleanerSection.querySelector('form');
    const cleanerButton = cleanerForm.querySelector('button');

    cleanerButton.addEventListener('click', async event => {
        event.preventDefault();
        event.stopImmediatePropagation();

        cleanerForm.submit();

        var params = addParams(cleanerForm);

        const userMethod = extractMethod(cleanerForm);

        const urlParams = new URLSearchParams(params).toString();
        const url = new URL("https://ws.audioscrobbler.com/2.0/?" + urlParams);
        //const url = new URL(libraryURL + "/" + methodType);

        console.log(url.href);

        const editForm = getEditScrobbleForm(url,userMethod);
    });

    historySection.insertAdjacentElement('afterend', cleanerSection);
}

function extractMethod(form){
    var userMethod = {};
    userMethod.type = form.method.value;
    if (form.startDate.value == ""){
        userMethod.range = `top${form.method.value}s`;
    }
    else {
        userMethod.range = `recenttracks`;
    }

    return userMethod;
}

function addParams(form){
    var params = {};
    if (form.startDate.value == ""){
        params.method = `user.gettop${form.method.value}s`;
    }
    else {
        params.method = `user.getrecenttracks`;
        params.from = String(Math.round(new Date(form.startDate.value).getTime()/1000));
    }
    params.api_key = API_KEY;
    params.user = USER;
    params.limit = '200';
    params.format = 'json';

    return params
}

//CSS style features
function appendStyle() {
    const style = document.createElement('style');

    style.innerHTML = `
        .${namespace}-abbr {
            cursor: pointer;
        }

        .${namespace}-ellipsis {
            display: block;
            overflow: hidden;
            text-overflow: ellipsis;
            white-space: nowrap;
        }

        .${namespace}-form-group-controls {
            margin-left: 0 !important;
        }

        .${namespace}-list {
            column-count: 2;
        }

        .${namespace}-loading {
            background: url("/static/images/loading_dark_light_64.gif") 50% 50% no-repeat;
            height: 64px;
            display: flex;
            justify-content: center;
            align-items: center;
        }

        .${namespace}-text-danger {
            color: #d92323;
        }

        .${namespace}-text-info {
            color: #2b65d9;
        }`;

    document.head.appendChild(style);
}

async function getEditScrobbleForm(url,method) {
    const urlType = getUrlType(url);

    const form = editScrobbleFormTemplate.content.cloneNode(true).querySelector('form');
    const button = form.querySelector('button');

    let allScrobbleData;
    let scrobbleData;
    let submit = false;

    if (submit) {
        return;
    }

    event.preventDefault();
    event.stopImmediatePropagation();

    if (!allScrobbleData) {
        const loadingModal = createLoadingModal('Loading Scrobbles...', { display: 'percentage' });
        allScrobbleData = await fetchScrobbleData(url,method, loadingModal);
        loadingModal.hide();
    }

    scrobbleData = allScrobbleData;

    // use JSON strings as album keys to uniquely identify combinations of album + album artists
    // group scrobbles by album key
    let scrobbleDataGroups = [...groupBy(allScrobbleData, s => JSON.stringify({
        album_name: s.get('album_name') || '',
        album_artist_name: s.get('album_artist_name') || ''
    }))];

    // sort groups by the amount of scrobbles
    scrobbleDataGroups = scrobbleDataGroups.sort(([_key1, values1], [_key2, values2]) => values2.length - values1.length);

    // when editing multiple albums album, show an album selection dialog first
    if (scrobbleDataGroups.length >= 2) {
        const noAlbumKey = JSON.stringify({ album_name: '', album_artist_name: '' });
        let currentAlbumKey = undefined;

        // put the "No Album" album first
        scrobbleDataGroups = scrobbleDataGroups.sort(([key1], [key2]) => {
            if (key1 === noAlbumKey) return -1;
            if (key2 === noAlbumKey) return +1;
            return 0;
        });

        // when the edit dialog was initiated from an album or album track, put that album first in the list
        if (urlType === 'album' || getUrlType(document.URL) === 'album') {
            // grab the current album name and artist name from the DOM
            const album_name = (urlType === 'album' && row
                                ? row.querySelector('.chartlist-name')
                                : document.querySelector('.library-header-title')).textContent.trim();
            const album_artist_name = (urlType === 'album' && row
                                       ? row.querySelector('.chartlist-artist') || document.querySelector('.library-header-title, .library-header-crumb')
                                       : document.querySelector('.text-colour-link')).textContent.trim();
            currentAlbumKey = JSON.stringify({ album_name, album_artist_name });

            // put the current album first
            scrobbleDataGroups = scrobbleDataGroups.sort(([key1], [key2]) => {
                if (key1 === currentAlbumKey) return -1;
                if (key2 === currentAlbumKey) return +1;
                if (key1 === noAlbumKey) return -1;
                if (key2 === noAlbumKey) return +1;
                return 0;
            });
        }

        const body = document.createElement('div');
        body.innerHTML = `
                <div class="form-disclaimer">
                    <div class="alert alert-info">
                        Scrobbles from this ${urlType} are spread out across multiple albums.
                        Select which albums you would like to edit.
                        Deselect albums you would like to skip.
                    </div>
                </div>
                <div class="form-group">
                    <div class="form-group-controls ${namespace}-form-group-controls">
                        <button type="button" class="btn-secondary" id="${namespace}-select-all">Select all</button>
                        <button type="button" class="btn-secondary" id="${namespace}-deselect-all">Deselect all</button>
                    </div>
                </div>
                <ul class="${namespace}-list">
                    ${scrobbleDataGroups.map(([key, scrobbleData], index) => {
            const firstScrobbleData = scrobbleData[0];
            const album_name = firstScrobbleData.get('album_name');
            const artist_name = firstScrobbleData.get('album_artist_name') || firstScrobbleData.get('artist_name');

            return `
                            <li>
                                <div class="checkbox">
                                    <label>
                                        <input type="checkbox" name="key" value="${he.escape(key)}" ${currentAlbumKey === undefined || currentAlbumKey === key ? 'checked' : ''} />
                                        <strong title="${he.escape(album_name || '')}" class="${namespace}-ellipsis ${currentAlbumKey === key ? `${namespace}-text-info` : !album_name ? `${namespace}-text-danger` : ''}">
                                            ${album_name ? he.escape(album_name) : '<em>No Album</em>'}
                                        </strong>
                                        <div title="${he.escape(artist_name)}" class="${namespace}-ellipsis">
                                            ${he.escape(artist_name)}
                                        </div>
                                        <small>
                                            ${scrobbleData.length} scrobble${scrobbleData.length !== 1 ? 's' : ''}
                                        </small>
                                    </label>
                                </div>
                            </li>`;
        }).join('')}
                </ul>`;

        const checkboxes = body.querySelectorAll('input[type="checkbox"]');

        body.querySelector(`#${namespace}-select-all`).addEventListener('click', () => {
            for (const checkbox of checkboxes) {
                checkbox.checked = true;
            }
        });

        body.querySelector(`#${namespace}-deselect-all`).addEventListener('click', () => {
            for (const checkbox of checkboxes) {
                checkbox.checked = false;
            }
        });

        let formData;
        try {
            formData = await prompt('Select Albums To Edit', body);
        } catch (error) {
            return; // user canceled the album selection dialog
        }

        const selectedAlbumKeys = formData.getAll('key');

        scrobbleData = flatten(scrobbleDataGroups
                               .filter(([key]) => selectedAlbumKeys.includes(key))
                               .map(([_, values]) => values));
    }

    if (scrobbleData.length === 0) {
        alert(`Last.fm reports you haven't listened to this ${urlType}.`);
        return;
    }

    // use the first scrobble to trick Last.fm into fetching the Edit Scrobble modal
    applyFormData(form, scrobbleData[0]);
    submit = true;
    button.click();

    return form;
}

function getUrlType(url) {
    if (albumRegExp.test(url)) {
        return 'album';
    } else if (artistRegExp.test(url)) {
        return 'artist';
    } else {
        return 'track';
    }
}

function createModal(title, body, options) {
    const fragment = modalTemplate.content.cloneNode(true);

    const modalTitle = fragment.querySelector('.modal-title');
    if (title instanceof Node) {
        modalTitle.insertAdjacentElement('beforeend', title);
    } else {
        modalTitle.insertAdjacentHTML('beforeend', title);
    }

    const modalBody = fragment.querySelector('.modal-body');
    if (body instanceof Node) {
        modalBody.insertAdjacentElement('beforeend', body);
    } else {
        modalBody.insertAdjacentHTML('beforeend', body);
    }

    const element = document.createElement('div');

    if (options && options.dismissible) {
        // create X button that closes the modal
        const closeButton = document.createElement('button');
        closeButton.className = 'modal-dismiss';
        closeButton.textContent = 'Close';
        closeButton.addEventListener('click', hide);

        // append X button to DOM
        const modalContent = fragment.querySelector('.modal-content');
        modalContent.insertBefore(closeButton, modalContent.firstElementChild);

        // close modal when user clicks outside modal
        const popupWrapper = fragment.querySelector('.popup_wrapper');
        popupWrapper.addEventListener('click', event => {
            if (!modalContent.contains(event.target)) {
                hide();
            }
        });
    }

    element.appendChild(fragment);

    let addedClass = false;

    function show() {
        if (element.parentNode) return;
        document.body.appendChild(element);

        if (!document.documentElement.classList.contains('popup_visible')) {
            document.documentElement.classList.add('popup_visible');
            addedClass = true;
        }
    }

    function hide() {
        if (!element.parentNode) return;
        element.parentNode.removeChild(element);

        if (addedClass) {
            document.documentElement.classList.remove('popup_visible');
            addedClass = false;
        }

        if (options && options.events && options.events.hide) {
            options.events.hide();
        }
    }

    return { element, show, hide };
}

function createLoadingModal(title, options) {
    const body = `
        <div class="${namespace}-loading">
            <div class="${namespace}-progress"></div>
        </div>`;

    const modal = createModal(title, body);
    const progress = modal.element.querySelector(`.${namespace}-progress`);

    // extend modal with custom properties
    modal.steps = [];
    modal.refreshProgress = () => {
        switch (options && options.display) {
            case 'count':
                progress.textContent = `${modal.steps.filter(s => s.completed).length} / ${modal.steps.length}`;
                break;

            case 'percentage':{
                const completionRatio = getCompletionRatio(modal.steps);
                progress.textContent = Math.floor(completionRatio * 100) + '%';
                break;
            }
        }
    };

    modal.refreshProgress();
    modal.show();

    return modal;
}

// calculates the completion ratio from a tree of steps with weights and child steps
function getCompletionRatio(steps) {
    const totalWeight = steps.map(s => s.weight).reduce((a, b) => a + b, 0);
    if (totalWeight === 0) return 0;
    const completedWeight = steps.map(s => s.weight * (s.completed ? 1 : getCompletionRatio(s.steps))).reduce((a, b) => a + b, 0);
    return completedWeight / totalWeight;
}

async function fetchScrobbleData(url, method, loadingModal, parentStep) {
    if (!parentStep) parentStep = loadingModal;

    /*
    //remove "?date_preset=LAST_365_DAYS", etc.
    const indexOfQuery = url.indexOf('?');
    if (indexOfQuery !== -1) {
        url = url.substr(0, indexOfQuery);
    }

    if (getUrlType(url) === 'artist') {
        url += '/+tracks'; // skip artist overview and go straight to the tracks
    }
    */

    const documentsToFetch = [fetchJSON(url)];
    const firstDocument = await documentsToFetch[0];
    const pageCount = parseInt(firstDocument[method.range]['@attr'].totalPages);

    const pageNumbersToFetch = [...Array(pageCount - 1).keys()].map(i => i + 2);
    documentsToFetch.push(...pageNumbersToFetch.map(n => fetchJSON(`${url}&page=${n}`)));

    let scrobbleData = await forEachParallel(loadingModal, parentStep, documentsToFetch, async (documentToFetch, step) => {
        const fetchedDocument = await documentToFetch;

        //Needs to fix this such that it also applies for albums
        const table = fetchedDocument[method.range][method.type];
        //console.log(table);
        const sortedTable = await JSONsorter(table,method);
        //console.log(sortedTable);

        if (!table) {
            // sometimes a missing chartlist is expected, other times it indicates a failure
            if (fetchedDocument.body.textContent.includes('There was a problem loading your')) {
                abort();
            }
            return [];
        }

        const rows = Array.prototype.slice.call(sortedTable);
        //console.log(rows);
        //const rows = [...table.tBodies[0].rows];

        // to display accurate loading percentages, tracks with more scrobbles will have more weight
        const weightFunc = row => {
            const barValue = row.playcount;
            //const barValue = row.querySelector('.chartlist-count-bar-value');
            if (barValue === null) return 1;
            const scrobbleCount = parseInt(barValue, 10);
            return Math.ceil(scrobbleCount / 200); // 50 = items per page on Last.fm
        };

        return await forEachParallel(loadingModal, step, rows, async (row, step) => {
            //console.log(row)

            const link = row.url.replace("https://www.last.fm/",libraryURL)
            //console.log(link)
            if (link) {
                //recursive call to the current function
                return await fetchScrobbleData(link, loadingModal, step);
            }

            // no link indicates we're at the scrobble overview
            const form = row.querySelector('form[data-edit-scrobble]');
            console.log(form);
            return new FormData(form);
        }, weightFunc);
    });

    return scrobbleData;
}

async function JSONsorter(doc,method){
    const sortDoc = []
    if (doc.length === 0){
        return;
    }

    for (let i = 0; i < doc.length; i++) {
        let track = doc[i]

        let trackName = track.name;
        //let albumName = track.album['#text'];

        let cleanTrackName = filter.filterField(method.type, trackName).trim();
        //let cleanAlbumName = filter.filterField('album', albumName);

        if (trackName != cleanTrackName) {
            console.log(trackName, ' ---> ', cleanTrackName);
            //console.log({test:cleanTrackName})
            track.cleanName = cleanTrackName;
            sortDoc.push(track);
            //console.log(albumName, ' ---> ', cleanAlbumName);
            /*
            let res = await lastfm.fixScrobble(track, cleanTrackName, cleanAlbumName);
            if (res) {
                console.log('Fixed.');
            } else {
                console.log('Failed to fix.');
            }
            */
        }
    }
    //console.log(sortDoc);

    return sortDoc
}

async function fetchHTMLDocument(url) {
    // retry 5 times with exponential timeout
    for (let i = 0; i < 5; i++) {
        if (i !== 0) {
            // wait 2 seconds, then 4 seconds, then 8, finally 16 (30 seconds total)
            await new Promise(resolve => setTimeout(resolve, Math.pow(2, i)));
        }

        const response = await fetch(url);

        if (response.ok) {
            const html = await response.text();
            const doc = domParser.parseFromString(html, 'text/html');

            if (doc.querySelector('table.chartlist') || i === 4) {
                return doc;
            }
        }
    }

    abort();
}

async function fetchJSON(url) {
    // retry 5 times with exponential timeout
    for (let i = 0; i < 5; i++) {
        if (i !== 0) {
            // wait 2 seconds, then 4 seconds, then 8, finally 16 (30 seconds total)
            await new Promise(resolve => setTimeout(resolve, Math.pow(2, i)));
        }

        const response = await fetch(url);

        if (response.ok) {
            const json = await response.text();
            console.log(json);
            const doc = JSON.parse(json);
            return doc;
        }
    }

    abort();
}

let aborting = false;

function abort() {
    if (aborting) return;
    aborting = true;
    alert('There was a problem loading your scrobbles, please try again later.');
    window.location.reload();
}

// series for loop that updates the loading percentage
async function forEach(loadingModal, parentStep, array, callback, weightFunc) {
    const tuples = array.map(item => ({ item, step: { weight: weightFunc ? weightFunc(item) : 1, steps: [] } }));
    parentStep.steps.push(...tuples.map(tuple => tuple.step));
    loadingModal.refreshProgress();

    const result = [];
    for (const tuple of tuples) {
        result.push(await callback(tuple.item, tuple.step));
        tuple.step.completed = true;
        loadingModal.refreshProgress();
    }

    return flatten(result);
}

// parallel for loop that updates the loading percentage
async function forEachParallel(loadingModal, parentStep, array, callback, weightFunc) {
    const tuples = array.map(item => ({ item, step: { weight: weightFunc ? weightFunc(item) : 1, steps: [] } }));
    parentStep.steps.push(...tuples.map(tuple => tuple.step));
    loadingModal.refreshProgress();

    const result = await Promise.all(tuples.map(async tuple => {
        const result = await callback(tuple.item, tuple.step);
        tuple.step.completed = true;
        loadingModal.refreshProgress();
        return result;
    }));

    return flatten(result);
}

// because Edge does not support Array.prototype.flat()
function flatten(array) {
    return array.reduce((flat, toFlatten) => {
        return flat.concat(Array.isArray(toFlatten) ? flatten(toFlatten) : toFlatten);
    }, []);
}

function groupBy(array, keyFunc) {
    const map = new Map();

    for (const item of array) {
        const key = keyFunc(item);
        const value = map.get(key);
        if (!value) {
            map.set(key, [item]);
        } else {
            value.push(item);
        }
    }

    return map;
}

function getMixedInputValue(input) {
    return input.placeholder !== 'Mixed' ? input.value : null;
}

function cloneFormData(formData) {
    const clonedFormData = new FormData();

    for (const [name, value] of formData) {
        clonedFormData.append(name, value);
    }

    return clonedFormData;
}

// helper function that completes when a matching element gets appended
function observeChildList(target, selector) {
    return new Promise(resolve => {
        const observer = new MutationObserver(mutations => {
            for (const mutation of mutations) {
                for (const node of mutation.addedNodes) {
                    if (node.matches(selector)) {
                        observer.disconnect();
                        resolve(node);
                        return;
                    }
                }
            }
        });

        observer.observe(target, { childList: true });
    });
}

function applyFormData(form, formData) {
    for (const [name, value] of formData) {
        const input = form.elements[name];
        input.value = value;
    }
}


