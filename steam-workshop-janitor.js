// ==UserScript==
// @name Steam Workshop Janitor
// @description Hide unwanted mods in the browse view, endless scrolling
// @match *://*.steamcommunity.com/workshop/browse/*
// @run-at document-end
// @version 0.0.1
// @grant GM_setValue
// @grant GM_getValue
// ==/UserScript==

const selectors = {
    ITEM_CONTAINER: ".workshopBrowseItems .workshopItemPreviewHolder",
    ITEMS_CONTAINER: ".workshopBrowseItems",
    ITEMS_HOVERS: ".workshopBrowseItems script",
    NEXT_BUTTON: ".workshopBrowsePagingControls .pagebtn:last-child",
    PAGINATOR: ".workshopBrowsePagingControls"
};

function htmlToElement(doc, html) {
    var template = doc.createElement('template');
    html = html.trim(); // Never return a text node of whitespace as the result
    template.innerHTML = html;
    return template.content.firstChild;
}

const on_visible = (element, callback) => {
    const observer = new IntersectionObserver(
        (entries, observer) => {
            entries.forEach(entry => {
                if (entry.isIntersecting) {
                    callback();
                    observer.unobserve(entry.target);
                }
            });
        },
        { rootMargin: "0px 0px -200px 0px" }
    );

    observer.observe(element);
};

function defaultModData()
{
    var res = new Object();
    res.hide = false;
    return res;
}
function loadModData(id){
    var j = GM_getValue("modid:" + id, "");
    return j == "" ? defaultModData() : JSON.parse(j);
}
function saveModData(id, data){
    GM_setValue("modid:" + id, JSON.stringify(data));
}


function hideId(id){
    var d = loadModData(id);
    d.hide = true;
    saveModData(id, d);
    var elem = document.getElementById(id);
    if (elem){
        elem.parentElement.parentElement.remove();
    }
}

function sweepHidden(doc){
    var containers = doc.querySelectorAll(selectors.ITEM_CONTAINER);
    for (var container of containers)
    {
        var id = container.id;
        var data = loadModData(id);
        if (data.hide){
            container.parentElement.parentElement.remove();
        }
    }
}

function addButtonToElement(doc, elem){
    var janitorButton = htmlToElement(doc, `<a>X</a>`)
    let id = elem.id;
    janitorButton.onclick = function(){hideId(id);};
    elem.parentElement.parentElement.prepend(janitorButton);
}

function addButtons(doc){
    var containers = doc.querySelectorAll(selectors.ITEM_CONTAINER);
    for (var container of containers){
        addButtonToElement(doc, container);
    }
}

const load_next = (url) => {
    fetch(url, { credentials: "same-origin" })
        .then(response => response.text())
        .then(html => {
        const parser = new DOMParser();
        const newDoc = parser.parseFromString(html, "text/html");

        sweepHidden(newDoc);
        addButtons(newDoc);

        const newPaginator = newDoc.querySelector(selectors.PAGINATOR);
        const oldPaginator = document.querySelector(selectors.PAGINATOR);
        const pagParent = oldPaginator.parentElement;
        oldPaginator.remove();
        pagParent.append(newPaginator);

        const newMods = newDoc.querySelectorAll(selectors.ITEM_CONTAINER);
        const lastMod = newMods[newMods.length - 1];

        const modContainer = document.querySelector(selectors.ITEMS_CONTAINER);
        for (var mod of newMods) {
            var container = mod.parentElement.parentElement;
            modContainer.appendChild(container);
        }

        const scripts = newDoc.querySelectorAll(selectors.ITEMS_HOVERS);
        for (var newScript of scripts){
            var matches = newScript.innerHTML.match(/(sharedfile_\d+)/);
            if (matches.length < 1) continue;
            var data = loadModData(matches[0]);
            if (data.hide) continue;
            eval("try{ "+ newScript.innerHTML + " } catch {} ");
        }

        const nextButton = document.querySelector(selectors.NEXT_BUTTON);

        if (lastMod && nextButton) {
            const nextUrl = nextButton.getAttribute("href");
            on_visible(lastMod, load_next.bind(null, nextUrl));
        }

        window.history.pushState("", "", url);
    });
};

(() => {
    const load = () => {
        const next_button = document.querySelector(selectors.NEXT_BUTTON);

        if (!next_button) {
            console.error(`Could not find "${selectors.NEXT_BUTTON}"`);
            return;
        }
        sweepHidden(document);
        addButtons(document);

        const nextUrl = next_button.getAttribute("href");
        load_next(nextUrl);
    };

    load();
})();
