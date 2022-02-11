// ==UserScript==
// @name Steam Janitor
// @namespace jetsparrow-steam-janitor
// @author Jetsparrow
// @description Hide unwanted user content in browse view, endless scrolling
// @match *://*.steamcommunity.com/workshop/browse/*
// @run-at document-end
// @version 0.0.3
// @grant GM_setValue
// @grant GM_getValue
// @downloadURL https://jetsparrow.github.io/steam-janitor/steam-janitor.user.js
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
const selector = {
    PAGING_INFO: ".workshopBrowsePagingWithBG",
    ITEM_CONTAINER: ".workshopBrowseItems .workshopItemPreviewHolder",
    ITEMS_CONTAINER: ".workshopBrowseItems",
    ITEMS_HOVERS: ".workshopBrowseItems script",
    NEXT_BUTTON: ".workshopBrowsePagingControls .pagebtn:last-child",
    PAGINATOR: ".workshopBrowsePagingControls",
    PAGE_INFO: ".workshopBrowsePagingInfo",
    FOOTER: ".workshopBrowsePaging",
};

const elemId = {
    scrollTarget: "footer",
    filterToggleCheckbox: "janitorFilterToggleCheckbox",
    filterToggleOn: "janitorFilterOnIcon",
    filterToggleOff: "janitorFilterOffIcon",
};

const cssClass = {
    unhidden: "janitorItem",
    hiddenFiltered: "janitorItemHidden",
    hiddenUnfiltered: "janitorItemHiddenUnfiltered",
    hideButton: "janitorHideButton",
    showButton: "janitorShowButton",
    filterToggle: "janitorFilterToggle",
    hideButton: "janitorhideButton"
};

const resource = {
    iconEyeOpen:"https://jetsparrow.github.io/steam-janitor/res/filter_toggle_open.png",
    iconEyeClosed:"https://jetsparrow.github.io/steam-janitor/res/filter_toggle_closed.png",
    btnHide:"https://jetsparrow.github.io/steam-janitor/res/janitor_hide.png",
    btnHideHover:"https://jetsparrow.github.io/steam-janitor/res/janitor_hide_hover.png",
    btnUnhide:"https://jetsparrow.github.io/steam-janitor/res/janitor_unhide.png",
    btnUnhideHover:"https://jetsparrow.github.io/steam-janitor/res/janitor_unhide_hover.png",
};

const janitorCss = `
.${cssClass.hiddenFiltered} {display:none !important; }
.${cssClass.hiddenUnfiltered} img {opacity: 0.25;}
.${cssClass.hideButton} {width:25px; height:25px;}
.${cssClass.hiddenUnfiltered} .${cssClass.hideButton}:hover {background-image:url("${resource.btnUnhideHover}")}
.${cssClass.hiddenUnfiltered} .${cssClass.hideButton} {background-image:url("${resource.btnUnhide}")}
.${cssClass.unhidden} .${cssClass.hideButton}:hover {background-image:url("${resource.btnHideHover}")}
.${cssClass.unhidden} .${cssClass.hideButton} {background-image:url("${resource.btnHide}")}
.${cssClass.filterToggle} * { vertical-align: middle; }
.workshopItem .${cssClass.hideButton} { visibility: hidden; position: absolute; top: 4px; right: 6px; }
.workshopItem:hover .${cssClass.hideButton} { visibility: visible; position: absolute; top: 4px; right: 6px;}
`;

const setting = {
    filterEnabled: "janitorFilterEnabled"
};

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

const updateHiddenClass = (doc, modId, filterOn) => {
    var container = doc.getElementById(modId)?.parentElement?.parentElement;
    if (!container) return;
    const d = loadModData(modId);
    container.classList.remove(cssClass.unhidden);
    container.classList.remove(cssClass.hiddenFiltered);
    container.classList.remove(cssClass.hiddenUnfiltered);

    if (!d.hide) container.classList.add(cssClass.unhidden);
    else if (filterOn) container.classList.add(cssClass.hiddenFiltered);
    else container.classList.add(cssClass.hiddenUnfiltered);
}

const toggleHidden = (doc, modId) => {
    var d = loadModData(modId);
    d.hide = !d.hide;
    saveModData(modId, d);
    const filterOn = GM_getValue(setting.filterEnabled);
    updateHiddenClass(doc, modId, filterOn);
}

const addHideButtons = (doc, container, id) => {
    const controls = htmlToElement(doc, `<div class="${cssClass.hideButton}"> </>`);
    controls.onclick = (e) => {
        e.cancelBubble = true;
        toggleHidden(document, id);
    };
    container.append(controls);
}

const processContainers = (doc) => {
    const filterOn = GM_getValue(setting.filterEnabled);
    for (var el of doc.querySelectorAll(selector.ITEM_CONTAINER)){
        const container = el.parentElement.parentElement;
        const id = el.id;
        updateHiddenClass(doc, id, filterOn);

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

        const newMods = newDoc.querySelectorAll(selector.ITEM_CONTAINER);
        const modContainer = document.querySelector(selector.ITEMS_CONTAINER);
        for (const mod of newMods) {
            const container = mod.parentElement.parentElement;
            modContainer.appendChild(container);
        }

        const scripts = newDoc.querySelectorAll(selector.ITEMS_HOVERS);
        for (const newScript of scripts){
            const matches = newScript.innerHTML.match(/(sharedfile_\d+)/);
            if (matches.length < 1) continue;
            const data = loadModData(matches[0]);
            if (data.hide) continue;
            eval("try{ "+ newScript.innerHTML + " } catch {} ");
        }

        const nextUrl = newDoc.querySelector(selector.NEXT_BUTTON)?.getAttribute("href");
        const footer = document.getElementById(elemId.scrollTarget);
        if (nextUrl) onVisible(footer, loadNextPage.bind(null, nextUrl));
        window.history.pushState("", "", url);
    });
};

function toggleFilter(checkbox) {
    GM_setValue(setting.filterEnabled, checkbox.checked);
    const doc = checkbox.ownerDocument;
    doc.getElementById(elemId.filterToggleOff).hidden = checkbox.checked;
    doc.getElementById(elemId.filterToggleOn).hidden = !checkbox.checked;
    processContainers(doc);
}

(() => {
    const load = () => {
        addGlobalStyle(document, janitorCss);

        document.querySelector(selector.PAGE_INFO)?.remove();
        const filterToggleRoot = document.querySelector(selector.PAGING_INFO);
        const toggle = htmlToElement(document, `
<div class="${cssClass.filterToggle}">
  &nbsp;
  <input type="checkbox" id="${elemId.filterToggleCheckbox}">
  &nbsp;
  <label for="${elemId.filterToggleCheckbox}">
      <img src="${resource.iconEyeOpen}" id="${elemId.filterToggleOff}">
      <img src="${resource.iconEyeClosed}" id="${elemId.filterToggleOn}">
  </label>
  &nbsp;
</div>
`);
        const checkbox = toggle.children[0];
        checkbox.checked = GM_getValue(setting.filterEnabled, true);
        checkbox.onclick = () => toggleFilter(checkbox);
        filterToggleRoot.prepend(toggle);
        toggleFilter(checkbox);
        processContainers(document);

        const nextUrl = document.querySelector(selector.NEXT_BUTTON)?.getAttribute("href");
        if (!nextUrl) {
            console.error(`Could not find nextUrl through "${selector.NEXT_BUTTON}"`);
            return;
        }

        loadNextPage(nextUrl);

        document.querySelector(selector.PAGINATOR)?.remove();

    };

    load();
})();
