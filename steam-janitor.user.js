// ==UserScript==
// @name Steam Janitor
// @description Hide unwanted user content in browse view, endless scrolling
// @match *://*.steamcommunity.com/workshop/browse/*
// @run-at document-end
// @version 0.0.2
// @grant GM_setValue
// @grant GM_getValue
// @grant GM_listValues
// @updateURL   https://raw.githubusercontent.com/Jetsparrow/steam-janitor/main/steam-janitor.js
// @downloadURL https://raw.githubusercontent.com/Jetsparrow/steam-janitor/main/steam-janitor.js
// ==/UserScript==

const addGlobalStyle = (doc, css) => {
    let head = doc.getElementsByTagName('head')[0];
    if (!head) return null;
    let style = document.createElement('style');
    style.type = 'text/css';
    style.innerHTML = css;
    head.appendChild(style);
    return style;
}

const htmlToElement = (doc, html) => {
    var template = doc.createElement('template');
    template.innerHTML = html.trim();
    return template.content.firstChild;
}

const onVisible = (element, callback) => {
    const observer = new IntersectionObserver(
        (entries, observer) => {
            entries.forEach(entry => {
                if (entry.isIntersecting) {
                    callback();
                    observer.unobserve(entry.target);
                }
            });
        },
        { rootMargin: "0px 0px 200px 0px" }
    );

    observer.observe(element);
};
const selectors = {
    PAGING_INFO: ".workshopBrowsePagingWithBG",
    ITEM_CONTAINER: ".workshopBrowseItems .workshopItemPreviewHolder",
    ITEMS_CONTAINER: ".workshopBrowseItems",
    ITEMS_HOVERS: ".workshopBrowseItems script",
    NEXT_BUTTON: ".workshopBrowsePagingControls .pagebtn:last-child",
    PAGINATOR: ".workshopBrowsePagingControls",
    FOOTER: ".workshopBrowsePaging"
};

const unhiddenClass = "janitorItem";
const hiddenFilteredClass = "janitorItemHidden";
const hiddenUnfilteredClass = "janitorItemHiddenUnfiltered";
const hideButtonClass = "janitorHideButton";
const showButtonClass = "janitorShowButton";

const janitorCss = `
.${hiddenFilteredClass} { display:none !important; }
.${hiddenUnfilteredClass} {opacity: 0.25;}
.${hiddenUnfilteredClass} .${showButtonClass} { display:inline !important; }
.${hiddenUnfilteredClass} .${hideButtonClass} { display:none !important; }
.${unhiddenClass} .${showButtonClass} { display:none !important; }
.${unhiddenClass} .${hideButtonClass} { display:inline !important; }
`;

const defaultModData = () => {
    let d = new Object();
    d.hide = false;
    return d;
}
const loadModData = (modId) => {
    var j = GM_getValue("modid:" + modId, "");
    return j == "" ? defaultModData() : JSON.parse(j);
}
const saveModData = (modId, data) => GM_setValue("modid:" + modId, JSON.stringify(data));

const updateHiddenClass = (doc, modId) => {
    var container = doc.getElementById(modId)?.parentElement?.parentElement;
    if (!container) return;
    const d = loadModData(modId);
    container.classList.remove(unhiddenClass);
    container.classList.remove(hiddenFilteredClass);
    container.classList.remove(hiddenUnfilteredClass);

    if (!d.hide) container.classList.add(unhiddenClass);
    else if (window.janitorFilterEnabled) container.classList.add(hiddenFilteredClass);
    else container.classList.add(hiddenUnfilteredClass);
}

const setHidden = (doc, modId, isHidden) => {
    var d = loadModData(modId);
    d.hide = isHidden;
    saveModData(modId, d);
    updateHiddenClass(doc, modId);
}

const addHideButtons = (doc, container, id) => {
    const hide = htmlToElement(doc, `<a class="${hideButtonClass}">hide</a>`)
    hide.onclick = () => {setHidden(document, id, true);};
    container.prepend(hide);

    const show = htmlToElement(doc, `<a class="${showButtonClass}">show</a>`)
    show.onclick = () => {setHidden(document, id, false);};
    container.prepend(show);
}

const processContainers = (doc) => {
    for (var el of doc.querySelectorAll(selectors.ITEM_CONTAINER)){
        const container = el.parentElement.parentElement;
        const id = el.id;
        updateHiddenClass(doc, id);

        if (container.janitorButtonsAdded) continue;
        container.janitorButtonsAdded = true;
        addHideButtons(doc, container, id);
    }
}

const loadNextPage = (url) => {
    fetch(url, { credentials: "same-origin" })
        .then(response => response.text())
        .then(html => {
        const parser = new DOMParser();
        const newDoc = parser.parseFromString(html, "text/html");
        processContainers(newDoc);

        const newMods = newDoc.querySelectorAll(selectors.ITEM_CONTAINER);
        const modContainer = document.querySelector(selectors.ITEMS_CONTAINER);
        for (const mod of newMods) {
            const container = mod.parentElement.parentElement;
            modContainer.appendChild(container);
        }

        const scripts = newDoc.querySelectorAll(selectors.ITEMS_HOVERS);
        for (const newScript of scripts){
            const matches = newScript.innerHTML.match(/(sharedfile_\d+)/);
            if (matches.length < 1) continue;
            const data = loadModData(matches[0]);
            if (data.hide) continue;
            eval("try{ "+ newScript.innerHTML + " } catch {} ");
        }

        const nextUrl = newDoc.querySelector(selectors.NEXT_BUTTON)?.getAttribute("href");
        const footer = document.getElementById("footer");
        if (nextUrl) onVisible(footer, loadNextPage.bind(null, nextUrl));
        window.history.pushState("", "", url);
    });
};

function toggleFilter(checkbox) {
    window.janitorFilterEnabled = checkbox.checked;
    GM_setValue("janitorFilterEnabled", checkbox.checked);
    const doc = checkbox.ownerDocument;
    processContainers(doc);
}

(() => {
    const load = () => {

        console.log(GM_listValues());

        addGlobalStyle(document, janitorCss);

        const filterToggleRoot = document.querySelector(selectors.PAGING_INFO);
        const toggle = htmlToElement(document, `
<div>
  <input type="checkbox" id="janitorFilterToggle">
  <label for="janitorFilterToggle">Filter</label>
</div>
`);
        const checkbox = toggle.children[0];
        checkbox.checked = window.janitorFilterEnabled = GM_getValue("janitorFilterEnabled", true);
        checkbox.onclick = () => toggleFilter(checkbox);
        filterToggleRoot.prepend(toggle);
        processContainers(document);

        const nextUrl = document.querySelector(selectors.NEXT_BUTTON)?.getAttribute("href");
        if (!nextUrl) {
            console.error(`Could not find nextUrl through "${selectors.NEXT_BUTTON}"`);
            return;
        }

        loadNextPage(nextUrl);
        document.querySelector(selectors.PAGINATOR)?.remove();
    };

    load();
})();
